import { describe, expect, it, vi } from "vitest";
import { regenerateSitePageSection } from "@/lib/ai/generate-site-section";
import type { ProviderDiagnosticContext } from "@/lib/ai/provider-diagnostics";
import { mergeTemplateSectionIfUnchanged, PageSectionGenerationRequestSchema, PageSectionContentSchemas, type PageRegenerationSection, type PageSectionGenerationRequest } from "@/lib/page-section-generation";
import { SiteTemplateSchema, type SiteTemplateId } from "@/lib/site-templates";

const brief = { businessName: "Juniper Studio", description: "A neighborhood business offering thoughtful and useful services to its community.", audience: "Local customers", offering: "Considered services", callToAction: "Get in touch", style: "Professional" as const };
const templateData: Record<SiteTemplateId, object> = {
  generic: { id: "generic" },
  restaurant: { id: "restaurant", content: { menuHighlights: [{ name: "Garden bowl", description: "A bright bowl with seasonal ingredients." }, { name: "Roasted vegetables", description: "A colorful mix served with herbs." }] } },
  fashion: { id: "fashion", content: { collectionHighlights: [{ name: "Everyday layers", description: "Easy pieces for changing seasons." }, { name: "Evening edit", description: "A considered direction for after dark." }] } },
  "real-estate": { id: "real-estate", content: { featuredProperties: [{ name: "City residences", description: "A descriptive concept for urban living." }, { name: "Family homes", description: "A descriptive concept for comfortable spaces." }] } },
};
type PageKind = "home" | "about" | "services" | "products" | "contact";
const pageIdentity: Record<PageKind, { id: string; slug: string; title: string }> = {
  home: { id: "home", slug: "index", title: "Home" },
  about: { id: "about", slug: "about", title: "About" },
  services: { id: "services", slug: "services", title: "Services" },
  products: { id: "products", slug: "products", title: "Products" },
  contact: { id: "contact", slug: "contact", title: "Contact" },
};
function request(template: SiteTemplateId, section: PageRegenerationSection, kind: PageKind = "home") {
  return {
    projectId: null,
    brief,
    page: {
      ...pageIdentity[kind],
      kind,
      template: templateData[template],
    },
    section,
  };
}

