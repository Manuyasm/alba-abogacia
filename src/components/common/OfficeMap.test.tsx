import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { OfficeMap, type OfficeMapMarker } from "./OfficeMap";

/**
 * Component tests for the `OfficeMap` island (spec: "office-map-widget" —
 * "Map Rendering", "Tile Source Independence", "Accessible, Supplementary
 * Presentation", "Reduced Motion Compliance", "Attribution Visibility";
 * design: Decisions 1-4).
 *
 * This PR (PR1 of the office-map-widget chain) proves the component fully in
 * isolation — it is not yet mounted on any `.astro` page. `maplibre-gl` is
 * mocked throughout (same `vi.mock` convention `ContactForm.test.tsx` uses
 * for `@cap.js/widget`): jsdom has no WebGL context, so the real library
 * cannot construct a `Map` instance in tests.
 */

const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const TEST_OFFICES: OfficeMapMarker[] = [
  { name: "Langreo (Asturias)", lat: 43.3078225, lon: -5.6961254 },
  { name: "Madrid", lat: 40.465928, lon: -3.6906199 },
];

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

function triggerLoad(instanceIndex = mapInstances.length - 1) {
  const instance = mapInstances[instanceIndex];
  for (const handler of instance?.loadHandlers ?? []) {
    handler();
  }
}

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
    render(<OfficeMap offices={TEST_OFFICES} />);

    expect(mapInstances).toHaveLength(1);
    const style = mapInstances[0]?.options.style;
    expect(style).toBe(OPENFREEMAP_STYLE_URL);
    expect(String(style)).not.toMatch(/carto/i);
  });

  it("never disables the default AttributionControl (attributionControl must not be false)", () => {
    render(<OfficeMap offices={TEST_OFFICES} />);

    expect(mapInstances[0]?.options.attributionControl).not.toBe(false);
  });
});

describe("OfficeMap markers", () => {
  it("adds exactly one Marker+Popup per office, positioned at its coordinates", () => {
    render(<OfficeMap offices={TEST_OFFICES} />);

    expect(markerInstances).toHaveLength(TEST_OFFICES.length);
    for (const [index, office] of TEST_OFFICES.entries()) {
      const marker = markerInstances[index];
      expect(marker?.setLngLat).toHaveBeenCalledWith([office.lon, office.lat]);
      expect(marker?.addTo).toHaveBeenCalled();
    }
    expect(popupInstances.map((p) => p.text)).toEqual(TEST_OFFICES.map((o) => o.name));
  });

  it("shows no other office locations beyond the offices prop", () => {
    render(<OfficeMap offices={[TEST_OFFICES[0]!]} />);

    expect(markerInstances).toHaveLength(1);
  });
});

describe("OfficeMap camera behavior (design Decision 3: no animation, ever)", () => {
  // office-map-widget PR2 deviation: PR1 called `map.fitBounds(...)` inside
  // the async `load` handler. A real built E2E run (see apply-progress)
  // caught a real bug this hid: `map.on("load", ...)` only fires once
  // MapLibre's Web Worker-backed style/tile pipeline finishes — for the
  // window between first paint and that event, both markers rendered at
  // their raw, unfitted projected position (nearly on top of each other on
  // screen for two offices this geographically close relative to zoom 0),
  // which axe's `target-size` rule (WCAG 2.5.8) correctly flagged. Passing
  // `bounds`/`fitBoundsOptions` directly to the `Map` constructor applies
  // the initial camera fit synchronously at construction — no unfitted
  // frame, and still exactly the same `animate:false`, never-`flyTo`/
  // `easeTo` contract.
  it("constructs the Map with the initial bounds and fitBoundsOptions.animate:false, for all users", () => {
    render(<OfficeMap offices={TEST_OFFICES} />);

    const options = mapInstances[0]?.options as {
      bounds?: [number, number, number, number];
      fitBoundsOptions?: { animate: boolean };
    };
    expect(options.bounds).toEqual([-5.6961254, 40.465928, -3.6906199, 43.3078225]);
    expect(options.fitBoundsOptions?.animate).toBe(false);
  });

  it("never calls flyTo, easeTo, or the post-load fitBounds method", () => {
    render(<OfficeMap offices={TEST_OFFICES} />);
    triggerLoad();

    expect(mapInstances[0]?.flyTo).not.toHaveBeenCalled();
    expect(mapInstances[0]?.easeTo).not.toHaveBeenCalled();
    expect(mapInstances[0]?.fitBounds).not.toHaveBeenCalled();
  });

  it("still constructs with animate:false when prefers-reduced-motion is set (no branching by motion preference)", () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMediaMock);

    render(<OfficeMap offices={TEST_OFFICES} />);

    expect(matchMediaMock).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    const options = mapInstances[0]?.options as { fitBoundsOptions?: { animate: boolean } };
    expect(options.fitBoundsOptions?.animate).toBe(false);

    vi.unstubAllGlobals();
  });
});

describe("OfficeMap accessibility and layout", () => {
  // office-map-widget PR2 deviation: `role="img"` was found (via a real,
  // built E2E run — see apply-progress) to trip axe's `nested-interactive`
  // rule, because MapLibre GL's default `Marker` sets `role="button"
  // tabindex="0"` on itself whenever a popup is attached (this maplibre-gl
  // version's own documented accessibility behavior, not something this
  // component opts into) — and ARIA's `img` role forbids focusable
  // descendants. `role="region"` keeps the required accessible name/
  // description (spec: "Accessible, Supplementary Presentation") without
  // that ARIA conflict, since a region landmark may contain interactive
  // content.
  it("exposes role=region and an aria-label naming every office", () => {
    const { container } = render(<OfficeMap offices={TEST_OFFICES} />);

    const region = container.querySelector('[role="region"]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("aria-label", expect.stringContaining("Langreo"));
    expect(region).toHaveAttribute("aria-label", expect.stringContaining("Madrid"));
    expect(container.querySelector('[role="img"]')).toBeNull();
  });

  it("reserves an explicit sized box to avoid CLS", () => {
    const { container } = render(<OfficeMap offices={TEST_OFFICES} />);

    const region = container.querySelector('[role="region"]');
    expect(region?.className).toMatch(/aspect-|min-h-/);
  });
});

describe("OfficeMap lifecycle", () => {
  it("removes the map instance on unmount", () => {
    const { unmount } = render(<OfficeMap offices={TEST_OFFICES} />);
    unmount();

    expect(mapInstances[0]?.remove).toHaveBeenCalledTimes(1);
  });
});
