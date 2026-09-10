/// <reference types="astro/client" />

/**
 * Server-only env vars (no `PUBLIC_` prefix) consumed by
 * `src/pages/api/contacto.ts`. See `env.example` for the full list and the
 * open items (`CONTACT_RECIPIENT_EMAIL`, `CONTACT_EMAIL_RETENTION_DAYS`)
 * that must be confirmed before production use.
 */
interface ImportMetaEnv {
  readonly CAP_API_URL: string;
  readonly PUBLIC_CAP_SITE_KEY: string;
  readonly CAP_SECRET_KEY: string;
  readonly CONTACT_RECIPIENT_EMAIL: string;
}
