import "@cap.js/widget";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
  type SubmitEvent,
} from "react";
import { ContactSchema, type ContactFormData } from "@/lib/validation/contact";
import { trackContactFormResult, trackEvent } from "@/lib/analytics/umami";

/**
 * Reusable contact form island (spec: "Form Structure and Field Set", "Field
 * Validation", "Accessibility"; design rev.2 — single component mounted both
 * standalone on `contacto.astro` and embedded in `index.astro#contacto`).
 *
 * The form's structure, client-side validation, and submit handler post to
 * `src/pages/api/contacto.ts`. The Cap widget is mounted directly by this
 * component: `import "@cap.js/widget"` registers the `cap-widget` custom
 * element (a no-op during Astro's server-side prerendering, since the
 * package itself guards on `typeof window === "undefined"`).
 *
 * The `<cap-widget>` element itself is created and appended **imperatively**
 * inside a `useEffect`, never rendered as JSX (PR5 fix — see apply-progress
 * "React hydration mismatch" finding). The real widget's own
 * `connectedCallback` synchronously mutates its light DOM (it injects a
 * hidden `<input type="hidden" name="cap-token">` child, per `src/cap.js`)
 * the instant the browser upgrades the custom element — which happens
 * during the browser's initial HTML parse of the server-rendered markup,
 * before React ever hydrates. If the tag were server-rendered via JSX,
 * React would hydrate expecting zero children on that node while the real
 * DOM already has one, producing a genuine hydration-mismatch error (caught
 * only by a real-browser E2E test, since jsdom's mocked widget never
 * performs this mutation). Creating the element only after hydration
 * completes (client-only, inside an effect) means React never owns or
 * diffs its children at all.
 *
 * This component listens for the `solve` custom event the widget dispatches
 * with `{ token }` — `bubbles: true, composed: true` per Cap.js's own
 * implementation — so the listener on the slot catches it regardless of
 * whether it bubbles up from the widget or (as in tests) is dispatched
 * directly on the slot. Result Umami events (`contact_form_success`/
 * `contact_form_error`) fire only after the server response resolves (spec:
 * "Post-Confirmation Umami Event Firing") — never on raw submit, matching
 * the "server-confirmed only" contract established in PR2's
 * `trackContactFormResult`. The one exception is `contact_form_started`
 * (spec: "analytics-events" — "Confirmed Umami Event Set Only"), which fires
 * on the user's first field focus, deduped per mount via a `useRef` flag so
 * it never re-fires for later interactions on the same form instance.
 */

/**
 * Builds the `data-cap-api-endpoint` value from the `PUBLIC_`-prefixed env
 * vars (see `src/env.d.ts`), matching the `{apiUrl}/{siteKey}/` convention
 * `src/lib/captcha/verify.ts` already uses server-side for `/siteverify`.
 * Returns `undefined` when either var is unset, so the widget mounts without
 * a (guaranteed-invalid) endpoint rather than pointing at a broken URL.
 */
function buildCapWidgetEndpoint(apiUrl: string, siteKey: string): string | undefined {
  if (!apiUrl || !siteKey) {
    return undefined;
  }
  const base = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
  return `${base}/${siteKey}/`;
}

export interface ContactFormProps {
  /** Optional layout hook only — e.g. Home's `#contacto` section vs the standalone page. */
  className?: string;
}

interface ContactFormValues {
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
  aceptaPrivacidad: boolean;
  /** Hidden anti-bot field — always empty for real users. */
  honeypot: string;
  /** Populated only once the Cap widget (mounted by PR4) dispatches a `solve` event. */
  capToken: string;
}

type FieldName = keyof ContactFormValues;
type SubmitStatus = "idle" | "submitting" | "success" | "error";

const INITIAL_VALUES: ContactFormValues = {
  nombre: "",
  email: "",
  telefono: "",
  mensaje: "",
  aceptaPrivacidad: false,
  honeypot: "",
  capToken: "",
};

/**
 * User-facing field error messages, kept independent of Zod's own issue
 * messages so copy stays in Spanish and under our control. `honeypot` is
 * intentionally excluded — revealing its existence to a bot defeats it
 * (spec: "Honeypot filled ... rejected without revealing the honeypot's
 * existence").
 */
const FIELD_ERROR_MESSAGES: Partial<Record<FieldName, string>> = {
  nombre: "Introduzca su nombre.",
  email: "Introduzca una dirección de correo electrónico válida.",
  telefono: "Introduzca un teléfono de contacto.",
  mensaje: "Escriba su mensaje.",
  aceptaPrivacidad: "Debe aceptar la Política de privacidad para continuar.",
  capToken: "Complete la verificación de seguridad antes de enviar el formulario.",
};

