import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateRealEstateLandingPage } = vi.hoisted(() => ({ mockGenerateRealEstateLandingPage: vi.fn() }));
vi.mock("@/lib/ai/generate-page", () => ({ generateRealEstateLandingPage: mockGenerateRealEstateLandingPage }));

import { POST } from "@/app/api/generate-real-estate/route";
import { GenerationError } from "@/lib/ai/errors";

const brief = {
  businessName: "Northline Property Group",
  description: "An independent agency offering thoughtful guidance on residential property.",
  audience: "People considering their next home",
  offering: "Property guidance",
  callToAction: "Explore our approach",
  style: "Professional",
};
const generated = {
  page: {
    ...brief,
    headline: "A more considered property journey",
    subheadline: "Thoughtful guidance for people exploring the next chapter in their home search.",
    features: ["Clear guidance grounded in your priorities", "A considered approach to property decisions"],
    layout: "editorial",
  },
  template: {
    id: "real-estate",
    content: {
      featuredProperties: [
        { name: "Thoughtful city living", description: "A descriptive property concept grounded in the supplied agency brief." },
        { name: "Room for a new chapter", description: "Another marketing highlight without implying current availability." },
      ],
      agencyStory: "An independent agency offering clear, considered property guidance.",
    },
  },
};
const jsonRequest = (body: string) => new Request("http://localhost/api/generate-real-estate", {
  method: "POST", headers: { "content-type": "application/json" }, body,
});

describe("POST /api/generate-real-estate", () => {
  beforeEach(() => mockGenerateRealEstateLandingPage.mockReset());

  it("validates the template and brief then returns independently validated no-store data", async () => {
    expect((await POST(jsonRequest(JSON.stringify({ templateId: "fashion", brief })))).status).toBe(400);
    expect((await POST(jsonRequest(JSON.stringify({ templateId: "real-estate", brief: { ...brief, businessName: "" } })))).status).toBe(400);
    expect(mockGenerateRealEstateLandingPage).not.toHaveBeenCalled();

    mockGenerateRealEstateLandingPage.mockResolvedValue(generated);
    const response = await POST(jsonRequest(JSON.stringify({ templateId: "real-estate", brief })));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ data: generated });
    expect(mockGenerateRealEstateLandingPage).toHaveBeenCalledWith(brief, "editorial");
  });

  it("rejects malformed JSON, unsupported media types, and bodies larger than 8 KiB", async () => {
    expect((await POST(jsonRequest("{"))).status).toBe(400);
    expect((await POST(jsonRequest(" ".repeat(8193)))).status).toBe(413);
    const unsupported = new Request("http://localhost/api/generate-real-estate", {
      method: "POST", headers: { "content-type": "text/plain" }, body: "{}",
    });
    expect((await POST(unsupported)).status).toBe(415);
  });

  it("rejects invalid generated page or template data", async () => {
    mockGenerateRealEstateLandingPage.mockResolvedValueOnce({
      ...generated,
      template: { id: "real-estate", content: { featuredProperties: [{ name: "One property", description: "Insufficient count." }] } },
    });
    expect((await POST(jsonRequest(JSON.stringify({ templateId: "real-estate", brief })))).status).toBe(502);
    mockGenerateRealEstateLandingPage.mockResolvedValueOnce({ ...generated, page: { ...generated.page, headline: "short" } });
    expect((await POST(jsonRequest(JSON.stringify({ templateId: "real-estate", brief })))).status).toBe(502);
  });

  it("maps configuration, refusal, and provider failures without exposing internal details", async () => {
    mockGenerateRealEstateLandingPage.mockRejectedValueOnce(new GenerationError("CONFIGURATION", "private config detail"));
    const configuration = await POST(jsonRequest(JSON.stringify({ templateId: "real-estate", brief })));
    expect(configuration.status).toBe(503);
    expect(await configuration.text()).not.toContain("private config detail");

    mockGenerateRealEstateLandingPage.mockRejectedValueOnce(new GenerationError("REFUSED", "private refusal detail"));
    const refused = await POST(jsonRequest(JSON.stringify({ templateId: "real-estate", brief })));
    expect(refused.status).toBe(422);
    expect(await refused.text()).not.toContain("private refusal detail");

    mockGenerateRealEstateLandingPage.mockRejectedValueOnce(new Error("private provider stack OPENAI_API_KEY"));
    const provider = await POST(jsonRequest(JSON.stringify({ templateId: "real-estate", brief })));
    expect(provider.status).toBe(502);
    const body = await provider.text();
    expect(body).not.toContain("private provider stack");
    expect(body).not.toContain("OPENAI_API_KEY");
    expect(provider.headers.get("cache-control")).toBe("no-store");
  });
});
