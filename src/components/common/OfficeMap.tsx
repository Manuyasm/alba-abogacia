import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker, Popup, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre GL resolves its Web Worker's URL relative to its own bundled
// module's `import.meta.url` at runtime (`defaultWorkerUrl()` in its
// source), assuming the worker file — and that worker's own sibling
// "shared" chunk it imports from — ship next to the main chunk. Vite/Astro
// never discovers or bundles that dynamic (string-URL) `new Worker(...)`
// call, so the worker 404s in production, and markers would render before
// the worker-backed style/tile pipeline is ready. `astro.config.mjs`'s
// `copyMapLibreWorkerAssets` plugin copies both files verbatim into
// `public/vendor/maplibre-gl/` before dev/build so they exist together at a
// stable, predictable, sibling-relative path; this points MapLibre at that
// path explicitly instead of its broken bundled-relative default.
setWorkerUrl("/vendor/maplibre-gl/maplibre-gl-worker.mjs");

/**
 * Interactive supplementary single-office location map (spec:
 * "office-map-widget" — "Map Rendering", "Tile Source Independence",
 * "Performance", "Accessible, Supplementary Presentation", "Reduced Motion
 * Compliance", "Attribution Visibility"; design: "Interactive Office Map
 * Widget (MapLibre GL + OpenFreeMap)").
 *
 * office-map-per-office redesign: this component now renders exactly ONE
 * office per instance (name + lat/lon) instead of an array of every office.
 * `OfficeCard` mounts one instance per card, centered on that card's own
 * office at a fixed zoom — there is nothing to `fitBounds` with a single
 * marker, so the previous multi-office bounds-fitting logic is gone.
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
 * Camera behavior (design Decision 3, revised for the per-office redesign):
 * the map is constructed with a fixed `center`/`zoom` on the single office's
 * coordinates — never `flyTo`/`easeTo`, and no `fitBounds` call at all, since
 * there is only ever one point to show. The `prefers-reduced-motion` read
 * still happens (matching the
 * `window.matchMedia?.("(prefers-reduced-motion: reduce)")` convention from
 * `src/lib/motion/scroll-reveal.ts`) for consistency and as a guard for any
 * future animated camera method, but since no animated method is ever
 * called, it has no branching effect today.
 *
 * Accessibility (design Decision 4): the container carries `role="region"`
 * and a descriptive `aria-label` naming this single office — `role="img"`
 * was PR1's original choice, but a real built E2E run (PR2) caught an axe
 * `nested-interactive` violation from it: MapLibre GL's default `Marker`
 * sets `role="button" tabindex="0"` on itself whenever a popup is attached
 * (this maplibre-gl version's own default accessibility behavior — not
 * something this component opts into), and ARIA's `img` role forbids
 * focusable descendants. That constraint is unchanged with a single marker,
 * so `region` remains the correct role — it keeps the required accessible
 * name while allowing that interactive content. Marker/popup keyboard
 * operability itself is still not custom-wired beyond MapLibre's own
 * default — `OfficeCard`'s "Cómo llegar" link remains the primary accessible
 * directions path (unchanged by this component).
 */

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

// Street-level zoom: close enough to be useful for a single-office map
// embedded at card size, without needing any `fitBounds` (there is only one
// point to show).
const OFFICE_MAP_ZOOM = 15;

export interface OfficeMapProps {
  name: string;
  lat: number;
  lon: number;
  className?: string;
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function buildAriaLabel(name: string): string {
  return `Mapa de ubicación de ${name}`;
}

export function OfficeMap({ name, lat, lon, className }: OfficeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Read once per mount, matching `src/lib/motion/scroll-reveal.ts`'s
    // convention. No animated camera method is ever invoked (Decision 3), so
    // this flag never actually branches — kept for consistency and as a
    // guard against any future interactive camera call.
    void window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // The `attributionControl` option is intentionally omitted — MapLibre
    // adds its default `AttributionControl` automatically unless this key is
    // explicitly set to `false`, which this component NEVER does, so
    // OpenFreeMap's required attribution always renders (spec: "Attribution
    // Visibility"; design Decision 2).
    const map = new MapLibreMap({
      container,
      style: OPENFREEMAP_STYLE_URL,
      center: [lon, lat],
      zoom: OFFICE_MAP_ZOOM,
    });

    const popup = new Popup().setText(name);
    const marker = new Marker().setLngLat([lon, lat]).setPopup(popup).addTo(map);

    return () => {
      marker.remove();
      map.remove();
    };
  }, [name, lat, lon]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={buildAriaLabel(name)}
      className={cx(
        "w-full max-w-[360px] h-[220px] overflow-hidden rounded-md",
        className,
      )}
    />
  );
}
