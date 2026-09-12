import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import FaqAccordion from "./FaqAccordion.astro";

// Spec: "FaqAccordion Component" — data-agnostic, accepts a list of
// question/answer pairs, renders each as a native <details>/<summary> item
// with the answer present in the initial HTML (no JS needed to reveal it).
// Fixtures below are clearly-fictional placeholder content, never real
// client-confirmed FAQ copy (that is a future page-content change).
describe("FaqAccordion", () => {
  const items = [
    { question: "¿Pregunta de ejemplo uno?", answer: "Respuesta de ejemplo uno." },
    { question: "¿Pregunta de ejemplo dos?", answer: "Respuesta de ejemplo dos." },
  ];

  it("renders each item as a details/summary pair with the answer in initial HTML", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(FaqAccordion, {
      props: { items },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html).toContain("<summary");
    expect(html).toContain("¿Pregunta de ejemplo uno?");
    expect(html).toContain("Respuesta de ejemplo uno.");
    expect(html).toContain("¿Pregunta de ejemplo dos?");
    expect(html).toContain("Respuesta de ejemplo dos.");
  });

  // Design decision #6 (animations-v2, "FAQ height animation"): these hooks
  // are consumed by `src/lib/motion/faq-animate.ts`, which only ever ADDS a
  // smooth open/close animation on top of the native <details>/<summary>
  // markup — the answer stays in the initial HTML either way.
  it("exposes data-faq-item/data-faq-answer hooks without altering the native disclosure markup", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(FaqAccordion, {
      props: { items },
      request: new Request("https://alba-abogacia.es/"),
    });

    expect(html.match(/<details[^>]*data-faq-item/g)).toHaveLength(2);
    expect(html.match(/<p[^>]*data-faq-answer/g)).toHaveLength(2);
  });
});
