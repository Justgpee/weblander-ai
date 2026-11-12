import { describe, expect, it } from "vitest";
import { MAX_SITE_LOGO_BYTES, siteLogoAssetDataUrl, siteLogoMimeTypeFromBytes, validateSiteLogoFile } from "@/lib/site-logo";

const pngSignature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function file(bytes: Uint8Array, type = "image/png", declaredSize = bytes.length) {
  return { size: declaredSize, type, arrayBuffer: () => {
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return Promise.resolve(copy.buffer as ArrayBuffer);
  } };
}

describe("project logo asset validation", () => {
  it("accepts supported image signatures only after successful decode", async () => {
    const decoded: Array<{ width: number; height: number }> = [];
    const result = await validateSiteLogoFile(file(pngSignature), async () => {
      const dimensions = { width: 320, height: 120 };
      decoded.push(dimensions);
      return dimensions;
    });
    expect(result).toMatchObject({ mimeType: "image/png", width: 320, height: 120, blob: { type: "image/png" } });
    expect(decoded).toHaveLength(1);
    expect(siteLogoMimeTypeFromBytes(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(siteLogoMimeTypeFromBytes(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });

  it("rejects empty, oversized, mismatched, corrupt, and undecodable files", async () => {
    const decode = async () => ({ width: 100, height: 40 });
    await expect(validateSiteLogoFile(file(new Uint8Array(), "image/png"), decode)).rejects.toThrow("non-empty");
    await expect(validateSiteLogoFile(file(pngSignature, "image/png", MAX_SITE_LOGO_BYTES + 1), decode)).rejects.toThrow("2 MB or smaller");
    await expect(validateSiteLogoFile(file(pngSignature, "image/jpeg"), decode)).rejects.toThrow("valid PNG");
    await expect(validateSiteLogoFile(file(Uint8Array.from([1, 2, 3]), "image/png"), decode)).rejects.toThrow("valid PNG");
    await expect(validateSiteLogoFile(file(pngSignature), async () => { throw new Error("private decode detail"); })).rejects.toThrow("could not be opened");
    await expect(validateSiteLogoFile(file(pngSignature), async () => ({ width: 0, height: 40 }))).rejects.toThrow("invalid dimensions");
  });

  it("builds the data URL from the validated bytes", () => {
    expect(siteLogoAssetDataUrl("image/png", pngSignature)).toBe(`data:image/png;base64,${Buffer.from(pngSignature).toString("base64")}`);
  });
});
