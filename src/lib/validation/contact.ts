import { z } from "zod";

/**
 * Shared client/server validation for the contact form (`POST /api/contacto`).
 *
 * Field set is the client's final, authoritative 4-field structure: `nombre`,
 * `email`, `telefono`, `mensaje`, plus a required privacy consent checkbox.
 * The richer field set explored in an earlier design draft and in an unrelated
 * Stitch/AI mockup (área de consulta, sede preferente, preferencia de
 * contacto) was explicitly rejected by the client and MUST NOT be reintroduced
 * here (spec: "Form Structure and Field Set").
 *
 * `honeypot` and `capToken` are anti-bot fields (spec: "captcha-verification"),
 * not form-visible content fields — they travel with the same submission
 * payload so the server can validate everything in one pass.
 */
export const ContactSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  telefono: z.string().trim().min(1).max(30),
  mensaje: z.string().trim().min(1).max(5000),
  /** Must be checked — `z.literal(true)` rejects `false`, missing, and any other value. */
  aceptaPrivacidad: z.literal(true),
  /** Hidden field real users never fill; any non-empty value marks the submission as automated. */
  honeypot: z.string().max(0),
  capToken: z.string().min(1),
});

export type ContactFormData = z.infer<typeof ContactSchema>;
