/// <reference types="astro/client" />

/**
 * Server-only env vars (no `PUBLIC_` prefix) consumed by
 * `src/pages/api/contacto.ts`, plus the `PUBLIC_`-prefixed vars the browser
 * bundle needs to mount the client-side Cap widget
 * (`src/components/contact/ContactForm.tsx`). See `env.example` for the full
 * list and the open items (`CONTACT_RECIPIENT_EMAIL`,
 * `CONTACT_EMAIL_RETENTION_DAYS`) that must be confirmed before production use.
 */
interface ImportMetaEnv {
  readonly CAP_API_URL: string;
  /**
   * Browser-reachable base URL of the Cap instance, used only by the
   * client-side widget's `data-cap-api-endpoint` attribute. Distinct from
   * `CAP_API_URL` (the Astro server's own view of Cap, used for
   * `/siteverify`) because the two processes can sit behind different
   * network paths — e.g. a server-side Docker service name vs. a
   * public/reverse-proxied hostname the browser can actually reach.
   */
  readonly PUBLIC_CAP_API_URL: string;
  readonly PUBLIC_CAP_SITE_KEY: string;
  readonly CAP_SECRET_KEY: string;
  readonly CONTACT_RECIPIENT_EMAIL: string;
  /**
   * Dev/E2E-only opt-in (see `src/pages/api/contacto.ts`'s
   * `resolveEmailTransport`): when exactly `"true"`, swaps in an
   * always-succeeding test email transport so the real pipeline can be
   * exercised end-to-end against a live Cap instance without a real SMTP
   * provider. Unset in production; the SMTP provider itself remains an
   * explicit OPEN ITEM (spec: "Open Items").
   */
  readonly CONTACT_EMAIL_TEST_MODE?: string;
}
