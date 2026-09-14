import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { OfficeMap } from "./OfficeMap";

/**
 * Component tests for the `OfficeMap` island (spec: "office-map-widget" —
 * "Map Rendering", "Tile Source Independence", "Accessible, Supplementary
 * Presentation", "Reduced Motion Compliance", "Attribution Visibility";
 * design: Decisions 1-4).
 *
 * office-map-per-office redesign: `OfficeMap` now renders exactly ONE office
 * per instance (name + lat/lon), centered on that single point at a fixed
 * zoom — there is nothing to `fitBounds` with only one marker. `OfficeCard`
 * mounts one `OfficeMap` instance per office instead of a single shared map
 * showing every office together.
 *
 * `maplibre-gl` is mocked throughout (same `vi.mock` convention
 * `ContactForm.test.tsx` uses for `@cap.js/widget`): jsdom has no WebGL
 * context, so the real library cannot construct a `Map` instance in tests.
 */

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const TEST_OFFICE = { name: "Langreo (Asturias)", lat: 43.3078225, lon: -5.6961254 };
const OTHER_OFFICE = { name: "Madrid", lat: 40.465928, lon: -3.6906199 };

const mapInstances: Array<{
  options: Record<string, unknown>;
  on: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  flyTo: ReturnType<typeof vi.fn>;
  easeTo: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  addControl: ReturnType<typeof vi.fn>;
  loadHandlers: Array<() => void>;
}> = [];

const markerInstances: Array<{
  setLngLat: ReturnType<typeof vi.fn>;
  setPopup: ReturnType<typeof vi.fn>;
  addTo: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  lngLat: [number, number] | undefined;
}> = [];

const popupInstances: Array<{
  setText: ReturnType<typeof vi.fn>;
  text: string | undefined;
}> = [];

let attributionControlConstructed = 0;

vi.mock("maplibre-gl", () => {
  class MockMap {
    options: Record<string, unknown>;
    loadHandlers: Array<() => void> = [];
    fitBounds = vi.fn();
    flyTo = vi.fn();
    easeTo = vi.fn();
    remove = vi.fn();
    addControl = vi.fn();
    on: ReturnType<typeof vi.fn>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.on = vi.fn((event: string, handler: () => void) => {
        if (event === "load") {
          this.loadHandlers.push(handler);
        }
      });
      mapInstances.push({
        options: this.options,
        on: this.on,
        fitBounds: this.fitBounds,
        flyTo: this.flyTo,
        easeTo: this.easeTo,
        remove: this.remove,
        addControl: this.addControl,
        loadHandlers: this.loadHandlers,
      });
    }
  }

  class MockMarker {
    lngLat: [number, number] | undefined;
    setLngLat = vi.fn((lngLat: [number, number]) => {
      this.lngLat = lngLat;
      return this;
    });
    setPopup = vi.fn(() => this);
    addTo = vi.fn(() => this);
    remove = vi.fn();

    constructor() {
      markerInstances.push({
        setLngLat: this.setLngLat,
        setPopup: this.setPopup,
        addTo: this.addTo,
        remove: this.remove,
        lngLat: this.lngLat,
      });
    }
  }

  class MockPopup {
    text: string | undefined;
    setText = vi.fn((text: string) => {
      this.text = text;
      popupInstances.push({ setText: this.setText, text: this.text });
      return this;
    });
  }

  class MockAttributionControl {
    constructor() {
      attributionControlConstructed += 1;
    }
  }

  return {
    Map: MockMap,
    Marker: MockMarker,
    Popup: MockPopup,
    AttributionControl: MockAttributionControl,
    // office-map-widget PR2: `OfficeMap.tsx` calls this at module scope to
    // point MapLibre at the vendored worker path (see `astro.config.mjs`'s
    // `copyMapLibreWorkerAssets` plugin) — a no-op stub is enough here since
    // jsdom never actually constructs a real Map/Worker.
    setWorkerUrl: vi.fn(),
  };
});

beforeEach(() => {
  mapInstances.length = 0;
  markerInstances.length = 0;
  popupInstances.length = 0;
  attributionControlConstructed = 0;
});

afterEach(() => {
  cleanup();
});

