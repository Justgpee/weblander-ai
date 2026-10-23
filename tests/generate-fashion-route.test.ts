import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateFashionLandingPage } = vi.hoisted(() => ({ mockGenerateFashionLandingPage: vi.fn() }));
vi.mock("@/lib/ai/generate-page", () => ({ generateFashionLandingPage: mockGenerateFashionLandingPage }));

import { POST } from "@/app/api/generate-fashion/route";
import { GenerationError } from "@/lib/ai/errors";

const brief = {
  businessName: "Northline Studio",
  description: "Independent fashion design for everyday dressing and personal expression.",
  audience: "People seeking considered clothing",
  offering: "Fashion collections",
  callToAction: "Explore the collection",
  style: "Professional",
};
const generated = {
  page: {
    ...brief,
    headline: "A more considered way to get dressed",
    subheadline: "Independent fashion for people who value thoughtful pieces and everyday expression.",
    features: ["Considered ideas for personal style", "A thoughtful direction for everyday wear"],
    layout: "editorial",
  },
  template: {
    id: "fashion",
    content: {
      collectionHighlights: [
        { name: "Spring layers", description: "Lightweight themes for the changing season and everyday dressing." },
        { name: "Evening edit", description: "A considered direction for after-dark looks and special events." },
      ],
      brandStory: "An independent design studio exploring considered everyday dressing.",
    },
  },
};
const jsonRequest = (body: string) => new Request("http://localhost/api/generate-fashion", {
  method: "POST", headers: { "content-type": "application/json" }, body,
});

describe("POST /api/generate-fashion", () => {
  beforeEach(() => mockGenerateFashionLandingPage.mockReset());

  it("validates Fashion requests and returns independently validated no-store data", async () => {
    const wrongTemplate = await POST(jsonRequest(JSON.stringify({ templateId: "restaurant", brief })));
    expect(wrongTemplate.status).toBe(400);
    const invalidBrief = await POST(jsonRequest(JSON.stringify({ templateId: "fashion", brief: { ...brief, businessName: "" } })));
    expect(invalidBrief.status).toBe(400);
    expect(mockGenerateFashionLandingPage).not.toHaveBeenCalled();

    mockGenerateFashionLandingPage.mockResolvedValue(generated);
    const response = await POST(jsonRequest(JSON.stringify({ templateId: "fashion", brief })));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ data: generated });
    expect(mockGenerateFashionLandingPage).toHaveBeenCalledWith(brief, "editorial");
  });

  it("rejects malformed JSON, unsupported media types, and requests larger than 8 KiB", async () => {
    expect((await POST(jsonRequest("{"))).status).toBe(400);
    expect((await POST(jsonRequest(" ".repeat(8193)))).status).toBe(413);
    const unsupported = new Request("http://localhost/api/generate-fashion", {
      method: "POST", headers: { "content-type": "text/plain" }, body: "{}",
    });
    expect((await POST(unsupported)).status).toBe(415);
  });

  it("rejects malformed generated template data and maps provider failures safely", async () => {
    mockGenerateFashionLandingPage.mockResolvedValueOnce({
      ...generated,
      template: { id: "fashion", content: { collectionHighlights: [{ name: "Only collection", description: "This is not enough highlights." }] } },
    });
    expect((await POST(jsonRequest(JSON.stringify({ templateId: "fashion", brief })))).status).toBe(502);
    mockGenerateFashionLandingPage.mockResolvedValueOnce({ ...generated, page: { ...generated.page, headline: "short" } });
    expect((await POST(jsonRequest(JSON.stringify({ templateId: "fashion", brief })))).status).toBe(502);

    mockGenerateFashionLandingPage.mockRejectedValueOnce(new GenerationError("CONFIGURATION", "private config detail"));
    const configuration = await POST(jsonRequest(JSON.stringify({ templateId: "fashion", brief })));
    expect(configuration.status).toBe(503);
    expect(await configuration.text()).not.toContain("private config detail");

    mockGenerateFashionLandingPage.mockRejectedValueOnce(new GenerationError("REFUSED", "private refusal detail"));
    const refused = await POST(jsonRequest(JSON.stringify({ templateId: "fashion", brief })));
    expect(refused.status).toBe(422);
    expect(await refused.text()).not.toContain("private refusal detail");

    mockGenerateFashionLandingPage.mockRejectedValueOnce(new Error("private provider stack"));
    const provider = await POST(jsonRequest(JSON.stringify({ templateId: "fashion", brief })));
    expect(provider.status).toBe(502);
    const body = await provider.text();
    expect(body).not.toContain("private provider stack");
    expect(body).not.toContain("OPENAI_API_KEY");
  });
});
