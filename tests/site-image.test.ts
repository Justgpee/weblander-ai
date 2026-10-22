import { describe, expect, it } from "vitest";
import {
  HeroImageAssetSchema,
  MAX_HERO_IMAGE_BYTES,
  heroImageDataUrl,
} from "@/lib/site-image";

function imageBytes(kind: "png" | "jpeg" | "webp") {
  if (kind === "png") return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  if (kind === "jpeg") return Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  return Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
}

describe("hero image asset schema", () => {
  it("accepts supported raster signatures and creates a data URL", () => {
    for (const [kind, mimeType] of [["png", "image/png"], ["jpeg", "image/jpeg"], ["webp", "image/webp"]] as const) {
      const asset = { mimeType, base64: imageBytes(kind).toString("base64") };
      expect(HeroImageAssetSchema.parse(asset)).toEqual(asset);
      expect(heroImageDataUrl(asset)).toBe(`data:${mimeType};base64,${asset.base64}`);
    }
  });

  it("rejects SVG, unknown MIME types, malformed base64, and MIME/signature mismatches", () => {
    expect(() => HeroImageAssetSchema.parse({ mimeType: "image/svg+xml", base64: "PHN2Zz4=" })).toThrow();
    expect(() => HeroImageAssetSchema.parse({ mimeType: "image/png", base64: Buffer.from("<svg/>").toString("base64") })).toThrow();
    expect(() => HeroImageAssetSchema.parse({ mimeType: "image/png", base64: "%%%=" })).toThrow();
    expect(() => HeroImageAssetSchema.parse({ mimeType: "image/webp", base64: imageBytes("png").toString("base64") })).toThrow();
    expect(() => HeroImageAssetSchema.parse({ mimeType: "image/png", base64: "" })).toThrow();
  });

  it("rejects image payloads larger than the fixed byte limit", () => {
    const tooLarge = Buffer.alloc(MAX_HERO_IMAGE_BYTES + 1);
    tooLarge.set(imageBytes("webp"), 0);
    expect(() => HeroImageAssetSchema.parse({ mimeType: "image/webp", base64: tooLarge.toString("base64") })).toThrow();
  });
});
