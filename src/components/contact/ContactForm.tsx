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
import { trackContactFormResult } from "@/lib/analytics/umami";

/**
 * Reusable contact form island (spec: "Form Structure and Field Set", "Field
 * Validation", "Accessibility"; design rev.2 — single component mounted both
 * standalone on `contacto.astro` and embedded in `index.astro#contacto`).
 *
 * Scope of THIS PR (PR3 of 5, stacked-to-main): the form's structure, client-side
 * validation, and submit handler are complete and unit-tested against a mocked
 * `fetch` — `src/pages/api/contacto.ts` does not exist yet (PR4). The Cap widget
 * itself is also PR4's concern: this component only exposes a designated mount
 * point (`data-testid="cap-widget-slot"`) and listens for the `solve` custom
 * event that a mounted `<cap-widget>` element dispatches with `{ token }`, per
 * Cap.js's documented client contract. Umami events fire only after the server
 * response resolves (spec: "Post-Confirmation Umami Event Firing") — never on
 * raw submit, matching the "server-confirmed only" contract established in PR2's
 * `trackContactFormResult`.
 */

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
  "Gracias por su mensaje. Nos pondremos en contacto con usted lo antes posible.";

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const FIELD_BASE_CLASSES =
  "w-full rounded-md border border-border bg-paper px-4 py-2 text-ink transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2";

const LINK_CLASSES =
  "font-medium text-brand-red underline underline-offset-2 transition-colors duration-200 motion-reduce:transition-none hover:text-brand-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red";

export function ContactForm({ className }: ContactFormProps) {
  const uid = useId();
  const [values, setValues] = useState<ContactFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const nombreRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const telefonoRef = useRef<HTMLInputElement>(null);
  const mensajeRef = useRef<HTMLTextAreaElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const capSlotRef = useRef<HTMLDivElement>(null);

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

  // Listens for the `solve` event a mounted Cap widget dispatches on its own
  // element (`{ detail: { token } }`, per Cap.js's client contract). Mounting
  // the actual widget script is PR4's concern (`src/pages/api/contacto.ts`
  // wiring) — this slot only needs to exist and be listened to.
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

    container.addEventListener("solve", handleSolve);
    return () => container.removeEventListener("solve", handleSolve);
  }, [handleChange]);

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
            aria-invalid={Boolean(errors.nombre)}
            aria-describedby={errors.nombre ? nombreErrorId : undefined}
            className={cx(FIELD_BASE_CLASSES, errors.nombre && "border-error")}
          />
          {errors.nombre && (
            <p id={nombreErrorId} role="alert" className="text-sm text-error">
              {errors.nombre}
            </p>
          )}
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
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? emailErrorId : undefined}
            className={cx(FIELD_BASE_CLASSES, errors.email && "border-error")}
          />
          {errors.email && (
            <p id={emailErrorId} role="alert" className="text-sm text-error">
              {errors.email}
            </p>
          )}
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
            aria-invalid={Boolean(errors.telefono)}
            aria-describedby={errors.telefono ? telefonoErrorId : undefined}
            className={cx(FIELD_BASE_CLASSES, errors.telefono && "border-error")}
          />
          {errors.telefono && (
            <p id={telefonoErrorId} role="alert" className="text-sm text-error">
              {errors.telefono}
            </p>
          )}
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
            aria-invalid={Boolean(errors.mensaje)}
            aria-describedby={errors.mensaje ? mensajeErrorId : undefined}
            className={cx(FIELD_BASE_CLASSES, errors.mensaje && "border-error")}
          />
          {errors.mensaje && (
            <p id={mensajeErrorId} role="alert" className="text-sm text-error">
              {errors.mensaje}
            </p>
          )}
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
            aria-invalid={Boolean(errors.aceptaPrivacidad)}
            aria-describedby={errors.aceptaPrivacidad ? consentErrorId : undefined}
            className={cx(
              "mt-1 h-6 w-6 shrink-0 rounded border-brand-brown text-brand-red transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2",
              errors.aceptaPrivacidad && "border-error",
            )}
          />
          <label htmlFor={consentId} className="text-sm text-ink">
            He leído y acepto la{" "}
            <a href="/politica-privacidad" className={LINK_CLASSES}>
              Política de privacidad
            </a>
          </label>
        </div>
        {errors.aceptaPrivacidad && (
          <p id={consentErrorId} role="alert" className="text-sm text-error">
            {errors.aceptaPrivacidad}
          </p>
        )}

        <div>
          {/* Designated Cap widget mount point (design rev.2 / spec: "Server-Side
              Cap Token Verification"). PR4 mounts the actual `<cap-widget>`
              custom element here and wires `src/pages/api/contacto.ts`; this PR
              only listens for its `solve` event on this container. */}
          <div ref={capSlotRef} data-testid="cap-widget-slot" className="my-2 min-h-[2px]" />
          {errors.capToken && (
            <p id={capTokenErrorId} role="alert" className="text-sm text-error">
              {errors.capToken}
            </p>
          )}
        </div>

        {serverError && (
          <p
            role="alert"
            aria-live="assertive"
            className="rounded-md border border-error bg-error/10 px-4 py-3 text-sm text-error"
          >
            {serverError}
          </p>
        )}
        {successMessage && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-md border border-success bg-success/10 px-4 py-3 text-sm text-success"
          >
            {successMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={cx(
            "inline-flex min-h-11 items-center justify-center rounded-md bg-brand-red px-6 py-3 font-medium text-paper transition-colors duration-200 motion-reduce:transition-none hover:bg-brand-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {isSubmitting ? "Enviando…" : "Enviar mensaje"}
        </button>
      </form>
    </section>
  );
}
