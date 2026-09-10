/**
 * Server-side verification of a Cap (https://capjs.js.org) CAPTCHA token against a
 * self-hosted Cap Standalone instance's `/siteverify` endpoint (reCAPTCHA-compatible).
 *
 * Tokens are single-use: Cap Standalone atomically GETs-and-DELETEs the token record
 * on first verification, so a replayed token naturally comes back as a rejection
 * (see AGENTS.md §9 "Verificar cada token una sola vez en servidor"). This module does
 * not need to track usage itself — it only calls Cap and maps its response to a
 * generic result, never leaking Cap's internal error strings to callers.
 */

export interface CaptchaVerifyConfig {
  /** Base URL of the Cap Standalone instance, e.g. `https://cap.alba-abogacia.es`. */
  apiUrl: string;
  /** Site key created in the Cap dashboard for this site. */
  siteKey: string;
  /** Secret key created alongside the site key — never the dashboard admin key. */
  secretKey: string;
}

export type CaptchaVerifyResult =
  | { success: true }
  | { success: false; reason: "missing_token" | "invalid_token" | "network_error" };

/**
 * A Cap widget token is `{siteKey}:{challenge}:{solution}` — three colon-separated
 * segments. Rejecting anything else locally avoids a network round-trip for
 * obviously-empty or malformed input (spec: "Missing or invalid token" scenario).
 */
function isWellFormedToken(token: string): boolean {
  return token.split(":").length === 3;
}

export async function verifyCaptchaToken(
  token: string,
  config: CaptchaVerifyConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<CaptchaVerifyResult> {
  if (!token || !isWellFormedToken(token)) {
    return { success: false, reason: "missing_token" };
  }

  let response: Response;
  try {
    response = await fetchImpl(`${config.apiUrl}/${config.siteKey}/siteverify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: config.secretKey, response: token }),
    });
  } catch {
    return { success: false, reason: "network_error" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { success: false, reason: "network_error" };
  }

  const success =
    typeof body === "object" && body !== null && "success" in body && body.success === true;

  return success ? { success: true } : { success: false, reason: "invalid_token" };
}
