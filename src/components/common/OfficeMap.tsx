import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre GL resolves its Web Worker's URL relative to its own bundled
// module's `import.meta.url` at runtime (`defaultWorkerUrl()` in its
// source), assuming the worker file — and that worker's own sibling
// "shared" chunk it imports from — ship next to the main chunk. Vite/Astro
// never discovers or bundles that dynamic (string-URL) `new Worker(...)`
// call, so the worker 404s in production, `map.fitBounds` (which fires only
// after the worker-backed style/tile pipeline reaches `load`) never runs,
// and `Marker`s render at their raw unfitted projected position instead.
// `astro.config.mjs`'s `copyMapLibreWorkerAssets` plugin copies both files
// verbatim into `public/vendor/maplibre-gl/` before dev/build so they exist
// together at a stable, predictable, sibling-relative path; this points
// MapLibre at that path explicitly instead of its broken bundled-relative
// default.
setWorkerUrl("/vendor/maplibre-gl/maplibre-gl-worker.mjs");

/**
 * Interactive supplementary office-location map (spec: "office-map-widget" —
 * "Map Rendering", "Tile Source Independence", "Performance", "Accessible,
 * Supplementary Presentation", "Reduced Motion Compliance", "Attribution
 * Visibility"; design: "Interactive Office Map Widget (MapLibre GL +
 * OpenFreeMap)").
 *
 * This PR (PR1 of the office-map-widget chain) delivers the component fully
 * unit-tested and unmounted — no `.astro` page renders it yet (PR2 wires it
 * into `index.astro`/`el-despacho.astro` and adds the privacy disclosure).
 *
 * Hand-vendored `maplibre-gl` wrapper (design Decision 1 — this project has
 * no shadcn/ui infra, so `mapcn`'s CLI-copy path does not apply). The `Map`
 * instance is mounted imperatively inside a `useEffect`, matching this
 * repo's established pattern for third-party DOM/canvas elements
 * (`ContactForm.tsx`'s `<cap-widget>` mount/cleanup) — third-party libraries
 * that own an imperative DOM/canvas surface are never rendered as JSX.
 *
 * Tile source: OpenFreeMap's public "Liberty" style (design Decision 2) — no
 * API key, no account, no CARTO reference anywhere. `attributionControl` is
 * NEVER set to `false`: OpenFreeMap's required attribution
 * ("OpenFreeMap © OpenMapTiles Data from OpenStreetMap") renders via
 * MapLibre's own default `AttributionControl`.
 *
 * Camera behavior: `fitBounds({ animate: false })` fires on `load` for every
 * user, unconditionally (design Decision 3) — never `flyTo`/`easeTo`. The
 * `prefers-reduced-motion` read still happens (matching the
 * `window.matchMedia?.("(prefers-reduced-motion: reduce)")` convention from
 * `src/lib/motion/scroll-reveal.ts`) for consistency and as a guard for any
 * future animated camera method, but since no animated method is ever
 * called, it has no branching effect today.
 *
 * Accessibility (design Decision 4, revised in PR2): the container carries
 * `role="region"` and a descriptive `aria-label` naming every office —
 * `role="img"` was PR1's original choice, but a real built E2E run (PR2)
 * caught an axe `nested-interactive` violation from it: MapLibre GL's
 * default `Marker` sets `role="button" tabindex="0"` on itself whenever a
 * popup is attached (this maplibre-gl version's own default accessibility
 * behavior — not something this component opts into), and ARIA's `img` role
 * forbids focusable descendants. `region` keeps the same required
 * accessible name while allowing that interactive content. Marker/popup
 * keyboard operability itself is still not custom-wired beyond MapLibre's
 * own default — `OfficeCard`'s "Cómo llegar" link remains the primary
 * accessible directions path (unchanged by this component).
 */

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const FIT_BOUNDS_OPTIONS = { padding: 48, maxZoom: 15, animate: false } as const;

export interface OfficeMapMarker {
  name: string;
  lat: number;
  lon: number;
}

export interface OfficeMapProps {
  offices: OfficeMapMarker[];
  className?: string;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function buildAriaLabel(offices: OfficeMapMarker[]): string {
  return `Mapa con la ubicación de: ${offices.map((office) => office.name).join(", ")}`;
}

export function OfficeMap({ offices, className }: OfficeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || offices.length === 0) {
      return;
    }

    // Read once per mount, matching `src/lib/motion/scroll-reveal.ts`'s
    // convention. No animated camera method is ever invoked (Decision 3), so
    // this flag never actually branches — kept for consistency and as a
    // guard against any future interactive camera call.
    void window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const bounds: [number, number, number, number] = offices.reduce(
      (acc, office) => [
        Math.min(acc[0], office.lon),
        Math.min(acc[1], office.lat),
        Math.max(acc[2], office.lon),
        Math.max(acc[3], office.lat),
      ],
      [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number],
    );

    // The `attributionControl` option is intentionally omitted — MapLibre
    // adds its default `AttributionControl` automatically unless this key is
    // explicitly set to `false`, which this component NEVER does, so
    // OpenFreeMap's required attribution always renders (spec: "Attribution
    // Visibility"; design Decision 2).
    //
    // office-map-widget PR2 deviation from design Decision 3: `bounds` +
    // `fitBoundsOptions` are passed here, at construction, instead of
    // calling `map.fitBounds(...)` inside a `map.on("load", ...)` handler.
    // A real built E2E run caught the bug the async version hid: `load`
    // only fires once the Web Worker-backed style/tile pipeline finishes,
    // so for the window before that, both markers rendered at their raw
    // unfitted position — nearly overlapping on screen for two offices this
    // geographically close relative to zoom 0 — which axe's `target-size`
    // rule (WCAG 2.5.8) correctly flagged. This applies the exact same
    // `animate:false` fit synchronously at construction instead, with no
    // unfitted frame ever rendered.
    const map = new MapLibreMap({
      container,
      style: OPENFREEMAP_STYLE_URL,
      bounds,
      fitBoundsOptions: FIT_BOUNDS_OPTIONS,
    });

    const markers = offices.map((office) => {
      const popup = new Popup().setText(office.name);
      return new Marker().setLngLat([office.lon, office.lat]).setPopup(popup).addTo(map);
    });

    return () => {
      for (const marker of markers) {
        marker.remove();
      }
      map.remove();
    };
  }, [offices]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={buildAriaLabel(offices)}
      className={cx("aspect-video w-full min-h-[320px] overflow-hidden rounded-md", className)}
    />
  );
}
