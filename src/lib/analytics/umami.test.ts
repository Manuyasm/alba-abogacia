import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAnalytics, trackContactFormResult, trackEvent } from "./umami";

declare global {
  interface Window {
    umami?: { track: (eventName: string, data?: Record<string, unknown>) => void };
  }
}

afterEach(() => {
  delete window.umami;
});

describe("loadAnalytics", () => {
  it("returns true while the consent-banner requirement remains an open item (gate disabled)", () => {
    expect(loadAnalytics()).toBe(true);
  });

  it("gates on granted consent once the single flip point is enabled", () => {
    expect(loadAnalytics({ granted: false }, true)).toBe(false);
    expect(loadAnalytics({ granted: true }, true)).toBe(true);
  });
});

describe("trackContactFormResult", () => {
  it("fires contact_form_success with no field-value payload", () => {
    const track = vi.fn();
    window.umami = { track };

    trackContactFormResult({ status: "success" });

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("contact_form_success");
  });

  it("fires contact_form_error for an error result", () => {
    const track = vi.fn();
    window.umami = { track };

    trackContactFormResult({ status: "error" });

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("contact_form_error");
  });

  it("does nothing when the Umami script has not loaded (no window.umami)", () => {
    delete window.umami;

    expect(() => trackContactFormResult({ status: "success" })).not.toThrow();
  });
});

describe("trackEvent (design decision #8: generic click-tracking events)", () => {
  it("fires a named event with no additional payload argument", () => {
    const track = vi.fn();
    window.umami = { track };

    trackEvent("phone_click");

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("phone_click");
  });

  it("fires a different event name verbatim (triangulation)", () => {
    const track = vi.fn();
    window.umami = { track };

    trackEvent("appointment_click");

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("appointment_click");
  });

  it("does nothing when the Umami script has not loaded (no window.umami)", () => {
    delete window.umami;

    expect(() => trackEvent("email_click")).not.toThrow();
  });
});
