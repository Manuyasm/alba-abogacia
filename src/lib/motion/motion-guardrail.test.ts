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
 *
 * PR B introduces a second, distinct duration band (design decision #4,
 * "Reveal timing enforcement"): scroll-reveal entrance transitions
 * (`[data-reveal]` variants) are intentionally 500-650ms — much longer than
 * the 150-250ms bound that governs interactive hover/focus transitions
 * (`transition-interactive` and friends). The reveal CSS block in
 * `global.css` is wrapped in `/* MOTION-GUARDRAIL: reveal-band-start/end *\/`
 * markers; this file strips that marked block before running the existing
 * 150-250ms scan (reusing and generalizing the `stripReducedMotionBlock`
 * technique into `stripMarkedBlock`), then adds a second scan that looks
 * ONLY inside that block and enforces the 500-650ms bound there instead.
 */

const SRC_ROOT = join(process.cwd(), "src");

const REVEAL_BAND_START = "/* MOTION-GUARDRAIL: reveal-band-start */";
const REVEAL_BAND_END = "/* MOTION-GUARDRAIL: reveal-band-end */";

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
 * Generalized version of `stripReducedMotionBlock`'s technique: removes
 * everything between two literal marker comments (inclusive), returning the
 * CSS unchanged if either marker is absent. Unlike the brace-balanced
 * reduced-motion stripper, this operates on an explicit marker pair since the
 * reveal band spans multiple sibling rule blocks, not one braced block.
 */
function stripMarkedBlock(css: string, startMarker: string, endMarker: string): string {
  const start = css.indexOf(startMarker);
  if (start === -1) {
    return css;
  }
  const end = css.indexOf(endMarker, start);
  if (end === -1) {
    return css;
  }
  return css.slice(0, start) + css.slice(end + endMarker.length);
}

/** Extracts the content strictly between two literal marker comments
 * (exclusive of the markers themselves), or `null` when either marker is
 * missing — used to scope the reveal-band-only 500-650ms scan. */
function extractMarkedBlock(css: string, startMarker: string, endMarker: string): string | null {
  const start = css.indexOf(startMarker);
  if (start === -1) {
    return null;
  }
  const contentStart = start + startMarker.length;
  const end = css.indexOf(endMarker, contentStart);
  if (end === -1) {
    return null;
  }
  return css.slice(contentStart, end);
}

/**
 * Extracts every `<number>ms` duration and returns the ones outside the
 * given inclusive bound.
 */
function findDurationViolationsOutsideBound(css: string, min: number, max: number): string[] {
  const durationPattern = /(\d+(?:\.\d+)?)ms/g;
  const violations: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = durationPattern.exec(css)) !== null) {
    const value = Number(match[1]);
    if (value < min || value > max) {
      violations.push(match[0]);
    }
  }
  return violations;
}

/**
 * Extracts every `<number>ms` duration outside the 150-250ms inclusive bound
 * (spec: "Transition Duration Bound"). Excludes both the reduced-motion
 * safety-net block and the reveal-band block, which are governed by their
 * own, separate rules.
 */
function findDurationViolations(css: string): string[] {
  const withoutReducedMotion = stripReducedMotionBlock(css);
  const scoped = stripMarkedBlock(withoutReducedMotion, REVEAL_BAND_START, REVEAL_BAND_END);
  return findDurationViolationsOutsideBound(scoped, 150, 250);
}

/**
 * Extracts every `<number>ms` duration inside the MOTION-GUARDRAIL reveal
 * band that falls outside the 500-650ms inclusive bound (design decision #4,
 * "Reveal timing enforcement"). Returns a sentinel violation if the markers
 * are missing entirely, so a future accidental removal fails loudly instead
 * of silently reporting zero violations.
 */
function findRevealBandDurationViolations(css: string): string[] {
  const block = extractMarkedBlock(css, REVEAL_BAND_START, REVEAL_BAND_END);
  if (block === null) {
    return ["MOTION-GUARDRAIL reveal-band markers not found in global.css"];
  }
  return findDurationViolationsOutsideBound(block, 500, 650);
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

  it("excludes a marked reveal-band block's 600ms durations from the 150-250ms scan", () => {
    const fixture = `
      .custom-fixture { transition-duration: 200ms; }
      ${REVEAL_BAND_START}
      [data-reveal].reveal-visible { transition-duration: 600ms; }
      ${REVEAL_BAND_END}
    `;

    const violations = findDurationViolations(fixture);

    expect(violations).toEqual([]);
  });

  it("flags a reveal-band duration outside the 500-650ms bound", () => {
    const fixture = `
      ${REVEAL_BAND_START}
      [data-reveal].reveal-visible { transition-duration: 200ms; }
      ${REVEAL_BAND_END}
    `;

    const violations = findRevealBandDurationViolations(fixture);

    expect(violations).toEqual(["200ms"]);
  });

  it("reports no violation for a reveal-band duration within the 500-650ms bound", () => {
    const fixture = `
      ${REVEAL_BAND_START}
      [data-reveal].reveal-visible { transition-duration: 600ms; }
      ${REVEAL_BAND_END}
    `;

    const violations = findRevealBandDurationViolations(fixture);

    expect(violations).toEqual([]);
  });

  it("excludes durations outside the reveal-band markers from the reveal-band-only scan", () => {
    const fixture = `
      .outside-fixture { transition-duration: 200ms; }
      ${REVEAL_BAND_START}
      [data-reveal].reveal-visible { transition-duration: 600ms; }
      ${REVEAL_BAND_END}
    `;

    const violations = findRevealBandDurationViolations(fixture);

    expect(violations).toEqual([]);
  });

  it("returns a sentinel violation when the reveal-band markers are missing entirely", () => {
    const fixture = `.custom-fixture { transition-duration: 600ms; }`;

    const violations = findRevealBandDurationViolations(fixture);

    expect(violations).toEqual(["MOTION-GUARDRAIL reveal-band markers not found in global.css"]);
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

  it("reports zero interactive (150-250ms) duration-bound violations in src/styles/global.css", () => {
    const cssPath = join(SRC_ROOT, "styles", "global.css");
    const css = readFileSync(cssPath, "utf-8");

    const violations = findDurationViolations(css);

    expect(violations).toEqual([]);
  });

  it("finds the MOTION-GUARDRAIL reveal-band markers and reports zero scroll-reveal (500-650ms) duration-bound violations inside them", () => {
    const cssPath = join(SRC_ROOT, "styles", "global.css");
    const css = readFileSync(cssPath, "utf-8");

    const block = extractMarkedBlock(css, REVEAL_BAND_START, REVEAL_BAND_END);
    expect(block).not.toBeNull();

    const violations = findRevealBandDurationViolations(css);

    expect(violations).toEqual([]);
  });
});
