import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContactForm } from "./ContactForm";
import { trackContactFormResult } from "@/lib/analytics/umami";

/**
 * Component tests for the reusable ContactForm island (spec: "Form Structure and
 * Field Set", "Field Validation", "Accessibility"; design rev.2 `ContactFormProps`).
 *
 * This PR (PR3) builds the form in isolation — `src/pages/api/contacto.ts` does not
 * exist yet (PR4 wires it). `fetch` is mocked throughout; no real network call is made.
 * Umami tracking is also mocked so we can assert the "server-confirmed only" contract
 * (spec: "Post-Confirmation Umami Event Firing") without depending on `window.umami`.
 */

vi.mock("@/lib/analytics/umami", () => ({
  trackContactFormResult: vi.fn(),
}));

// The real `@cap.js/widget` package registers a `cap-widget` custom element
// whose `connectedCallback` spawns Web Workers and attempts real network
// calls — none of which jsdom supports safely. Mocking it to a no-op module
// keeps the side-effect `import "@cap.js/widget"` in ContactForm.tsx from
// ever running real browser-only logic in tests; only the plain
// `<cap-widget>` tag and its attributes are observable here, which is
// exactly what these tests assert.
vi.mock("@cap.js/widget", () => ({}));

const HEADING_TEXT = "Póngase en contacto con nosotros y descubra cómo podemos ayudarle";
const CONSENT_LABEL_TEXT = /He leído y acepto la Política de privacidad/i;
const SUBMIT_BUTTON_NAME = /enviar/i;
const VALID_CAP_TOKEN = "test-site-key:challenge:solution";

function solveCapWidget(container: HTMLElement, token: string = VALID_CAP_TOKEN) {
  const capSlot = container.querySelector('[data-testid="cap-widget-slot"]');
  if (!capSlot) {
    throw new Error("cap-widget-slot not found — the designated Cap mount point is missing");
  }
  act(() => {
    capSlot.dispatchEvent(new CustomEvent("solve", { detail: { token } }));
  });
}

/**
 * Dispatches `solve` on the real mounted `<cap-widget>` element itself (not
 * its wrapping slot), with `bubbles: true` — matching Cap.js's own
 * `dispatchEvent` implementation (`bubbles: true, composed: true`), to prove
 * the slot's listener correctly receives it via bubbling in production, not
 * only when a test dispatches directly on the slot.
 */
function solveMountedCapWidgetElement(container: HTMLElement, token: string = VALID_CAP_TOKEN) {
  const widget = container.querySelector('[data-testid="cap-widget-slot"] cap-widget');
  if (!widget) {
    throw new Error("cap-widget element not found inside the designated slot");
  }
  act(() => {
    widget.dispatchEvent(new CustomEvent("solve", { detail: { token }, bubbles: true }));
  });
}

function fillValidVisibleFields() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana Pérez" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
  fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "600123456" } });
  fireEvent.change(screen.getByLabelText("Mensaje"), {
    target: { value: "Necesito asesoría legal para un asunto familiar." },
  });
  fireEvent.click(screen.getByLabelText(CONSENT_LABEL_TEXT));
}

