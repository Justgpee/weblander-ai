import { describe, expect, it } from "vitest";
import { generateHeroImage } from "@/lib/ai/generate-image";

const brief = {
  businessName: "Northline Studio", description: "Brand identity and digital design for climate ventures.",
  audience: "Early-stage founders", offering: "Brand identity", callToAction: "Book a call", style: "Professional" as const,
};
const validImage = { mimeType: "image/webp", base64: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).toString("base64") };

describe("generateHeroImage", () => {
  it("validates mocked provider image data", async () => {
    await expect(generateHeroImage({ brief }, async () => validImage)).resolves.toEqual(validImage);
  });

  it("rejects malformed provider data and maps failures to safe errors", async () => {
    await expect(generateHeroImage({ brief }, async () => ({ mimeType: "image/svg+xml", base64: "PHN2Zz4=" })))
      .rejects.toMatchObject({ code: "INVALID_OUTPUT", message: "The image service returned unusable content. Please try again." });
    await expect(generateHeroImage({ brief }, async () => { throw new Error("private provider stack and key"); }))
      .rejects.toMatchObject({ code: "PROVIDER", message: "Image generation is temporarily unavailable. Please try again." });
  });
});
