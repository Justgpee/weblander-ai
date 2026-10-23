import { describe, expect, it } from "vitest";
import { BusinessBriefSchema, GeneratedPageSchema, type BusinessBrief } from "@/lib/generation";
import { generateFashionLandingPage, generateLandingPage, generateRealEstateLandingPage, generateRestaurantLandingPage } from "@/lib/ai/generate-page";
import { GenerationError } from "@/lib/ai/errors";
import { requestGeneratedContent } from "@/lib/ai/openai-provider";

const validBrief: BusinessBrief = {
  businessName: "Sunday Supply Co.",
  description: "Thoughtful home essentials with a lighter footprint.",
  audience: "Design lovers and slow-living devotees",
  offering: "Home essentials",
  callToAction: "Explore the collection",
  style: "Minimalist",
};

const validContent = {
  headline: "A calmer home starts with the little things.",
  subheadline: "Thoughtful home essentials for design lovers who want everyday pieces with a lighter footprint.",
  features: ["Thoughtfully selected everyday essentials", "Made to bring a little more ease"],
};
const validRestaurantOutput = {
  pageContent: validContent,
  restaurantContent: {
    menuHighlights: [
      { name: "Garden pasta", description: "Fresh pasta with seasonal vegetables and herbs." },
      { name: "Roasted carrots", description: "Slow-roasted carrots with a bright citrus dressing." },
    ],
    story: "A neighborhood kitchen shaped by seasonal cooking.",
    location: null,
    openingHours: null,
  },
};
const validFashionOutput = {
  pageContent: validContent,
  fashionContent: {
    collectionHighlights: [
      { name: "Spring layers", description: "Lightweight themes for the changing season and everyday dressing." },
      { name: "Evening edit", description: "A considered direction for after-dark looks and special events." },
    ],
    brandStory: "An independent studio exploring considered everyday dressing.",
  },
};
const validRealEstateOutput = {
  pageContent: validContent,
  realEstateContent: {
    featuredProperties: [
      { name: "Thoughtful city living", description: "A residential property concept shaped by the agency's supplied focus." },
      { name: "Room to grow", description: "A second descriptive property highlight grounded in the supplied business brief." },
    ],
    agencyStory: "An independent agency offering clear, considered guidance through property decisions.",
  },
};

describe("runtime schemas", () => {
  it("accepts a valid brief and trims its text", () => {
    expect(BusinessBriefSchema.parse({ ...validBrief, businessName: "  Sunday Supply Co.  " }).businessName).toBe("Sunday Supply Co.");
  });

  it("rejects missing fields, invalid styles, blank strings, and fields over their maximum length", () => {
    expect(BusinessBriefSchema.safeParse({ ...validBrief, description: " " }).success).toBe(false);
    expect(BusinessBriefSchema.safeParse({ ...validBrief, style: "Cosmic" }).success).toBe(false);
    expect(BusinessBriefSchema.safeParse({ ...validBrief, businessName: "x".repeat(61) }).success).toBe(false);
    expect(BusinessBriefSchema.safeParse({ ...validBrief, description: "x".repeat(241) }).success).toBe(false);
    expect(BusinessBriefSchema.safeParse({ ...validBrief, audience: "x".repeat(101) }).success).toBe(false);
    expect(BusinessBriefSchema.safeParse({ ...validBrief, offering: "x".repeat(81) }).success).toBe(false);
    expect(BusinessBriefSchema.safeParse({ ...validBrief, callToAction: "x".repeat(37) }).success).toBe(false);
  });

  it("rejects malformed generated content and page data", () => {
    expect(GeneratedPageSchema.safeParse({ ...validBrief, ...validContent, headline: "short", layout: "editorial" }).success).toBe(false);
    expect(GeneratedPageSchema.safeParse({ ...validBrief, ...validContent, layout: "unknown" }).success).toBe(false);
  });
});

describe("generateLandingPage", () => {
  it("returns a fully validated page when a mocked provider succeeds", async () => {
    const page = await generateLandingPage(validBrief, "split", async () => validContent);
    expect(page).toMatchObject({ ...validBrief, ...validContent, layout: "split" });
    expect(GeneratedPageSchema.safeParse(page).success).toBe(true);
  });

  it("rejects incomplete or malformed provider output", async () => {
    await expect(generateLandingPage(validBrief, "editorial", async () => null)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(generateLandingPage(validBrief, "editorial", async () => { throw new GenerationError("INCOMPLETE", "incomplete"); })).rejects.toMatchObject({ code: "INCOMPLETE" });
  });

  it("converts unknown provider exceptions to a safe error", async () => {
    await expect(generateLandingPage(validBrief, "editorial", async () => { throw new Error("secret key must not leak"); })).rejects.toMatchObject({ code: "PROVIDER", message: expect.not.stringContaining("secret key") });
  });

  it("fails safely when the server API key is missing", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(requestGeneratedContent(validBrief)).rejects.toMatchObject({ code: "CONFIGURATION" });
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
  });
});