beforeEach(() => {
  vi.mocked(trackContactFormResult).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ContactForm structure and field set", () => {
  it("renders the section heading and exactly the authoritative 4 fields + consent checkbox", () => {
    render(<ContactForm />);

    expect(screen.getByRole("heading", { name: HEADING_TEXT })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Teléfono")).toHaveAttribute("type", "tel");
    expect(screen.getByLabelText("Mensaje").tagName).toBe("TEXTAREA");
  });

  it("renders the consent checkbox with 'Política de privacidad' as a link to /politica-privacidad", () => {
    render(<ContactForm />);

    const checkbox = screen.getByLabelText(CONSENT_LABEL_TEXT);
    expect(checkbox).toHaveAttribute("type", "checkbox");

    const link = screen.getByRole("link", { name: "Política de privacidad" });
    expect(link).toHaveAttribute("href", "/politica-privacidad");
  });

  it("keeps the honeypot field hidden from the accessible role tree and out of the tab order", () => {
    const { container } = render(<ContactForm />);

    const honeypot = container.querySelector('input[name="empresa"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
    // The honeypot must never appear among the 4 visible textbox fields.
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
  });

  it("includes a designated Cap widget mount point near the submit button", () => {
    const { container } = render(<ContactForm />);

    const submitButton = screen.getByRole("button", { name: SUBMIT_BUTTON_NAME });
    const capSlot = container.querySelector('[data-testid="cap-widget-slot"]');
    expect(capSlot).not.toBeNull();
    // "Near the submit button": both live inside the same form element.
    expect(submitButton.closest("form")).toContainElement(capSlot as HTMLElement);
  });

  it("accepts only an optional className layout prop, with no page-specific props required", () => {
    const { container: withoutProp } = render(<ContactForm />);
    expect(withoutProp.firstElementChild).not.toBeNull();

    const { container: withProp } = render(<ContactForm className="custom-wrapper" />);
    expect(withProp.firstElementChild).toHaveClass("custom-wrapper");
  });
});

describe("ContactForm Cap widget mounting", () => {
  it("mounts a <cap-widget> element inside the designated slot, pointed at the configured Cap endpoint", () => {
    vi.stubEnv("PUBLIC_CAP_API_URL", "http://localhost:3000");
    vi.stubEnv("PUBLIC_CAP_SITE_KEY", "test-site-key");

    const { container } = render(<ContactForm />);

    const slot = container.querySelector('[data-testid="cap-widget-slot"]');
    const widget = slot?.querySelector("cap-widget");
    expect(widget).not.toBeNull();
    expect(widget).toHaveAttribute(
      "data-cap-api-endpoint",
      "http://localhost:3000/test-site-key/",
    );
  });

  it("mounts the <cap-widget> element without a data-cap-api-endpoint attribute when the Cap env vars are unset", () => {
    vi.stubEnv("PUBLIC_CAP_API_URL", "");
    vi.stubEnv("PUBLIC_CAP_SITE_KEY", "");

    const { container } = render(<ContactForm />);

    const widget = container.querySelector('[data-testid="cap-widget-slot"] cap-widget');
    expect(widget).not.toBeNull();
    expect(widget).not.toHaveAttribute("data-cap-api-endpoint");
  });

  it("populates capToken from a solve event dispatched on the real mounted <cap-widget> element (bubbling, matching Cap.js's own dispatch contract)", async () => {
    vi.stubEnv("PUBLIC_CAP_API_URL", "http://localhost:3000");
    vi.stubEnv("PUBLIC_CAP_SITE_KEY", "test-site-key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<ContactForm />);

    fillValidVisibleFields();
    solveMountedCapWidgetElement(container);
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BUTTON_NAME }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.capToken).toBe(VALID_CAP_TOKEN);
  });
});

describe("ContactForm client-side validation", () => {
  it("blocks submission on empty fields, announces an error linked via aria-describedby, and moves focus to nombre", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ContactForm />);

    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BUTTON_NAME }));

    const nombreInput = screen.getByLabelText("Nombre");
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
    expect(nombreInput).toHaveAttribute("aria-describedby", alerts[0]!.id);
    expect(nombreInput).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks submission when the consent checkbox is unchecked, even with valid fields", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana Pérez" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "600123456" } });
    fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Consulta." } });
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BUTTON_NAME }));

    expect(screen.getByLabelText(CONSENT_LABEL_TEXT)).not.toBeChecked();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks submission when the Cap widget has not been solved yet, even with all other fields valid", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ContactForm />);

    fillValidVisibleFields();
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BUTTON_NAME }));

    expect(screen.getByText(/verificación de seguridad/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("ContactForm submission (mocked fetch — no real /api/contacto in this PR)", () => {
  it("submits the validated payload to /api/contacto only after the Cap widget resolves a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<ContactForm />);

    fillValidVisibleFields();
    solveCapWidget(container);
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BUTTON_NAME }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/contacto");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string);
    expect(body).toMatchObject({
      nombre: "Ana Pérez",
      email: "ana@example.com",
      telefono: "600123456",
      mensaje: "Necesito asesoría legal para un asunto familiar.",
      aceptaPrivacidad: true,
      honeypot: "",
    });
    expect(body.capToken).toBe(VALID_CAP_TOKEN);
  });

  it("does not fire an Umami event while the request is in flight, only after it resolves", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<ContactForm />);

    fillValidVisibleFields();
    solveCapWidget(container);
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BUTTON_NAME }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(trackContactFormResult).not.toHaveBeenCalled();

    resolveFetch({ ok: true, json: async () => ({}) });
    await waitFor(() =>
      expect(trackContactFormResult).toHaveBeenCalledWith({ status: "success" }),
    );
  });

  it("shows a success message and fires contact_form_success after a confirmed 2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<ContactForm />);

    fillValidVisibleFields();
    solveCapWidget(container);
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BUTTON_NAME }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/gracias/i));
    expect(trackContactFormResult).toHaveBeenCalledWith({ status: "success" });
  });

  it("shows a generic error message and fires contact_form_error on a non-2xx response, without leaking server details", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, json: async () => ({ code: "VALIDATION" }) });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<ContactForm />);

    fillValidVisibleFields();
    solveCapWidget(container);
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BUTTON_NAME }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/no se ha podido enviar/i));
    expect(screen.queryByText(/VALIDATION/)).not.toBeInTheDocument();
    expect(trackContactFormResult).toHaveBeenCalledWith({ status: "error" });
  });

  it("shows a generic error message and fires contact_form_error when the network request itself fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<ContactForm />);

    fillValidVisibleFields();
    solveCapWidget(container);
    fireEvent.click(screen.getByRole("button", { name: SUBMIT_BUTTON_NAME }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/no se ha podido enviar/i));
    expect(trackContactFormResult).toHaveBeenCalledWith({ status: "error" });
  });
});
