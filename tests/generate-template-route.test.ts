import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateRestaurantLandingPage } = vi.hoisted(() => ({ mockGenerateRestaurantLandingPage: vi.fn() }));
vi.mock("@/lib/ai/generate-page", () => ({ generateRestaurantLandingPage: mockGenerateRestaurantLandingPage }));

import { POST } from "@/app/api/generate-template/route";
import { GenerationError } from "@/lib/ai/errors";

const brief = { businessName: "Juniper Kitchen", description: "Seasonal neighborhood cooking from locally supplied ingredients.", audience: "Local diners", offering: "Seasonal plates", callToAction: "View the menu", style: "Professional" };
const generated = {
  page: {
    ...brief,
    headline: "Seasonal cooking for the whole table",
    subheadline: "Thoughtful neighborhood food shaped by the seasons and made for sharing.",
    features: ["Seasonal ingredients prepared with care", "A welcoming table for local diners"],
    layout: "editorial",
  },
  template: {
    id: "restaurant",
    content: { menuHighlights: [
      { name: "Garden pasta", description: "Fresh pasta with seasonal vegetables and herbs." },
      { name: "Roasted carrots", description: "Slow-roasted carrots with a bright citrus dressing." },
    ] },
  },
};
const jsonRequest = (body: string) => new Request("http://localhost/api/generate-template", { method: "POST", headers: { "content-type": "application/json" }, body });

describe("POST /api/generate-template", () => {
  beforeEach(() => mockGenerateRestaurantLandingPage.mockReset());

  it("validates requests before calling the provider and returns no-store validated data", async () => {
    const invalid = await POST(jsonRequest(JSON.stringify({ templateId: "generic", brief })));
    expect(invalid.status).toBe(400);
    expect(mockGenerateRestaurantLandingPage).not.toHaveBeenCalled();
    const invalidBrief = await POST(jsonRequest(JSON.stringify({ templateId: "restaurant", brief: { ...brief, businessName: "" } })));
    expect(invalidBrief.status).toBe(400);
    expect(mockGenerateRestaurantLandingPage).not.toHaveBeenCalled();

    mockGenerateRestaurantLandingPage.mockResolvedValue(generated);
    const response = await POST(jsonRequest(JSON.stringify({ templateId: "restaurant", brief })));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ data: generated });
    expect(mockGenerateRestaurantLandingPage).toHaveBeenCalledWith(brief, "editorial");
  });

  it("rejects malformed JSON, unsupported media type, and oversized requests", async () => {
    expect((await POST(jsonRequest("{"))).status).toBe(400);
    expect((await POST(jsonRequest(" ".repeat(8193)))).status).toBe(413);
    const unsupported = new Request("http://localhost/api/generate-template", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    expect((await POST(unsupported)).status).toBe(415);
  });

  it("rejects invalid service output and maps provider failures without leaking details", async () => {
    mockGenerateRestaurantLandingPage.mockResolvedValueOnce({ ...generated, template: { id: "restaurant", content: { menuHighlights: [] } } });
    expect((await POST(jsonRequest(JSON.stringify({ templateId: "restaurant", brief })))).status).toBe(502);
    mockGenerateRestaurantLandingPage.mockRejectedValueOnce(new GenerationError("CONFIGURATION", "private config detail"));
    const configuration = await POST(jsonRequest(JSON.stringify({ templateId: "restaurant", brief })));
    expect(configuration.status).toBe(503);
    expect(await configuration.text()).not.toContain("private config detail");
    mockGenerateRestaurantLandingPage.mockRejectedValueOnce(new Error("private provider stack"));
    const provider = await POST(jsonRequest(JSON.stringify({ templateId: "restaurant", brief })));
    expect(provider.status).toBe(502);
    const body = await provider.text();
    expect(body).not.toContain("private provider stack");
    expect(body).not.toContain("OPENAI_API_KEY");
  });
});
