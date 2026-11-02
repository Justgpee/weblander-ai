import { describe, expect, it } from "vitest";
import { generateSitePage } from "@/lib/ai/generate-site-page";
import { GenerationError } from "@/lib/ai/errors";
import { SitePageGenerationRequestSchema, type SitePageGenerationRequest } from "@/lib/site-page-generation";

const brief = {
  businessName: "Juniper Kitchen",
  description: "Seasonal neighborhood cooking from locally supplied ingredients.",
  audience: "Local diners",
  offering: "Seasonal plates",
  callToAction: "View the menu",
  style: "Professional" as const,
};
const baseRequest: SitePageGenerationRequest = {
  brief,
  pageType: "about",
  identity: { id: "about", slug: "about", title: "About" },
  template: { id: "restaurant", content: { menuHighlights: [
    { name: "Garden pasta", description: "Fresh pasta with seasonal vegetables and herbs." },
    { name: "Roasted carrots", description: "Slow-roasted carrots with a bright citrus dressing." },
  ] } },
};
const validOutput = {
  headline: "A neighborhood table with a seasonal point of view",
  description: "Thoughtful cooking brings local diners together around generous plates and familiar hospitality.",
  features: ["Seasonal ingredients prepared with care", "A welcoming table for local diners"],
  callToAction: "Discover our story",
};

describe("site page generation request schema", () => {
  it("accepts page identities and preserves template content", () => {
    expect(SitePageGenerationRequestSchema.safeParse(baseRequest).success).toBe(true);
    expect(SitePageGenerationRequestSchema.safeParse({
      ...baseRequest,
      pageType: "services",
      identity: { id: "menu", slug: "menu", title: "Menu" },
    }).success).toBe(true);
    expect(SitePageGenerationRequestSchema.safeParse({
      ...baseRequest,
      template: { id: "fashion", content: { collectionHighlights: [
        { name: "Spring layers", description: "Lightweight pieces for changing seasons." },
        { name: "Evening edit", description: "A considered direction for after-dark dressing." },
      ] } },
    }).success).toBe(true);
    expect(SitePageGenerationRequestSchema.safeParse({
      ...baseRequest,
      pageType: "products",
      identity: { id: "products", slug: "products", title: "Products" },
      template: { id: "fashion", content: { collectionHighlights: [
        { name: "Spring layers", description: "Lightweight pieces for changing seasons." },
        { name: "Evening edit", description: "A considered direction for after-dark dressing." },
      ] } },
    }).success).toBe(true);
    expect(SitePageGenerationRequestSchema.safeParse({
      ...baseRequest,
      pageType: "services",
      identity: { id: "properties", slug: "properties", title: "Properties" },
      template: { id: "real-estate", content: { featuredProperties: [
        { name: "City residences", description: "Thoughtful urban homes presented as a property concept." },
        { name: "Family homes", description: "Comfortable home concepts for growing households." },
      ] } },
    }).success).toBe(true);
    expect(SitePageGenerationRequestSchema.safeParse({
      ...baseRequest,
      pageType: "home",
      identity: { id: "home", slug: "index", title: "Home" },
    }).success).toBe(true);
  });

  it("rejects page/template mismatches, invalid identities, and unknown request fields", () => {
    expect(SitePageGenerationRequestSchema.safeParse({ ...baseRequest, pageType: "products" }).success).toBe(false);
    expect(SitePageGenerationRequestSchema.safeParse({ ...baseRequest, pageType: "home" }).success).toBe(false);
    expect(SitePageGenerationRequestSchema.safeParse({ ...baseRequest, identity: { id: "Bad ID", slug: "about", title: "About" } }).success).toBe(false);
    expect(SitePageGenerationRequestSchema.safeParse({ ...baseRequest, extra: true }).success).toBe(false);
  });
});

describe("generateSitePage", () => {
  it("returns a validated v8 page record with caller-supplied identity and template", async () => {
    await expect(generateSitePage(baseRequest, async () => validOutput)).resolves.toEqual({
      ...baseRequest.identity,
      content: validOutput,
      template: baseRequest.template,
    });
  });

  it("rejects invalid requests before calling the provider", async () => {
    let called = false;
    await expect(generateSitePage({ ...baseRequest, pageType: "products" }, async () => { called = true; return validOutput; }))
      .rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(called).toBe(false);
  });

  it("rejects malformed output and safely maps provider failures", async () => {
    await expect(generateSitePage(baseRequest, async () => ({ ...validOutput, features: ["short", "tiny"] })))
      .rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(generateSitePage(baseRequest, async () => { throw new Error("private provider detail"); }))
      .rejects.toMatchObject({ code: "PROVIDER", message: expect.not.stringContaining("private provider detail") });
    await expect(generateSitePage(baseRequest, async () => { throw new GenerationError("REFUSED", "safe refusal"); }))
      .rejects.toMatchObject({ code: "REFUSED" });
  });
});
