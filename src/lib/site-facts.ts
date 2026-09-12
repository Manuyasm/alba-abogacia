/**
 * Single source of truth for confirmed site-wide facts (Engram memory #2643,
 * client chat 2026-09-10). Consumed by `BaseLayout.astro` (footer, JSON-LD)
 * and `contacto.astro`. Only fields explicitly confirmed by the client are
 * populated — an unconfirmed field is left `undefined`, never a fabricated
 * value or a `{{PLACEHOLDER}}` token.
 */

export interface OfficeFact {
  /** Short display label for the office (e.g. in a footer or office card). */
  name: string;
  addressLines: string[];
  /** Digits only, e.g. "985694493". Omitted entirely when unconfirmed. */
  phone?: string;
  /** e.g. "tel:985694493". Omitted entirely when unconfirmed. */
  phoneHref?: string;
  email?: string;
  /**
   * Geocoded coordinates (office-map-widget change, OSM Nominatim lookup,
   * 2026-09-12). Langreo is a street-level approximation — Nominatim could
   * not resolve the exact building for this address, only its street.
   * Madrid is an exact house-number match. Consumed by `OfficeMap.tsx`.
   */
  lat: number;
  lon: number;
}

/** Full site branding — used in page `<title>`s and the footer. */
export const SITE_NAME = "ALBA Abogacía & Consulting";

/**
 * Spec-exact short brand form. Used ONLY where a fabricated legal-entity name
 * would be unsafe (e.g. JSON-LD `name`) — "Alba Abogacía" is a confirmed
 * brand fact, distinct from the still-unconfirmed legal entity name that
 * remains a page-local `{{DATA_CONTROLLER_LEGAL_NAME}}` placeholder in
 * `politica-privacidad.astro`.
 */
export const BRAND_NAME = "Alba Abogacía";

export const PRIMARY_EMAIL = "info@alba-abogacia.es";

export const OFFICES: { langreo: OfficeFact; madrid: OfficeFact } = {
  langreo: {
    name: "Langreo (Asturias)",
    addressLines: [
      "C/ Inventor La Cierva, nº 22, 1º A, C.P. 33930, Langreo, Principado de Asturias",
    ],
    phone: "985694493",
    phoneHref: "tel:985694493",
    email: PRIMARY_EMAIL,
    lat: 43.3078225,
    lon: -5.6961254,
  },
  madrid: {
    name: "Madrid",
    // Phone and email are unconfirmed for this office — intentionally
    // omitted rather than fabricated (see memory #2643).
    addressLines: ["C/ Bravo Murillo, nº 377, 2º, Madrid"],
    lat: 40.465928,
    lon: -3.6906199,
  },
};
