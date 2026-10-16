import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRegeneratePageSection } = vi.hoisted(() => ({ mockRegeneratePageSection: vi.fn() }));
vi.mock("@/lib/ai/generate-page", () => ({ regeneratePageSection: mockRegeneratePageSection }));

import { POST } from "@/app/api/regenerate-section/route";
import { GenerationError } from "@/lib/ai/errors";

const brief = { businessName: "Northline", description: "Brand design for climate ventures.", audience: "Early-stage founders", offering: "Brand identity", callToAction: "Book a call", style: "Professional" };
const request = (body: string) => new Request("http://localhost/api/regenerate-section", { method: "POST", headers: { "content-type": "application/json" }, body });

describe("POST /api/regenerate-section", () => {
  beforeEach(() => mockRegeneratePageSection.mockReset());

  it("validates requests before invoking generation", async () => {
    const response = await POST(request(JSON.stringify({ brief, section: "unknown" })));
    expect(response.status).toBe(400);
    expect(mockRegeneratePageSection).not.toHaveBeenCalled();
  });

  it("returns validated section data with no-store headers", async () => {
    mockRegeneratePageSection.mockResolvedValue({ features: ["A thoughtful detail for everyday use", "Made to bring ease to your home"] });
    const response = await POST(request(JSON.stringify({ brief, section: "features" })));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ data: { features: expect.arrayContaining([expect.any(String)]) } });
  });

  it("rejects malformed generated output and hides provider details", async () => {
    mockRegeneratePageSection.mockResolvedValueOnce({ headline: "short" });
    expect((await POST(request(JSON.stringify({ brief, section: "headline" })))).status).toBe(502);
    mockRegeneratePageSection.mockRejectedValueOnce(new Error("secret provider detail"));
    const failed = await POST(request(JSON.stringify({ brief, section: "headline" })));
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain("secret provider detail");
    mockRegeneratePageSection.mockRejectedValueOnce(new GenerationError("CONFIGURATION", "Generation is not configured on this server."));
    expect((await POST(request(JSON.stringify({ brief, section: "headline" })))).status).toBe(503);
  });
});
