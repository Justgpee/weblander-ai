import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  imageGenerate: vi.fn(),
  options: [] as Array<Record<string, unknown>>,
}));

vi.mock("openai", () => ({
  default: class OpenAIMock {
    responses = { parse: mocks.parse };
    images = { generate: mocks.imageGenerate };
    constructor(options: Record<string, unknown>) { mocks.options.push(options); }
  },
}));

vi.mock("openai/helpers/zod", () => ({ zodTextFormat: vi.fn((_schema: unknown, name: string) => ({ name })) }));

import { GenerationError } from "@/lib/ai/errors";
import { OPENAI_REQUEST_TIMEOUT_MS, requestGeneratedContent, requestGeneratedFashionContent, requestGeneratedRealEstateContent, requestGeneratedRestaurantContent, requestGeneratedSection } from "@/lib/ai/openai-provider";
import { OPENAI_IMAGE_MODEL, OPENAI_IMAGE_REQUEST_TIMEOUT_MS, requestGeneratedHeroImage } from "@/lib/ai/openai-image-provider";

const brief = {
  businessName: "Northline Studio", description: "Brand identity and digital design for climate ventures.",
  audience: "Early-stage founders", offering: "Brand identity", callToAction: "Book a call", style: "Professional" as const,
};

const generatedContent = {
  headline: "Make your next chapter unmistakable.",
  subheadline: "Brand identity for founders shaping a more sustainable future.",
  features: ["Thoughtful direction for ambitious teams", "A clearer story for what comes next"],
};

beforeEach(() => {
  mocks.options.length = 0;
  mocks.parse.mockReset();
  mocks.imageGenerate.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "unit-test-key");
});

afterEach(() => vi.unstubAllEnvs());

