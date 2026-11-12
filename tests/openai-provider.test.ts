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
import { OPENAI_REQUEST_TIMEOUT_MS, requestGeneratedContent, requestGeneratedFashionContent, requestGeneratedPageSection, requestGeneratedRealEstateContent, requestGeneratedRestaurantContent, requestGeneratedSection, requestGeneratedSitePage } from "@/lib/ai/openai-provider";
import { SitePageGenerationOutputSchema } from "@/lib/site-page-generation";
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

  it("logs one redacted diagnostic for shared Home and page provider failures", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const providerError = Object.assign(new Error("private provider message and prompt"), {
      name: "APIError", status: 401, code: "invalid_api_key", request_id: "req_mock_42",
      headers: { authorization: "Bearer secret" },
    });
    mocks.parse.mockRejectedValueOnce(providerError);
    await expect(requestGeneratedContent(brief)).rejects.toMatchObject({ code: "PROVIDER" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenLastCalledWith("AI provider request failed", expect.objectContaining({
      operation: "home-generation", errorClass: "APIError", category: "provider-http", httpStatus: 401,
      providerCode: "invalid_api_key", requestId: "req_mock_42",
    }));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private provider message|prompt|Bearer secret|authorization/);

    log.mockClear();
    mocks.parse.mockRejectedValueOnce(providerError);
    await expect(requestGeneratedSitePage({
      brief,
      pageType: "services",
      identity: { id: "services", slug: "services", title: "Services" },
      template: { id: "real-estate", content: { featuredProperties: [
        { name: "Thoughtful city homes", description: "A property concept grounded in the agency's supplied focus." },
        { name: "Spaces for new chapters", description: "A second descriptive concept grounded in the supplied focus." },
      ] } },
    })).rejects.toMatchObject({ code: "PROVIDER" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenLastCalledWith("AI provider request failed", expect.objectContaining({ operation: "page-generation" }));
  });

  it.each([429, 500, 502, 503])("logs HTTP %i distinctly while keeping the client error generic", async (status) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const providerError = Object.assign(new Error("private provider response and request body"), {
      name: "APIError",
      status,
      code: status === 429 ? "rate_limit_exceeded" : "server_error",
      request_id: "req_page_123",
      headers: { authorization: "Bearer secret" },
      response: { body: "private response" },
    });
    mocks.parse.mockRejectedValueOnce(providerError);

    await expect(requestGeneratedSitePage({
      brief,
      pageType: "about",
      identity: { id: "about", slug: "about", title: "About" },
      template: { id: "fashion", content: { collectionHighlights: [
        { name: "Soft layers", description: "Considered layers for everyday dressing and changing seasons." },
        { name: "Evening edit", description: "A quiet direction for after-dark dressing and special occasions." },
      ] } },
    }, { correlationId: "page-correlation-429", vercelRequestId: "sfo1::iad1::abc123" })).rejects.toMatchObject({
      code: "PROVIDER",
      message: "The generation service is temporarily unavailable. Please try again.",
    });

    expect(log).toHaveBeenCalledWith("AI provider request failed", expect.objectContaining({
      correlationId: "page-correlation-429",
      vercelRequestId: "sfo1::iad1::abc123",
      operation: "page-generation",
      httpStatus: status,
      failureKind: status === 429 ? "rate-limit" : "provider-server",
      requestId: "req_page_123",
      durationMs: expect.any(Number),
    }));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private provider response|request body|Bearer secret|authorization|private response/);
    log.mockRestore();
  });

  it("correlates both core and template section provider failures without logging sensitive content", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const context = { correlationId: "section-correlation-1234", vercelRequestId: "sfo1::iad1::section123" };
    const secretError = Object.assign(new Error("private brief and raw provider body sk-secret"), {
      name: "APIError", status: 503, code: "server_error", headers: { authorization: "Bearer hidden" },
    });
    mocks.parse.mockRejectedValueOnce(secretError);
    await expect(requestGeneratedSection(brief, "headline", context)).rejects.toMatchObject({
      code: "PROVIDER", message: "The generation service is temporarily unavailable. Please try again.",
    });
    expect(log).toHaveBeenCalledWith("AI provider request failed", expect.objectContaining({
      correlationId: context.correlationId, vercelRequestId: context.vercelRequestId,
      operation: "section-regeneration", failureKind: "provider-server", httpStatus: 503,
    }));

    log.mockClear();
    mocks.parse.mockRejectedValueOnce(secretError);
    await expect(requestGeneratedPageSection({
      projectId: null, brief,
      page: { id: "about", slug: "about", title: "About", kind: "about", template: { id: "generic" } },
      section: "features",
    }, "features", context)).rejects.toMatchObject({ code: "PROVIDER" });
    expect(log).toHaveBeenCalledWith("AI provider request failed", expect.objectContaining({
      correlationId: context.correlationId, vercelRequestId: context.vercelRequestId,
      operation: "section-regeneration", failureKind: "provider-server", httpStatus: 503,
    }));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private brief|raw provider body|sk-secret|Bearer hidden|authorization/);
    log.mockRestore();
  });

  it("logs SDK timeout and connection failures as different safe categories", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = {
      brief,
      pageType: "about" as const,
      identity: { id: "about", slug: "about", title: "About" },
      template: { id: "generic" as const },
    };
    mocks.parse.mockRejectedValueOnce(Object.assign(new Error("private timeout"), { name: "APIConnectionTimeoutError" }));
    await expect(requestGeneratedSitePage(request, { correlationId: "page-timeout-001" })).rejects.toMatchObject({ code: "PROVIDER" });
    expect(log).toHaveBeenLastCalledWith("AI provider request failed", expect.objectContaining({
      correlationId: "page-timeout-001", category: "timeout", failureKind: "timeout",
    }));

    log.mockClear();
    mocks.parse.mockRejectedValueOnce(Object.assign(new Error("private connection failure"), {
      name: "APIConnectionError",
      cause: Object.assign(new Error("private nested network failure"), { code: "ECONNRESET" }),
    }));
    await expect(requestGeneratedSitePage(request, { correlationId: "page-connection-01" })).rejects.toMatchObject({ code: "PROVIDER" });
    expect(log).toHaveBeenLastCalledWith("AI provider request failed", expect.objectContaining({
      correlationId: "page-connection-01", category: "connection", failureKind: "connection", networkCode: "ECONNRESET",
    }));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private timeout|private connection|nested network failure/);
    log.mockRestore();
  });

  it("logs incomplete and schema-invalid page output without its contents", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = {
      brief,
      pageType: "about" as const,
      identity: { id: "about", slug: "about", title: "About" },
      template: { id: "generic" as const },
    };
    mocks.parse.mockResolvedValueOnce({ status: "incomplete", output: [], output_parsed: null });
    await expect(requestGeneratedSitePage(request, { correlationId: "page-incomplete-1" })).rejects.toMatchObject({ code: "INCOMPLETE" });
    expect(log).toHaveBeenLastCalledWith("AI generation diagnostic", expect.objectContaining({
      correlationId: "page-incomplete-1", failureKind: "incomplete-output", validationStage: "provider-response",
    }));

    log.mockClear();
    mocks.parse.mockResolvedValueOnce({ status: "completed", output: [], output_parsed: { headline: "private generated headline" } });
    await expect(requestGeneratedSitePage(request, { correlationId: "page-invalid-001" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    expect(log).toHaveBeenLastCalledWith("AI generation diagnostic", expect.objectContaining({
      correlationId: "page-invalid-001", failureKind: "schema-validation", validationStage: "provider-response",
      validationIssueCount: expect.any(Number),
    }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("private generated headline");
    log.mockRestore();
  });

  it("classifies a Zod error thrown by the structured-output parser as schema validation", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = {
      brief,
      pageType: "about" as const,
      identity: { id: "about", slug: "about", title: "About" },
      template: { id: "generic" as const },
    };
    const invalid = SitePageGenerationOutputSchema.safeParse({ headline: "private generated content" });
    expect(invalid.success).toBe(false);
    if (invalid.success) throw new Error("Expected invalid test fixture");
    mocks.parse.mockRejectedValueOnce(invalid.error);

    await expect(requestGeneratedSitePage(request, { correlationId: "page-zod-failure-1" })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    expect(log).toHaveBeenCalledWith("AI generation diagnostic", expect.objectContaining({
      correlationId: "page-zod-failure-1",
      failureKind: "schema-validation",
      validationStage: "provider-response",
      validationIssueCount: expect.any(Number),
    }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("private generated content");
    log.mockRestore();
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
