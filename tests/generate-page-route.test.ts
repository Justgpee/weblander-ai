import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateSitePage } = vi.hoisted(() => ({ mockGenerateSitePage: vi.fn() }));
vi.mock("@/lib/ai/generate-site-page", () => ({ generateSitePage: mockGenerateSitePage }));

import { POST } from "@/app/api/generate-page/route";
import { GenerationError } from "@/lib/ai/errors";

const brief = { businessName: "Juniper Kitchen", description: "Seasonal neighborhood cooking from locally supplied ingredients.", audience: "Local diners", offering: "Seasonal plates", callToAction: "View the menu", style: "Professional" };
const requestData = {
  brief,
  pageType: "about",
  identity: { id: "about", slug: "about", title: "About" },
  template: { id: "generic" },
};
const generatedPage = {
  ...requestData.identity,
  content: {
    headline: "A neighborhood table with a seasonal point of view",
    description: "Thoughtful cooking brings local diners together around generous plates and familiar hospitality.",
    features: ["Seasonal ingredients prepared with care", "A welcoming table for local diners"],
    callToAction: "Discover our story",
  },
  template: { id: "generic" },
};
const jsonRequest = (body: string) => new Request("http://localhost/api/generate-page", { method: "POST", headers: { "content-type": "application/json" }, body });

describe("POST /api/generate-page", () => {
  beforeEach(() => mockGenerateSitePage.mockReset());

  it("validates page-scoped requests and returns one validated page record", async () => {
    const mismatchedRequest = {
      ...requestData,
      pageType: "products",
      template: { id: "restaurant", content: { menuHighlights: [
        { name: "Garden pasta", description: "Fresh pasta with seasonal vegetables and herbs." },
        { name: "Roasted carrots", description: "Slow-roasted carrots with a bright citrus dressing." },
      ] } },
    };
    expect((await POST(jsonRequest(JSON.stringify(mismatchedRequest)))).status).toBe(400);
    expect(mockGenerateSitePage).not.toHaveBeenCalled();

    mockGenerateSitePage.mockResolvedValue(generatedPage);
    const response = await POST(jsonRequest(JSON.stringify(requestData)));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ data: generatedPage });
    expect(mockGenerateSitePage).toHaveBeenCalledWith(requestData);
  });

  it("rejects malformed JSON, unsupported media type, and oversized bodies", async () => {
    expect((await POST(jsonRequest("{"))).status).toBe(400);
    expect((await POST(jsonRequest(" ".repeat(8193)))).status).toBe(413);
    const unsupported = new Request("http://localhost/api/generate-page", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
    expect((await POST(unsupported)).status).toBe(415);
  });

  it("safely handles invalid service results, configuration errors, and provider failures", async () => {
    mockGenerateSitePage.mockResolvedValueOnce({ ...generatedPage, template: { id: "restaurant" } });
    expect((await POST(jsonRequest(JSON.stringify(requestData)))).status).toBe(502);

    mockGenerateSitePage.mockRejectedValueOnce(new GenerationError("CONFIGURATION", "private config detail"));
    const configuration = await POST(jsonRequest(JSON.stringify(requestData)));
    expect(configuration.status).toBe(503);
    expect(await configuration.text()).not.toContain("private config detail");

    mockGenerateSitePage.mockRejectedValueOnce(new Error("private provider stack"));
    const provider = await POST(jsonRequest(JSON.stringify(requestData)));
    expect(provider.status).toBe(502);
    const body = await provider.text();
    expect(body).not.toContain("private provider stack");
    expect(body).not.toContain("OPENAI_API_KEY");
  });
});
