import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Automated motion guardrail (spec: "Motion Guardrail for New Interactive
 * Elements", "Transition Duration Bound"; design: "Guardrail mechanism" —
 * a Vitest static-scan test, no ESLint, reusing the existing test runner).
 *
 * No separate production module: per design, the scanning logic lives here,
 * directly exercised both against deliberately-broken fixtures (proving the
 * scanner itself detects violations) and against the real `src/` tree
 * (proving the codebase stays compliant by construction).
 */

const SRC_ROOT = join(process.cwd(), "src");

function collectFiles(dir: string, extensions: string[]): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Extracts every quoted string literal from `source` and returns the ones
 * that declare a `transition-`/`animate-` class without a paired
 * `motion-reduce:` opt-out (spec: "Guardrail catches a missing
 * reduced-motion pairing").
 */
function findMissingMotionReducePairings(source: string): string[] {
  const stringLiteralPattern = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;
  const offenders: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = stringLiteralPattern.exec(source)) !== null) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    const hasMotionClass = /(?:^|\s)(transition-|animate-)/.test(value);
    if (hasMotionClass && !value.includes("motion-reduce:")) {
      offenders.push(value);
    }
  }
  return offenders;
}

/** Strips the reduced-motion override block, which intentionally collapses
 * durations to near-zero as a safety net (spec: "Global Reduced-Motion
 * Respect") and is not itself a bounded motion primitive. */
function stripReducedMotionBlock(css: string): string {
  const marker = "@media (prefers-reduced-motion: reduce)";
  const start = css.indexOf(marker);
  if (start === -1) {
    return css;
  }
  const braceStart = css.indexOf("{", start);
  if (braceStart === -1) {
    return css;
  }
  let depth = 0;
  let end = braceStart;
  for (; end < css.length; end++) {
    if (css[end] === "{") {
      depth++;
    } else if (css[end] === "}") {
      depth--;
      if (depth === 0) {
        end++;
        break;
      }
    }
  }
  return css.slice(0, start) + css.slice(end);
}

/**
 * Extracts every `<number>ms` duration and returns the ones outside the
 * 150-250ms inclusive bound (spec: "Transition Duration Bound").
 */
function findDurationViolations(css: string): string[] {
  const scoped = stripReducedMotionBlock(css);
  const durationPattern = /(\d+(?:\.\d+)?)ms/g;
  const violations: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = durationPattern.exec(scoped)) !== null) {
    const value = Number(match[1]);
    if (value < 150 || value > 250) {
      violations.push(match[0]);
    }
  }
  return violations;
}

describe("motion guardrail scanner — fixtures (proves the scanner itself works)", () => {
  it("flags a transition-/animate- class string missing a motion-reduce: pairing", () => {
    const fixture = `<button className="rounded-md transition-colors duration-300">Enviar</button>`;

    const violations = findMissingMotionReducePairings(fixture);

    expect(violations).toEqual(["rounded-md transition-colors duration-300"]);
  });

  it("reports no violation when the transition-/animate- class is paired with motion-reduce:", () => {
    const fixture = `<button className="rounded-md transition-colors motion-reduce:transition-none">Enviar</button>`;

    const violations = findMissingMotionReducePairings(fixture);

    expect(violations).toEqual([]);
  });

  it("flags a declared duration outside the 150-250ms bound", () => {
    const fixture = `.custom-fixture { transition-duration: 400ms; }`;

    const violations = findDurationViolations(fixture);

    expect(violations).toEqual(["400ms"]);
  });

  it("reports no violation for a duration within the 150-250ms bound", () => {
    const fixture = `.custom-fixture { transition-duration: 200ms; }`;

    const violations = findDurationViolations(fixture);

    expect(violations).toEqual([]);
  });

  it("excludes the reduced-motion override block's near-zero durations from the bound check", () => {
    const fixture = `
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }
      .custom-fixture { transition-duration: 200ms; }
    `;

    const violations = findDurationViolations(fixture);

    expect(violations).toEqual([]);
  });
});

describe("motion guardrail — real src/ tree (spec: 'Guardrail passes a compliant element')", () => {
  it("reports zero motion-reduce pairing violations across src/**/*.{astro,tsx}", () => {
    const files = collectFiles(SRC_ROOT, [".astro", ".tsx"]);
    expect(files.length).toBeGreaterThan(0);

    const violationsByFile: Record<string, string[]> = {};
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      const violations = findMissingMotionReducePairings(source);
      if (violations.length > 0) {
        violationsByFile[file] = violations;
      }
    }

    expect(violationsByFile).toEqual({});
  });

  it("reports zero duration-bound violations in src/styles/global.css", () => {
    const cssPath = join(SRC_ROOT, "styles", "global.css");
    const css = readFileSync(cssPath, "utf-8");

    const violations = findDurationViolations(css);

    expect(violations).toEqual([]);
  });
});