/** Order in which invalid fields receive focus after a blocked submission. */
const FOCUS_ORDER: FieldName[] = [
  "nombre",
  "email",
  "telefono",
  "mensaje",
  "aceptaPrivacidad",
  "capToken",
];

const GENERIC_ERROR_MESSAGE =
  "No se ha podido enviar el formulario. Inténtelo de nuevo en unos minutos.";
const SUCCESS_MESSAGE =
  "Su consulta se ha enviado correctamente. Nos pondremos en contacto con usted lo antes posible.";
const CAP_VERIFIED_MESSAGE = "Verificación completada.";

/**
 * Reserved-space, always-rendered field error message (animations-v2 PR E,
 * "validation-error state"). The paragraph itself is never conditionally
 * mounted/unmounted — only its text and opacity change — so an error
 * appearing never causes an abrupt layout jump: the `min-h` reserves the
 * line's height up front, and the opacity transition is the only visible
 * change. `aria-describedby` on the field is therefore always valid (design:
 * "aria-describedby unconditional").
 */
function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p
      id={id}
      role={message ? "alert" : undefined}
      className="min-h-[1.25rem] text-sm text-error opacity-0 transition-opacity duration-200 motion-reduce:transition-none data-[has-error=true]:opacity-100"
      data-has-error={Boolean(message)}
    >
      {message ?? ""}
    </p>
  );
}

/** Discreet inline check glyph for the success state (animations-v2 PR E). */
function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      <path d="M4 10.5 8 14.5 16 6" />
    </svg>
  );
}

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const FIELD_BASE_CLASSES =
  "w-full rounded-md border border-border bg-paper px-4 py-2 text-ink transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2";

const LINK_CLASSES =
  "font-medium text-brand-red underline underline-offset-2 transition-colors duration-200 motion-reduce:transition-none hover:text-brand-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red";

