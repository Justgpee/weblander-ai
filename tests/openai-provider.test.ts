import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  parse: vi.fn(),
  options: [] as Array<Record<string, unknown>>,
}));

vi.mock("openai", () => ({
  default: class OpenAIMock {
    responses = { parse: mocks.parse };
    constructor(options: Record<string, unknown>) { mocks.options.push(options); }
  },
}));

vi.mock("openai/helpers/zod", () => ({ zodTextFormat: vi.fn((_schema: unknown, name: string) => ({ name })) }));

import { GenerationError } from "@/lib/ai/errors";
import { OPENAI_REQUEST_TIMEOUT_MS, requestGeneratedContent, requestGeneratedSection } from "@/lib/ai/openai-provider";

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
});