describe("regeneratePageSection", () => {
  it("validates section output from an injected provider", async () => {
    const { regeneratePageSection } = await import("@/lib/ai/generate-page");
    await expect(regeneratePageSection(validBrief, "headline", async () => ({ headline: "A more considered home begins here." })))
      .resolves.toEqual({ headline: "A more considered home begins here." });
  });

  it("rejects invalid section output and safely maps provider errors", async () => {
    const { regeneratePageSection } = await import("@/lib/ai/generate-page");
    await expect(regeneratePageSection(validBrief, "features", async () => ({ features: ["tiny", "brief"] }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(regeneratePageSection(validBrief, "headline", async () => { throw new Error("private detail"); }))
      .rejects.toMatchObject({ code: "PROVIDER", message: expect.not.stringContaining("private detail") });
  });
});

describe("generateRestaurantLandingPage", () => {
  it("returns independently validated page content and restaurant template content", async () => {
    const result = await generateRestaurantLandingPage(validBrief, "split", async () => validRestaurantOutput);
    expect(result.page).toMatchObject({ ...validBrief, ...validContent, layout: "split" });
    expect(result.template).toEqual({
      id: "restaurant",
      content: {
        menuHighlights: validRestaurantOutput.restaurantContent.menuHighlights,
        story: validRestaurantOutput.restaurantContent.story,
      },
    });
  });

  it("omits unsupported optional facts and rejects missing/oversized highlights and invalid page content", async () => {
    const withoutFacts = { ...validRestaurantOutput, restaurantContent: { ...validRestaurantOutput.restaurantContent, story: null } };
    const result = await generateRestaurantLandingPage(validBrief, "editorial", async () => withoutFacts);
    expect(result.template.content).not.toHaveProperty("story");
    expect(result.template.content).not.toHaveProperty("location");
    expect(result.template.content).not.toHaveProperty("openingHours");

    await expect(generateRestaurantLandingPage(validBrief, "editorial", async () => ({
      ...validRestaurantOutput, restaurantContent: { ...validRestaurantOutput.restaurantContent, menuHighlights: [validRestaurantOutput.restaurantContent.menuHighlights[0]] },
    }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(generateRestaurantLandingPage(validBrief, "editorial", async () => ({
      ...validRestaurantOutput, restaurantContent: { ...validRestaurantOutput.restaurantContent, menuHighlights: Array.from({ length: 5 }, () => validRestaurantOutput.restaurantContent.menuHighlights[0]) },
    }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(generateRestaurantLandingPage(validBrief, "editorial", async () => ({
      ...validRestaurantOutput, restaurantContent: { ...validRestaurantOutput.restaurantContent, menuHighlights: [{ name: "x".repeat(61), description: "A valid description for this restaurant dish." }, validRestaurantOutput.restaurantContent.menuHighlights[1]] },
    }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(generateRestaurantLandingPage(validBrief, "editorial", async () => ({
      ...validRestaurantOutput, restaurantContent: { ...validRestaurantOutput.restaurantContent, menuHighlights: [{ name: "Valid dish name", description: "x".repeat(161) }, validRestaurantOutput.restaurantContent.menuHighlights[1]] },
    }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(generateRestaurantLandingPage(validBrief, "editorial", async () => ({
      ...validRestaurantOutput, pageContent: { ...validContent, headline: "short" },
    }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });

  it("maps provider failures to safe errors", async () => {
    await expect(generateRestaurantLandingPage(validBrief, "editorial", async () => { throw new Error("private provider stack"); }))
      .rejects.toMatchObject({ code: "PROVIDER", message: expect.not.stringContaining("private provider stack") });
    await expect(generateRestaurantLandingPage(validBrief, "editorial", async () => { throw new GenerationError("REFUSED", "safe refusal"); }))
      .rejects.toMatchObject({ code: "REFUSED" });
  });
});

describe("generateFashionLandingPage", () => {
  it("returns independently validated page and Fashion content from an injected provider", async () => {
    const result = await generateFashionLandingPage(validBrief, "split", async () => validFashionOutput);
    expect(result.page).toMatchObject({ ...validBrief, ...validContent, layout: "split" });
    expect(result.template).toEqual({ id: "fashion", content: validFashionOutput.fashionContent });
  });

  it("omits blank optional story and rejects invalid page or Fashion content", async () => {
    const noStory = { ...validFashionOutput, fashionContent: { ...validFashionOutput.fashionContent, brandStory: "   " } };
    const result = await generateFashionLandingPage(validBrief, "editorial", async () => noStory);
    expect(result.template.content).not.toHaveProperty("brandStory");

    await expect(generateFashionLandingPage(validBrief, "editorial", async () => ({
      ...validFashionOutput,
      fashionContent: { ...validFashionOutput.fashionContent, collectionHighlights: [validFashionOutput.fashionContent.collectionHighlights[0]] },
    }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(generateFashionLandingPage(validBrief, "editorial", async () => ({
      ...validFashionOutput,
      fashionContent: { ...validFashionOutput.fashionContent, collectionHighlights: Array.from({ length: 5 }, () => validFashionOutput.fashionContent.collectionHighlights[0]) },
    }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(generateFashionLandingPage(validBrief, "editorial", async () => ({
      ...validFashionOutput,
      fashionContent: { ...validFashionOutput.fashionContent, collectionHighlights: [{ name: "x".repeat(61), description: "A grounded collection concept for the brief." }, validFashionOutput.fashionContent.collectionHighlights[1]] },
    }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    await expect(generateFashionLandingPage(validBrief, "editorial", async () => ({
      ...validFashionOutput, pageContent: { ...validContent, headline: "short" },
    }))).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
  });

  it("maps provider failures to safe errors", async () => {
    await expect(generateFashionLandingPage(validBrief, "editorial", async () => { throw new Error("private fashion provider stack"); }))
      .rejects.toMatchObject({ code: "PROVIDER", message: expect.not.stringContaining("private fashion provider stack") });
    await expect(generateFashionLandingPage(validBrief, "editorial", async () => { throw new GenerationError("REFUSED", "safe refusal"); }))
      .rejects.toMatchObject({ code: "REFUSED" });
  });
});

describe("generateRealEstateLandingPage", () => {
  it("returns independently validated page and Real Estate content from an injected provider", async () => {
    const result = await generateRealEstateLandingPage(validBrief, "split", async () => validRealEstateOutput);
    expect(result.page).toMatchObject({ ...validBrief, ...validContent, layout: "split" });
    expect(result.template).toEqual({ id: "real-estate", content: validRealEstateOutput.realEstateContent });
  });

  it("omits an unsupported optional story and rejects invalid property or page output", async () => {
    const noStory = { ...validRealEstateOutput, realEstateContent: { ...validRealEstateOutput.realEstateContent, agencyStory: "   " } };
    const result = await generateRealEstateLandingPage(validBrief, "editorial", async () => noStory);
    expect(result.template.content).not.toHaveProperty("agencyStory");

    const badOutputs = [
      { ...validRealEstateOutput, realEstateContent: { ...validRealEstateOutput.realEstateContent, featuredProperties: [validRealEstateOutput.realEstateContent.featuredProperties[0]] } },
      { ...validRealEstateOutput, realEstateContent: { ...validRealEstateOutput.realEstateContent, featuredProperties: Array.from({ length: 5 }, () => validRealEstateOutput.realEstateContent.featuredProperties[0]) } },
      { ...validRealEstateOutput, realEstateContent: { ...validRealEstateOutput.realEstateContent, featuredProperties: [{ name: "x".repeat(81), description: "A valid description grounded in the brief." }, validRealEstateOutput.realEstateContent.featuredProperties[1]] } },
      { ...validRealEstateOutput, realEstateContent: { ...validRealEstateOutput.realEstateContent, featuredProperties: [{ name: "Valid property concept", description: "x".repeat(201) }, validRealEstateOutput.realEstateContent.featuredProperties[1]] } },
      { ...validRealEstateOutput, pageContent: { ...validContent, headline: "short" } },
    ];
    for (const output of badOutputs) {
      await expect(generateRealEstateLandingPage(validBrief, "editorial", async () => output)).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    }
  });

  it("maps provider failures to safe errors", async () => {
    await expect(generateRealEstateLandingPage(validBrief, "editorial", async () => { throw new Error("private real estate provider stack"); }))
      .rejects.toMatchObject({ code: "PROVIDER", message: expect.not.stringContaining("private real estate provider stack") });
    await expect(generateRealEstateLandingPage(validBrief, "editorial", async () => { throw new GenerationError("REFUSED", "safe refusal"); }))
      .rejects.toMatchObject({ code: "REFUSED" });
  });
});