describe("OpenAI provider timeout", () => {
  it("configures a bounded SDK timeout for full-page generation", async () => {
    mocks.parse.mockResolvedValue({ status: "completed", output: [], output_parsed: generatedContent });

    await expect(requestGeneratedContent(brief)).resolves.toMatchObject(generatedContent);
    expect(OPENAI_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(OPENAI_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
    expect(mocks.options[0]).toMatchObject({ timeout: OPENAI_REQUEST_TIMEOUT_MS, maxRetries: 0 });
  });

  it("configures the same timeout and safely maps section provider timeout failures", async () => {
    mocks.parse.mockRejectedValue(new Error("private provider timeout stack"));

    await expect(requestGeneratedSection(brief, "headline")).rejects.toMatchObject({
      code: "PROVIDER",
      message: "The generation service is temporarily unavailable. Please try again.",
    } satisfies Partial<GenerationError>);
    expect(mocks.options[0]).toMatchObject({ timeout: OPENAI_REQUEST_TIMEOUT_MS, maxRetries: 0 });
  });

  it("uses the existing structured-output provider path for restaurant content", async () => {
    const output = {
      pageContent: generatedContent,
      restaurantContent: {
        menuHighlights: [
          { name: "Garden pasta", description: "Fresh pasta with seasonal vegetables and herbs." },
          { name: "Roasted carrots", description: "Slow-roasted carrots with a bright citrus dressing." },
        ], story: null, location: null, openingHours: null,
      },
    };
    mocks.parse.mockResolvedValue({ status: "completed", output: [], output_parsed: output });
    await expect(requestGeneratedRestaurantContent(brief)).resolves.toEqual(output);
    expect(mocks.options[0]).toMatchObject({ timeout: OPENAI_REQUEST_TIMEOUT_MS, maxRetries: 0 });
    expect(mocks.parse).toHaveBeenCalledWith(expect.objectContaining({ max_output_tokens: 1000, reasoning: { effort: "none" } }));
    expect(mocks.parse.mock.calls[0][0].text.format.name).toBe("restaurant_landing_page");
  });

  it("maps restaurant provider errors and incomplete output to safe errors", async () => {
    mocks.parse.mockRejectedValueOnce(new Error("private restaurant provider detail"));
    await expect(requestGeneratedRestaurantContent(brief)).rejects.toMatchObject({
      code: "PROVIDER", message: "The generation service is temporarily unavailable. Please try again.",
    } satisfies Partial<GenerationError>);
    mocks.parse.mockResolvedValueOnce({ status: "incomplete", output: [], output_parsed: null });
    await expect(requestGeneratedRestaurantContent(brief)).rejects.toMatchObject({ code: "INCOMPLETE" });
  });

  it("uses the existing structured-output path and bounded timeout for Fashion content", async () => {
    const output = {
      pageContent: generatedContent,
      fashionContent: {
        collectionHighlights: [
          { name: "Spring layers", description: "Lightweight themes for changing weather and everyday dressing." },
          { name: "Evening edit", description: "A considered direction for after-dark looks and special events." },
        ],
        brandStory: null,
      },
    };
    mocks.parse.mockResolvedValue({ status: "completed", output: [], output_parsed: output });
    await expect(requestGeneratedFashionContent(brief)).resolves.toEqual(output);
    expect(mocks.options[0]).toMatchObject({ timeout: OPENAI_REQUEST_TIMEOUT_MS, maxRetries: 0 });
    expect(mocks.parse).toHaveBeenCalledWith(expect.objectContaining({ max_output_tokens: 1200, reasoning: { effort: "none" } }));
    expect(mocks.parse.mock.calls[0][0].text.format.name).toBe("fashion_landing_page");
    expect(mocks.parse.mock.calls[0][0].instructions).toContain("Do not invent product names, prices");
    expect(mocks.parse.mock.calls[0][0].instructions).toContain("not a verified product catalog");
  });

  it("maps Fashion provider failures and incomplete output to safe errors", async () => {
    mocks.parse.mockRejectedValueOnce(new Error("private fashion provider detail"));
    await expect(requestGeneratedFashionContent(brief)).rejects.toMatchObject({
      code: "PROVIDER", message: "The generation service is temporarily unavailable. Please try again.",
    } satisfies Partial<GenerationError>);
    mocks.parse.mockResolvedValueOnce({ status: "incomplete", output: [], output_parsed: null });
    await expect(requestGeneratedFashionContent(brief)).rejects.toMatchObject({ code: "INCOMPLETE" });
  });

  it("uses the bounded structured-output path and grounded-content rules for Real Estate", async () => {
    const output = {
      pageContent: generatedContent,
      realEstateContent: {
        featuredProperties: [
          { name: "Considered city homes", description: "A property concept grounded in the agency's supplied focus." },
          { name: "Spaces for new chapters", description: "A second descriptive highlight shaped by the business brief." },
        ],
        agencyStory: null,
      },
    };
    mocks.parse.mockResolvedValue({ status: "completed", output: [], output_parsed: output });
    await expect(requestGeneratedRealEstateContent(brief)).resolves.toEqual(output);
    expect(mocks.options[0]).toMatchObject({ timeout: OPENAI_REQUEST_TIMEOUT_MS, maxRetries: 0 });
    expect(mocks.parse).toHaveBeenCalledWith(expect.objectContaining({ max_output_tokens: 1200, reasoning: { effort: "none" } }));
    expect(mocks.parse.mock.calls[0][0].text.format.name).toBe("real_estate_landing_page");
    for (const prohibited of ["prices", "addresses", "availability", "bedroom counts", "investment returns", "contact details", "live inventory"]) {
      expect(mocks.parse.mock.calls[0][0].instructions).toContain(prohibited);
    }
  });

  it("maps Real Estate provider failures and incomplete output safely", async () => {
    mocks.parse.mockRejectedValueOnce(new Error("private Real Estate provider detail"));
    await expect(requestGeneratedRealEstateContent(brief)).rejects.toMatchObject({
      code: "PROVIDER", message: "The generation service is temporarily unavailable. Please try again.",
    } satisfies Partial<GenerationError>);
    mocks.parse.mockResolvedValueOnce({ status: "incomplete", output: [], output_parsed: null });
    await expect(requestGeneratedRealEstateContent(brief)).rejects.toMatchObject({ code: "INCOMPLETE" });
  });
});

describe("OpenAI image provider", () => {
  it("uses the requested Images API model with one bounded WebP output", async () => {
    mocks.imageGenerate.mockResolvedValue({ data: [{ b64_json: "UklGRgAAAABXRUJQ" }] });
    await expect(requestGeneratedHeroImage({ brief })).resolves.toEqual({ mimeType: "image/webp", base64: "UklGRgAAAABXRUJQ" });
    expect(OPENAI_IMAGE_MODEL).toBe("gpt-image-2.5-sunburst");
    expect(OPENAI_IMAGE_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(OPENAI_IMAGE_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
    expect(mocks.options.at(-1)).toMatchObject({ timeout: OPENAI_IMAGE_REQUEST_TIMEOUT_MS, maxRetries: 0 });
    expect(mocks.imageGenerate).toHaveBeenCalledWith(expect.objectContaining({
      model: OPENAI_IMAGE_MODEL, n: 1, size: "1536x1024", quality: "low", output_format: "webp", output_compression: 70,
    }));
  });

  it("handles missing configuration, missing image output, and provider timeout safely", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(requestGeneratedHeroImage({ brief })).rejects.toMatchObject({ code: "CONFIGURATION" });
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousKey;
    }
    mocks.imageGenerate.mockResolvedValueOnce({ data: [] });
    await expect(requestGeneratedHeroImage({ brief })).rejects.toMatchObject({ code: "INCOMPLETE" });
    mocks.imageGenerate.mockRejectedValueOnce(new Error("private image provider timeout"));
    await expect(requestGeneratedHeroImage({ brief })).rejects.toMatchObject({
      code: "PROVIDER", message: "Image generation is temporarily unavailable. Please try again.",
    } satisfies Partial<GenerationError>);
  });
});