describe("OfficeMap map initialization", () => {
  it("constructs exactly one Map with the OpenFreeMap Liberty style URL and no CARTO reference", () => {
    render(<OfficeMap {...TEST_OFFICE} />);

    expect(mapInstances).toHaveLength(1);
    const style = mapInstances[0]?.options.style;
    expect(style).toBe(OPENFREEMAP_STYLE_URL);
    expect(String(style)).not.toMatch(/carto/i);
  });

  it("never disables the default AttributionControl (attributionControl must not be false)", () => {
    render(<OfficeMap {...TEST_OFFICE} />);

    expect(mapInstances[0]?.options.attributionControl).not.toBe(false);
  });

  it("centers the map on the office's own coordinates at a fixed zoom", () => {
    render(<OfficeMap {...TEST_OFFICE} />);

    const options = mapInstances[0]?.options as { center?: [number, number]; zoom?: number };
    expect(options.center).toEqual([TEST_OFFICE.lon, TEST_OFFICE.lat]);
    expect(typeof options.zoom).toBe("number");
    expect(options.zoom).toBeGreaterThan(0);
  });

  it("centers on a different office's own coordinates, independent of any other office", () => {
    render(<OfficeMap {...OTHER_OFFICE} />);

    const options = mapInstances[0]?.options as { center?: [number, number] };
    expect(options.center).toEqual([OTHER_OFFICE.lon, OTHER_OFFICE.lat]);
  });
});

describe("OfficeMap marker", () => {
  it("adds exactly one Marker+Popup, positioned at the office's coordinates", () => {
    render(<OfficeMap {...TEST_OFFICE} />);

    expect(markerInstances).toHaveLength(1);
    expect(markerInstances[0]?.setLngLat).toHaveBeenCalledWith([TEST_OFFICE.lon, TEST_OFFICE.lat]);
    expect(markerInstances[0]?.addTo).toHaveBeenCalled();
    expect(popupInstances.map((p) => p.text)).toEqual([TEST_OFFICE.name]);
  });
});

describe("OfficeMap camera behavior (design Decision 3: no animation, ever)", () => {
  it("never calls flyTo, easeTo, or fitBounds", () => {
    render(<OfficeMap {...TEST_OFFICE} />);

    expect(mapInstances[0]?.flyTo).not.toHaveBeenCalled();
    expect(mapInstances[0]?.easeTo).not.toHaveBeenCalled();
    expect(mapInstances[0]?.fitBounds).not.toHaveBeenCalled();
  });

  it("still centers on the office's coordinates when prefers-reduced-motion is set (no branching by motion preference)", () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMediaMock);

    render(<OfficeMap {...TEST_OFFICE} />);

    expect(matchMediaMock).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    const options = mapInstances[0]?.options as { center?: [number, number] };
    expect(options.center).toEqual([TEST_OFFICE.lon, TEST_OFFICE.lat]);

    vi.unstubAllGlobals();
  });
});

describe("OfficeMap accessibility and layout", () => {
  // MapLibre GL's default `Marker` sets `role="button" tabindex="0"` on
  // itself whenever a popup is attached (this maplibre-gl version's own
  // documented accessibility behavior, not something this component opts
  // into) — ARIA's `img` role forbids focusable descendants, so `region` is
  // still the correct role here even with a single marker (spec:
  // "Accessible, Supplementary Presentation").
  it("exposes role=region and an aria-label naming this office only", () => {
    const { container } = render(<OfficeMap {...TEST_OFFICE} />);

    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("aria-label", expect.stringContaining("Langreo"));
    expect(region).not.toHaveAttribute("aria-label", expect.stringContaining("Madrid"));
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it("gives each office a distinct aria-label", () => {
    const { container: langreoContainer } = render(<OfficeMap {...TEST_OFFICE} />);
    const { container: madridContainer } = render(<OfficeMap {...OTHER_OFFICE} />);

    const langreoRegion = langreoContainer.querySelector('[role="region"]');
    const madridRegion = madridContainer.querySelector('[role="region"]');
    expect(langreoRegion?.getAttribute("aria-label")).not.toEqual(madridRegion?.getAttribute("aria-label"));
  });

  it("reserves an explicit sized box to avoid CLS", () => {
    const { container } = render(<OfficeMap {...TEST_OFFICE} />);

    const region = container.querySelector('[role="region"]');
    expect(region?.className).toMatch(/aspect-|min-h-|h-\[/);
  });
});

describe("OfficeMap lifecycle", () => {
  it("removes the map instance on unmount", () => {
    const { unmount } = render(<OfficeMap {...TEST_OFFICE} />);
    unmount();

    expect(mapInstances[0]?.remove).toHaveBeenCalledTimes(1);
  });

  it("re-centers on a new office when props change without remounting", () => {
    const { rerender } = render(<OfficeMap {...TEST_OFFICE} />);
    rerender(<OfficeMap {...OTHER_OFFICE} />);

    expect(mapInstances).toHaveLength(2);
    expect(mapInstances[0]?.remove).toHaveBeenCalledTimes(1);
    const options = mapInstances[1]?.options as { center?: [number, number] };
    expect(options.center).toEqual([OTHER_OFFICE.lon, OTHER_OFFICE.lat]);
  });
});
