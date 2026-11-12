import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRegenerateSitePageSection } = vi.hoisted(() => ({ mockRegenerateSitePageSection: vi.fn() }));
vi.mock("@/lib/ai/generate-site-section", () => ({ regenerateSitePageSection: mockRegenerateSitePageSection }));

import { POST } from "@/app/api/regenerate-page-section/route";

const validBody = {
  projectId: null,
  brief: { businessName: "Juniper Studio", description: "A neighborhood business offering thoughtful and useful services to its community.", audience: "Local customers", offering: "Considered services", callToAction: "Get in touch", style: "Professional" },
  page: {
    id: "about", slug: "about", title: "About", kind: "about",
    template: { id: "fashion", content: { collectionHighlights: [{ name: "Everyday layers", description: "Easy pieces for changing seasons." }, { name: "Evening edit", description: "A considered direction for after dark." }] } },
  },
  section: "collectionHighlights",
};
const request = (body: unknown, extraHeaders: Record<string, string> = {}) => new Request("http://localhost/api/regenerate-page-section", {
  method: "POST", headers: { "content-type": "application/json", ...extraHeaders }, body: JSON.stringify(body),
});

describe("POST /api/regenerate-page-section", () => {
  beforeEach(() => { mockRegenerateSitePageSection.mockReset(); vi.stubEnv("VERCEL", ""); });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects invalid section/template combinations before generation", async () => {
    const invalid = await POST(request({ ...validBody, page: { ...validBody.page, template: { id: "generic" } }, section: "menuHighlights" }));
    expect(invalid.status).toBe(400);
    expect(mockRegenerateSitePageSection).not.toHaveBeenCalled();
  });

  it("returns only validated requested section data for a secondary page", async () => {
    const result = { collectionHighlights: [{ name: "Spring layers", description: "Light pieces for changing weather." }, { name: "Evening edit", description: "A refined direction for after dark." }] };
    mockRegenerateSitePageSection.mockResolvedValue(result);
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ data: result });
    const call = mockRegenerateSitePageSection.mock.calls[0];
    expect(call[0]).toEqual(validBody);
    expect(call[3]).toMatchObject({ vercelRequestId: undefined });
  });

  it("passes only a validated Vercel runtime ID while leaving request payload and response unchanged", async () => {
    vi.stubEnv("VERCEL", "1");
    mockRegenerateSitePageSection.mockResolvedValue({ collectionHighlights: [
      { name: "Spring layers", description: "Light pieces for changing weather." },
      { name: "Evening edit", description: "A refined direction for after dark." },
    ] });
    const response = await POST(request(validBody, { "x-vercel-id": "sfo1::iad1::abc123" }));
    expect(response.status).toBe(200);
    expect(response.headers.has("x-generation-vercel-id")).toBe(false);
    expect(await response.json()).toHaveProperty("data.collectionHighlights");
    expect(mockRegenerateSitePageSection.mock.calls[0][3]).toEqual({ vercelRequestId: "sfo1::iad1::abc123" });
  });

  it.each([
    ["missing", undefined],
    ["invalid", "client-controlled-id"],
    ["too long", `sfo1::${"a".repeat(300)}`],
  ])("omits a %s Vercel ID but still calls generation", async (_label, id) => {
    vi.stubEnv("VERCEL", "1");
    mockRegenerateSitePageSection.mockResolvedValue({ collectionHighlights: [
      { name: "Spring layers", description: "Light pieces for changing weather." },
      { name: "Evening edit", description: "A refined direction for after dark." },
    ] });
    const response = await POST(request(validBody, id ? { "x-vercel-id": id } : {}));
    expect(response.status).toBe(200);
    expect(mockRegenerateSitePageSection.mock.calls[0][3]).toEqual({ vercelRequestId: undefined });
  });

  it("rejects malformed generated output without returning its contents", async () => {
    mockRegenerateSitePageSection.mockResolvedValue({ collectionHighlights: [{ name: "private provider body sk-secret", description: "" }] });
    const response = await POST(request(validBody));
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).not.toMatch(/private provider body|sk-secret|OPENAI_API_KEY/);
  });
});
