import { afterEach, describe, expect, it, vi } from "vitest";
import { initClickTracking, TRACKED_CLICK_EVENT_NAMES } from "./click-tracking";
import * as umami from "./umami";

/**
 * Unit tests for the fail-open Umami click-tracking utility (design decision
 * #8, "Umami click events" — generic `trackEvent(name)` + `[data-track]`
 * attribute convention, one listener per matched element attached exactly
 * once so a single click can never fire the event more than once).
 */

function buildTrackedElement(eventName: string): { root: HTMLElement; element: HTMLElement } {
  const root = document.createElement("div");
  const element = document.createElement("a");
  element.setAttribute("data-track", eventName);
  root.appendChild(element);
  return { root, element };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TRACKED_CLICK_EVENT_NAMES — resolved scope allowlist", () => {
  it("contains exactly phone_click, email_click, appointment_click (whatsapp_click/office_selection/service_view are out of scope)", () => {
    expect(TRACKED_CLICK_EVENT_NAMES).toEqual(["phone_click", "email_click", "appointment_click"]);
  });
});

describe("initClickTracking — no [data-track] elements present", () => {
  it("returns a callable no-op disconnect() and never throws", () => {
    const root = document.createElement("div");

    const disconnect = initClickTracking(root);

    expect(() => disconnect()).not.toThrow();
  });
});

describe("initClickTracking — firing", () => {
  it("fires the matching event exactly once when a tracked element is clicked", () => {
    const trackEventSpy = vi.spyOn(umami, "trackEvent").mockImplementation(() => {});
    const { root, element } = buildTrackedElement("phone_click");

    initClickTracking(root);
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(trackEventSpy).toHaveBeenCalledTimes(1);
    expect(trackEventSpy).toHaveBeenCalledWith("phone_click");
  });

  it("fires a different tracked event name verbatim (triangulation)", () => {
    const trackEventSpy = vi.spyOn(umami, "trackEvent").mockImplementation(() => {});
    const { root, element } = buildTrackedElement("email_click");

    initClickTracking(root);
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(trackEventSpy).toHaveBeenCalledTimes(1);
    expect(trackEventSpy).toHaveBeenCalledWith("email_click");
  });

  it("does not fire more than once for a single click, even when the element is inside a bubbling tree", () => {
    const trackEventSpy = vi.spyOn(umami, "trackEvent").mockImplementation(() => {});
    const { root, element } = buildTrackedElement("appointment_click");
    const child = document.createElement("span");
    element.appendChild(child);

    initClickTracking(root);
    child.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(trackEventSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores an element whose data-track value is not a recognized click-tracked event name", () => {
    const trackEventSpy = vi.spyOn(umami, "trackEvent").mockImplementation(() => {});
    const { root, element } = buildTrackedElement("whatsapp_click");

    initClickTracking(root);
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(trackEventSpy).not.toHaveBeenCalled();
  });
});

describe("initClickTracking — disconnect", () => {
  it("returns a disconnect() that removes the click listener and is idempotent", () => {
    const trackEventSpy = vi.spyOn(umami, "trackEvent").mockImplementation(() => {});
    const { root, element } = buildTrackedElement("phone_click");

    const disconnect = initClickTracking(root);
    disconnect();
    disconnect(); // idempotent, must not throw or double-detach

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(trackEventSpy).not.toHaveBeenCalled();
  });
});
