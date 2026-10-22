import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerateHeroImage } = vi.hoisted(() => ({ mockGenerateHeroImage: vi.fn() }));
vi.mock("@/lib/ai/generate-image", () => ({ generateHeroImage: mockGenerateHeroImage }));

import { POST } from "@/app/api/generate-image/route";
import { GenerationError } from "@/lib/ai/errors";

const brief = { businessName: "Northline", description: "Brand design for climate ventures.", audience: "Early-stage founders", offering: "Brand identity", callToAction: "Book a call", style: "Professional" };
const image = { mimeType: "image/webp", base64: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).toString("base64") };
const request = (body: string, contentType = "application/json") => new Request("http://localhost/api/generate-image", { method: "POST", headers: { "content-type": contentType }, body });

describe("POST /api/generate-image", () => {
  beforeEach(() => mockGenerateHeroImage.mockReset());

  it("validates requests and body size before calling the provider", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request(" ".repeat(8193)))).status).toBe(413);
    expect((await POST(request(JSON.stringify({ brief, extra: true })))).status).toBe(400);
    expect((await POST(request(JSON.stringify({ brief }), "text/plain"))).status).toBe(415);
    expect(mockGenerateHeroImage).not.toHaveBeenCalled();
  });

  it("returns validated image data with no-store headers", async () => {
    mockGenerateHeroImage.mockResolvedValue(image);
    const response = await POST(request(JSON.stringify({ brief })));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ data: image });
  });

  it("maps configuration, invalid image, and provider errors without exposing details", async () => {
    mockGenerateHeroImage.mockRejectedValueOnce(new GenerationError("CONFIGURATION", "secret config"));
    expect((await POST(request(JSON.stringify({ brief })))).status).toBe(503);
    mockGenerateHeroImage.mockRejectedValueOnce(new GenerationError("INVALID_OUTPUT", "private output"));
    expect((await POST(request(JSON.stringify({ brief })))).status).toBe(502);
    mockGenerateHeroImage.mockRejectedValueOnce(new Error("private provider credentials"));
    const failed = await POST(request(JSON.stringify({ brief })));
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toMatch(/private|credentials|secret/);
  });
});
