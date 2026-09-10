# E2E Tests — Contact Form + Cap CAPTCHA + Accessibility

Scope: `contact-form-cap-umami`, Phase 8 (PR5). Covers `/contacto`, the
embedded `#contacto` section on `/`, and an axe-core accessibility scan of
those two plus `/politica-privacidad`.

## Approach chosen: a genuinely live Cap Standalone instance

The task allowed either spinning up PR1's `docker-compose.yml` Cap + Valkey
services for the test run, or mocking the Cap network call at the
browser/network level. **This PR uses the live instance**, for these
reasons:

- `@cap.js/widget` performs real client-side work (a WASM proof-of-work
  challenge solved in a Web Worker, fetched from and redeemed against a real
  Cap server) before it ever dispatches its `solve` event. Mocking that at
  the network level would mean re-implementing enough of Cap's challenge
  protocol to fool the real widget script, which is more fragile and less
  representative than just running the real thing — Docker was available in
  this environment (`docker compose up -d cap valkey` succeeds, verified
  before writing any spec).
- The server-side `POST /api/contacto` → `verifyCaptchaToken` → Cap
  `/siteverify` call happens from the Astro Node server process, not the
  browser — Playwright's `page.route()` cannot intercept it. A live instance
  is the only way to exercise that whole path for real in one E2E run.
- Cap Standalone exposes a small, genuine admin REST API
  (`POST /auth/login` with the container's `ADMIN_KEY`, then
  `POST /server/keys` with the resulting session token) that creates a real
  site key + secret key non-interactively — the same thing a human would
  otherwise do once through Cap's dashboard UI. `scripts/run-e2e-live-cap.sh`
  automates exactly that flow so the whole suite is reproducible with one
  command and never requires a checked-in site key/secret.

## The SMTP gap: `CONTACT_EMAIL_TEST_MODE`

The concrete SMTP/transactional provider is (and remains) an explicit OPEN
ITEM — see the spec's "Open Items" and `src/lib/email/sender.ts`'s
`createUnconfiguredEmailTransport()`, which always fails generically rather
than fabricate a provider. That means the production route, as wired, cannot
reach a real client-side "success" state without a real SMTP account this
change is explicitly not authorized to invent.

To make the "full success flow ... through to the client-side success state"
scenario genuinely testable without fabricating a provider, this PR adds one
narrow, explicit, env-gated test double: `createTestEmailTransport()`
(`src/lib/email/sender.ts`), selected only by `resolveEmailTransport()`
(`src/pages/api/contacto.ts`) when `CONTACT_EMAIL_TEST_MODE` is exactly
`"true"`. It never contacts a real provider and never logs the message; it
only resolves successfully so the rest of the real pipeline (validation,
honeypot, rate limiting, real Cap verification) can be proven end-to-end.
This flag **must stay unset in production** — `env.example` documents it
with that warning, and the default (unset) behavior is unchanged from PR1-4.

## Running

```bash
pnpm test:e2e:live-cap
```

This wraps `scripts/run-e2e-live-cap.sh`, which:

1. Starts `cap` + `valkey` from `docker-compose.yml` with a throwaway,
   dev-only `CAP_ADMIN_KEY` (never a production value).
2. Provisions a fresh Cap site key + secret key via Cap's own admin API.
3. Builds the app with those values plus `CONTACT_EMAIL_TEST_MODE=true`.
4. Starts `astro preview`, runs `playwright test`, then tears both down.

`playwright.config.ts` itself is unchanged from PR4: its `webServer` still
documents `pnpm build && pnpm preview` for a plain `pnpm test:e2e` run, and
`reuseExistingServer` (true outside CI) means it detects and reuses the
server the script above already started rather than rebuilding.

## What each spec covers

- `contacto.spec.ts` — full success flow (fill 4 fields + consent, solve the
  real Cap widget, submit, reach the client-side success state); honeypot
  handling proven at two independent layers — client-side (a bot that fills
  the honeypot through the DOM is silently blocked by `ContactSchema` itself
  before any `fetch`, with zero visible feedback: no error, no focus change,
  no request) and server-side (a bot that bypasses the client entirely and
  posts directly to the API with the honeypot filled is still accepted with
  a generic success, proving the pipeline order in `contacto.ts` short-
  circuits before Cap verification); validation errors blocking submission
  with focus management; the embedded `#contacto` section on `/` working
  identically to the standalone page (a full, independent success-flow run
  through that section, not just a structural check).
- `keyboard-navigation.spec.ts` — the spec scenario "Full keyboard
  operability": Tab order through all 4 fields, the consent checkbox and its
  Política de privacidad link, the real Cap widget (confirmed keyboard-
  activatable via Enter, per `@cap.js/widget`'s own `role="button"` +
  `tabindex="0"` trigger), and the submit button; a visible focus indicator
  at every step; no keyboard trap in either Tab direction.
- `accessibility.spec.ts` — an automated `@axe-core/playwright` scan
  (WCAG 2.x A/AA + 2.2 AA tags) of `/contacto`, `/` (home, includes
  `#contacto`), and `/politica-privacidad`, requiring zero critical/serious
  violations; any moderate/minor findings are logged and reported rather
  than silently ignored.
