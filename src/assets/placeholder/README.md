# Placeholder assets

`hero.jpg` is an AI-generated stock photo sourced from the client-provided
Stitch design mockup (`stitch_alba_abogacia_law_firm_website/`), originally
hosted on Google's `aida-public` CDN. It was downloaded once (not hotlinked)
so the site never depends on an external, unversioned, unlicensed third-party
URL at build or runtime.

It depicts a generic office/desk scene — no real person, no real place, and
no claim that it represents ALBA Abogacía & Consulting's actual office. It is
a temporary, honestly-labeled visual placeholder (see the `alt` text wherever
it is used: "Fotografía genérica de un despacho, usada como imagen
provisional.") and MUST be replaced with a real, rights-cleared photograph of
the firm's actual office before this becomes a client-facing production
asset.

Not wired into any page yet — landed in PR A of the `animations-v2` change
purely as an importable `astro:assets` asset; PR C wires it into the Home
hero section.