describe("page-scoped section regeneration", () => {
  it.each([
    ["headline", { headline: "A considered experience for every customer" }],
    ["description", { subheadline: "Thoughtful service shaped for people in the local community." }],
    ["features", { features: ["Thoughtful support for local customers", "Useful services shaped around community"] }],
    ["callToAction", { callToAction: "Start a conversation" }],
  ] as const)("supports core section %s on Home and secondary pages across templates", async (section, output) => {
    const coreProvider = vi.fn(async () => output);
    const kindsByTemplate: Record<SiteTemplateId, PageKind[]> = {
      generic: ["home", "about", "services", "products", "contact"],
      restaurant: ["home", "about", "services", "contact"],
      fashion: ["home", "about", "products", "contact"],
      "real-estate": ["home", "about", "services", "contact"],
    };
    let expectedCalls = 0;
    for (const template of ["generic", "restaurant", "fashion", "real-estate"] as const) {
      for (const kind of kindsByTemplate[template]) {
        const result = await regenerateSitePageSection(request(template, section, kind), undefined, coreProvider);
        expect(result).toEqual(output);
        expectedCalls += 1;
      }
    }
    expect(coreProvider).toHaveBeenCalledTimes(expectedCalls);
  });

  it.each([
    ["restaurant", "menuHighlights", { menuHighlights: [{ name: "Garden bowl", description: "Seasonal vegetables with herbs." }, { name: "Roasted roots", description: "A savory plate with bright seasoning." }] }],
    ["fashion", "collectionHighlights", { collectionHighlights: [{ name: "Spring layers", description: "Light pieces for changing weather." }, { name: "Evening edit", description: "A refined direction for after dark." }] }],
    ["real-estate", "featuredProperties", { featuredProperties: [{ name: "Urban homes", description: "A descriptive concept for city living." }, { name: "Garden residences", description: "A descriptive concept for open spaces." }] }],
  ] as const)("regenerates only the %s template section on Home and compatible secondary pages", async (template, section, output) => {
    const provider = vi.fn<(request: PageSectionGenerationRequest, section: PageRegenerationSection) => Promise<unknown>>(async () => output);
    const kinds: Record<typeof template, PageKind[]> = {
      restaurant: ["home", "about", "services", "contact"],
      fashion: ["home", "about", "products", "contact"],
      "real-estate": ["home", "about", "services", "contact"],
    };
    for (const kind of kinds[template]) {
      const result = await regenerateSitePageSection(request(template, section, kind), provider);
      expect(result).toEqual(output);
    }
    expect(provider).toHaveBeenCalledTimes(kinds[template].length);
    expect(provider.mock.calls[0]?.[1]).toBe(section);
  });

  it("rejects incompatible template/section pairs and malformed output", async () => {
    expect(PageSectionGenerationRequestSchema.safeParse(request("generic", "menuHighlights")).success).toBe(false);
    expect(PageSectionGenerationRequestSchema.safeParse(request("restaurant", "collectionHighlights")).success).toBe(false);
    expect(PageSectionGenerationRequestSchema.safeParse(request("fashion", "featuredProperties")).success).toBe(false);
    await expect(regenerateSitePageSection(request("restaurant", "menuHighlights"), async () => ({ menuHighlights: [{ name: "Short", description: "" }] })))
      .rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    expect(PageSectionContentSchemas.features.safeParse({ features: ["short", "tiny"] }).success).toBe(false);
  });

  it("preserves unrelated template content and refuses to overwrite a newer edit", () => {
    const original = SiteTemplateSchema.parse({ id: "restaurant", content: { menuHighlights: [{ name: "Garden bowl", description: "A bright bowl with seasonal ingredients." }, { name: "Roasted vegetables", description: "A colorful mix served with herbs." }], story: "A locally rooted kitchen." } });
    const output = { menuHighlights: [{ name: "Herb plate", description: "A fresh plate with seasonal herbs." }, { name: "Roasted roots", description: "A warm dish with bright flavors." }] };
    const merged = mergeTemplateSectionIfUnchanged(original, "menuHighlights", output, 4, 4);
    expect(merged.id).toBe("restaurant");
    if (merged.id === "restaurant") {
      expect(merged.content.story).toBe("A locally rooted kitchen.");
      expect(merged.content.menuHighlights).toEqual(output.menuHighlights);
    }
    if (original.id !== "restaurant") throw new Error("Expected restaurant template fixture.");
    const newerEdit = { ...original, content: { ...original.content, menuHighlights: [{ name: "Edited one", description: "The user's latest dish description." }, ...original.content.menuHighlights.slice(1)] } };
    expect(mergeTemplateSectionIfUnchanged(newerEdit, "menuHighlights", output, 4, 5)).toBe(newerEdit);
  });

  it("creates an opaque application correlation ID and retains only a valid Vercel ID for core and template providers", async () => {
    const templateProvider = vi.fn(async (...args: [PageSectionGenerationRequest, PageRegenerationSection, ProviderDiagnosticContext?]) => {
      void args[0];
      void args[1];
      return { menuHighlights: [
        { name: "Herb plate", description: "A fresh plate with seasonal herbs." },
        { name: "Roasted roots", description: "A warm dish with bright flavors." },
      ] };
    });
    await regenerateSitePageSection(
      request("restaurant", "menuHighlights"),
      templateProvider,
      undefined,
      { vercelRequestId: "sfo1::iad1::section123" },
    );
    const templateContext = templateProvider.mock.calls[0]?.[2];
    expect(templateContext?.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(templateContext?.vercelRequestId).toBe("sfo1::iad1::section123");

    const coreProvider = vi.fn(async (...args: [PageSectionGenerationRequest["brief"], "headline" | "description" | "features" | "callToAction", ProviderDiagnosticContext?]) => {
      void args[0];
      void args[1];
      return { headline: "A considered experience for every customer" };
    });
    await regenerateSitePageSection(
      request("generic", "headline"),
      undefined,
      coreProvider,
      { vercelRequestId: "not-a-vercel-request-id" },
    );
    const coreContext = coreProvider.mock.calls[0]?.[2];
    expect(coreContext?.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(coreContext?.vercelRequestId).toBeUndefined();
  });

});
