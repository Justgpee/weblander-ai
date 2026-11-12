import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const jsonRequest = (body: string, extraHeaders: Record<string, string> = {}) => new Request("http://localhost/api/generate-page", { method: "POST", headers: { "content-type": "application/json", ...extraHeaders }, body });

describe("POST /api/generate-page", () => {
  beforeEach(() => mockGenerateSitePage.mockReset());
  afterEach(() => vi.unstubAllEnvs());

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
    expect(response.headers.has("x-generation-vercel-id")).toBe(false);
    expect(await response.json()).toEqual({ data: generatedPage });
    expect(mockGenerateSitePage).toHaveBeenCalledWith(requestData);
  });

  it("propagates a validated Vercel request ID and returns it on success and handled errors", async () => {
    vi.stubEnv("VERCEL", "1");
    const vercelId = "sfo1::iad1::abc123";
    mockGenerateSitePage.mockResolvedValueOnce(generatedPage);
    const success = await POST(jsonRequest(JSON.stringify(requestData), { "x-vercel-id": vercelId }));
    expect(success.status).toBe(200);
    expect(success.headers.get("x-generation-vercel-id")).toBe(vercelId);
    expect(mockGenerateSitePage).toHaveBeenCalledWith(requestData, undefined, { vercelRequestId: vercelId });

    mockGenerateSitePage.mockRejectedValueOnce(new Error("private provider response sk-secret"));
    const failed = await POST(jsonRequest(JSON.stringify(requestData), { "x-vercel-id": vercelId }));
    expect(failed.status).toBe(502);
    expect(failed.headers.get("x-generation-vercel-id")).toBe(vercelId);
    const body = await failed.text();
    expect(body).not.toMatch(/private provider response|sk-secret/);
  });

  it.each([
    ["missing", undefined],
    ["malformed", "client-controlled identifier"],
    ["excessively long", `sfo1::${"a".repeat(300)}`],
  ])("continues with existing correlation behavior for %s Vercel IDs", async (_label, id) => {
    vi.stubEnv("VERCEL", "1");
    mockGenerateSitePage.mockResolvedValue(generatedPage);
    const response = await POST(jsonRequest(JSON.stringify(requestData), id ? { "x-vercel-id": id } : {}));
    expect(response.status).toBe(200);
    expect(response.headers.has("x-generation-vercel-id")).toBe(false);
    expect(mockGenerateSitePage).toHaveBeenCalledWith(requestData);
  });

  it("ignores a client-supplied x-vercel-id outside a Vercel deployment", async () => {
    vi.stubEnv("VERCEL", "");
    mockGenerateSitePage.mockResolvedValue(generatedPage);
    const response = await POST(jsonRequest(JSON.stringify(requestData), { "x-vercel-id": "sfo1::iad1::abc123" }));
    expect(response.headers.has("x-generation-vercel-id")).toBe(false);
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
