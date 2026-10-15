import { describe, expect, it } from "vitest";
import { BusinessBriefSchema, GeneratedPageSchema, type BusinessBrief } from "@/lib/generation";
import { generateLandingPage } from "@/lib/ai/generate-page";
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
