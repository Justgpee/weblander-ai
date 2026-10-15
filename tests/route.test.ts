import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateLandingPage } = vi.hoisted(() => ({ mockGenerateLandingPage: vi.fn() }));
vi.mock("@/lib/ai/generate-page", () => ({ generateLandingPage: mockGenerateLandingPage }));

import { POST } from "@/app/api/generate/route";
import { GenerationError } from "@/lib/ai/errors";

const brief = { businessName: "Northline", description: "Brand design for climate ventures.", audience: "Early-stage founders", offering: "Brand identity", callToAction: "Book a call", style: "Professional" };
const jsonRequest = (body: string) => new Request("http://localhost/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body });

describe("POST /api/generate", () => {
  beforeEach(() => { mockGenerateLandingPage.mockReset(); });

  it("rejects invalid briefs and does not call the provider", async () => {
    const response = await POST(jsonRequest(JSON.stringify({ ...brief, style: "Invalid" })));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_BRIEF" } });
    expect(mockGenerateLandingPage).not.toHaveBeenCalled();
  });

  it("handles malformed JSON and oversized bodies", async () => {
    expect((await POST(jsonRequest("{"))).status).toBe(400);
    expect((await POST(jsonRequest(" ".repeat(8193)))).status).toBe(413);
  });

  it("returns validated data and disables caching for successful generation", async () => {
    mockGenerateLandingPage.mockResolvedValue({ ...brief, headline: "Make your next chapter unmistakable.", subheadline: "Brand identity for early-stage climate ventures ready to grow with purpose.", layout: "editorial" });
    const response = await POST(jsonRequest(JSON.stringify(brief)));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ data: { headline: "Make your next chapter unmistakable." } });
  });

  it("maps missing server configuration and provider failures to safe responses", async () => {
    mockGenerateLandingPage.mockRejectedValueOnce(new GenerationError("CONFIGURATION", "Generation is not configured on this server."));
    const configResponse = await POST(jsonRequest(JSON.stringify(brief)));
    expect(configResponse.status).toBe(503);
    mockGenerateLandingPage.mockRejectedValueOnce(new Error("secret provider detail"));
    const providerResponse = await POST(jsonRequest(JSON.stringify(brief)));
    expect(providerResponse.status).toBe(502);
    expect(await providerResponse.text()).not.toContain("secret provider detail");
  });
});