export function ContactForm({ className }: ContactFormProps) {
  const uid = useId();
  const capWidgetEndpoint = buildCapWidgetEndpoint(
    import.meta.env.PUBLIC_CAP_API_URL ?? "",
    import.meta.env.PUBLIC_CAP_SITE_KEY ?? "",
  );
  const [values, setValues] = useState<ContactFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  /** Tracks whether the user has attempted at least one submission — the
   * "valid-field state" (animations-v2 PR E) only ever appears once a field
   * has actually been validated, never optimistically on first render. */
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const nombreRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telefonoRef = useRef<HTMLInputElement>(null);
  const mensajeRef = useRef<HTMLTextAreaElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const capSlotRef = useRef<HTMLDivElement>(null);
  /** One-shot dedup flag for `contact_form_started` (spec: "Started fires
   * once per session interaction") — set on the first field focus and never
   * reset for the lifetime of this mount, so later focuses/edits (including
   * a post-success form reset) never re-fire it. */
  const hasStartedFormRef = useRef(false);

  const focusRefs: Partial<Record<FieldName, RefObject<HTMLElement | null>>> = {
    nombre: nombreRef,
    email: emailRef,
    telefono: telefonoRef,
    mensaje: mensajeRef,
    aceptaPrivacidad: consentRef,
  };

  const handleChange = useCallback(
    <K extends FieldName>(field: K, value: ContactFormValues[K]) => {
      setValues((previous) => ({ ...previous, [field]: value }));
      setErrors((previous) => {
        if (!(field in previous)) {
          return previous;
        }
        const next = { ...previous };
        delete next[field];
        return next;
      });
    },
    [],
  );

  /**
   * Fires `contact_form_started` (spec: "analytics-events" — "Confirmed
   * Umami Event Set Only") on the user's first focus into any visible
   * ContactForm field. Guarded by `hasStartedFormRef` so subsequent focuses
   * — on the same field or a different one — never re-fire it for this
   * mount (spec scenario: "Started fires once per session interaction").
   * A bare named event, same as `contact_form_success`/`contact_form_error`
   * — no field value or other property is ever attached.
   */
  const handleFirstInteraction = useCallback(() => {
    if (hasStartedFormRef.current) {
      return;
    }
    hasStartedFormRef.current = true;
    trackEvent("contact_form_started");
  }, []);

  // Creates and appends the real `<cap-widget>` element imperatively
  // (client-only, post-hydration) — see the file-level doc comment for why
  // this must never be server-rendered JSX. Also listens for the `solve`
  // event the widget dispatches on itself (`{ detail: { token } }`,
  // `bubbles: true` per Cap.js's own implementation), so the listener on
  // the slot catches it whether it bubbles up from the widget or is
  // dispatched directly on the slot (as tests do).
  useEffect(() => {
    const container = capSlotRef.current;
    if (!container) {
      return;
    }

    function handleSolve(event: Event) {
      const detail = (event as CustomEvent<{ token?: string }>).detail;
      if (detail?.token) {
        handleChange("capToken", detail.token);
      }
    }

    const widget = document.createElement("cap-widget");
    if (capWidgetEndpoint) {
      widget.setAttribute("data-cap-api-endpoint", capWidgetEndpoint);
    }
    container.addEventListener("solve", handleSolve);
    container.appendChild(widget);

    return () => {
      container.removeEventListener("solve", handleSolve);
      if (widget.parentNode === container) {
        container.removeChild(widget);
      }
    };
  }, [handleChange, capWidgetEndpoint]);

  /**
   * CSS-only "valid-field state" (animations-v2 PR E): a subtle success
   * border, shown only once the user has attempted a submission and this
   * specific field currently has no error. Never shown before the first
   * submit attempt, so a blank untouched field is never marked "valid".
   */
  function fieldStateClasses(field: FieldName): string | false {
    if (errors[field]) {
      return "border-error";
    }
    return hasAttemptedSubmit && "border-success";
  }

  function focusFirstInvalidField(fieldErrors: Partial<Record<FieldName, string>>) {
    for (const field of FOCUS_ORDER) {
      const ref = focusRefs[field];
      if (fieldErrors[field] && ref?.current) {
        ref.current.focus();
        return;
      }
    }
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setSuccessMessage(null);
    setHasAttemptedSubmit(true);

    const result = ContactSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Partial<Record<FieldName, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as FieldName | undefined;
        if (field && FIELD_ERROR_MESSAGES[field] && !fieldErrors[field]) {
          fieldErrors[field] = FIELD_ERROR_MESSAGES[field];
        }
      }
      setErrors(fieldErrors);
      focusFirstInvalidField(fieldErrors);
      return;
    }

    setErrors({});
    setStatus("submitting");

    const payload: ContactFormData = result.data;

    try {
      const response = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setStatus("success");
        setSuccessMessage(SUCCESS_MESSAGE);
        setValues(INITIAL_VALUES);
        setHasAttemptedSubmit(false);
        trackContactFormResult({ status: "success" });
      } else {
        setStatus("error");
        setServerError(GENERIC_ERROR_MESSAGE);
        trackContactFormResult({ status: "error" });
      }
    } catch {
      setStatus("error");
      setServerError(GENERIC_ERROR_MESSAGE);
      trackContactFormResult({ status: "error" });
    }
  }

  const headingId = `${uid}-heading`;
  const nombreId = `${uid}-nombre`;
  const nombreErrorId = `${uid}-nombre-error`;
  const emailId = `${uid}-email`;
  const emailErrorId = `${uid}-email-error`;
  const telefonoId = `${uid}-telefono`;
  const telefonoErrorId = `${uid}-telefono-error`;
  const mensajeId = `${uid}-mensaje`;
  const mensajeErrorId = `${uid}-mensaje-error`;
  const consentId = `${uid}-consent`;
  const consentErrorId = `${uid}-consent-error`;
  const capTokenErrorId = `${uid}-cap-token-error`;
  const honeypotId = `${uid}-empresa`;

  const isSubmitting = status === "submitting";

  return (
    <section aria-labelledby={headingId} className={cx("flex flex-col gap-6", className)}>
      <h2 id={headingId} className="text-2xl font-semibold text-ink md:text-3xl">
        Póngase en contacto con nosotros y descubra cómo podemos ayudarle
      </h2>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={nombreId} className="font-medium text-ink">
            Nombre
          </label>
          <input
            id={nombreId}
            ref={nombreRef}
            name="nombre"
            type="text"
            autoComplete="name"
            value={values.nombre}
            onChange={(event) => handleChange("nombre", event.target.value)}
            onFocus={handleFirstInteraction}
            aria-invalid={Boolean(errors.nombre)}
            aria-describedby={nombreErrorId}
            className={cx(FIELD_BASE_CLASSES, fieldStateClasses("nombre"))}
          />
          <FieldError id={nombreErrorId} message={errors.nombre} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={emailId} className="font-medium text-ink">
            Email
          </label>
          <input
            id={emailId}
            ref={emailRef}
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => handleChange("email", event.target.value)}
            onFocus={handleFirstInteraction}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={emailErrorId}
            className={cx(FIELD_BASE_CLASSES, fieldStateClasses("email"))}
          />
          <FieldError id={emailErrorId} message={errors.email} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={telefonoId} className="font-medium text-ink">
            Teléfono
          </label>
          <input
            id={telefonoId}
            ref={telefonoRef}
            name="telefono"
            type="tel"
            autoComplete="tel"
            value={values.telefono}
            onChange={(event) => handleChange("telefono", event.target.value)}
            onFocus={handleFirstInteraction}
            aria-invalid={Boolean(errors.telefono)}
            aria-describedby={telefonoErrorId}
            className={cx(FIELD_BASE_CLASSES, fieldStateClasses("telefono"))}
          />
          <FieldError id={telefonoErrorId} message={errors.telefono} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={mensajeId} className="font-medium text-ink">
            Mensaje
          </label>
          <textarea
            id={mensajeId}
            ref={mensajeRef}
            name="mensaje"
            rows={5}
            value={values.mensaje}
            onChange={(event) => handleChange("mensaje", event.target.value)}
            onFocus={handleFirstInteraction}
            aria-invalid={Boolean(errors.mensaje)}
            aria-describedby={mensajeErrorId}
            className={cx(FIELD_BASE_CLASSES, fieldStateClasses("mensaje"))}
          />
          <FieldError id={mensajeErrorId} message={errors.mensaje} />
        </div>

        {/* Honeypot: invisible to real users (off-screen, aria-hidden, out of tab
            order). Any non-empty value marks the submission as automated (spec:
            "Rate Limiting and Honeypot"). No <label> — real users never see it. */}
        <input
          id={honeypotId}
          name="empresa"
          type="text"
          value={values.honeypot}
          onChange={(event) => handleChange("honeypot", event.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          autoComplete="off"
          className="absolute -left-[9999px] h-px w-px overflow-hidden"
        />

        <div className="flex items-start gap-3">
          <input
            id={consentId}
            ref={consentRef}
            type="checkbox"
            checked={values.aceptaPrivacidad}
            onChange={(event) => handleChange("aceptaPrivacidad", event.target.checked)}
            onFocus={handleFirstInteraction}
            aria-invalid={Boolean(errors.aceptaPrivacidad)}
            aria-describedby={consentErrorId}
            className={cx(
              "mt-1 h-6 w-6 shrink-0 rounded border-brand-brown text-brand-red transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2",
              fieldStateClasses("aceptaPrivacidad"),
            )}
          />
          <label htmlFor={consentId} className="text-sm text-ink">
            He leído y acepto la{" "}
            <a href="/politica-privacidad" className={LINK_CLASSES}>
              Política de privacidad
            </a>
          </label>
        </div>
        <FieldError id={consentErrorId} message={errors.aceptaPrivacidad} />

        <div>
          {/* Designated Cap widget mount point (design rev.2 / spec: "Server-Side
              Cap Token Verification"). Left empty in JSX on purpose — the real
              `<cap-widget>` custom element (registered by the `@cap.js/widget`
              side-effect import at the top of this file) is created and
              appended imperatively by the effect above, only after hydration
              completes, to avoid a React hydration mismatch (see file-level
              doc comment). Pointed at the local self-hosted Cap instance from
              PR1's docker-compose via `PUBLIC_CAP_API_URL` /
              `PUBLIC_CAP_SITE_KEY`. Server-side verification against the same
              instance is wired in `src/pages/api/contacto.ts`. */}
          <div ref={capSlotRef} data-testid="cap-widget-slot" className="my-2 min-h-[2px]" />
          {/* Discreet Cap-verification state (animations-v2 PR E): a
              CSS-only fade-in confirmation once the widget reports a solved
              token — cleared again on the next successful submission along
              with every other field, since `values.capToken` resets to "". */}
          {values.capToken && (
            <p className="animate-fade-in motion-reduce:animate-none flex items-center gap-1 text-sm text-success">
              <CheckIcon />
              {CAP_VERIFIED_MESSAGE}
            </p>
          )}
          <FieldError id={capTokenErrorId} message={errors.capToken} />
        </div>

        {serverError && (
          <p
            role="alert"
            aria-live="assertive"
            className="animate-fade-in motion-reduce:animate-none rounded-md border border-error bg-error/10 px-4 py-3 text-sm text-error"
          >
            {serverError}
          </p>
        )}
        {successMessage && (
          <p
            role="status"
            aria-live="polite"
            className="animate-fade-in motion-reduce:animate-none flex items-center gap-2 rounded-md border border-success bg-success/10 px-4 py-3 text-sm text-success"
          >
            <CheckIcon />
            {successMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={cx(
            "inline-flex min-h-11 items-center justify-center rounded-md bg-brand-red px-6 py-3 font-medium text-paper transition-interactive motion-reduce:transition-none hover:bg-brand-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {isSubmitting ? "Enviando…" : "Enviar mensaje"}
        </button>
      </form>
    </section>
  );
}
