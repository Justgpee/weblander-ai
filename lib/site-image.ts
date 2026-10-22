import { z } from "zod";
import { BusinessBriefSchema } from "@/lib/generation";

/** Keep one embedded image small enough for browser storage and standalone exports. */
export const MAX_HERO_IMAGE_BYTES = 1_500_000;
export const MAX_HERO_IMAGE_BASE64_LENGTH = Math.ceil(MAX_HERO_IMAGE_BYTES / 3) * 4;

export const HeroImageMimeTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);

function isStrictBase64(value: string) {
  if (!value || value.length > MAX_HERO_IMAGE_BASE64_LENGTH || value.length % 4 !== 0) return false;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return false;
  try {
    const decoded = atob(value);
    if (decoded.length === 0 || decoded.length > MAX_HERO_IMAGE_BYTES) return false;
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isWebp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    return isPng || isJpeg || isWebp;
  } catch {
    return false;
  }
}

/** Hero artwork is decorative; generated-site markup always emits an empty alt. */
export const HeroImageAssetSchema = z.object({
  mimeType: HeroImageMimeTypeSchema,
  base64: z.string().max(MAX_HERO_IMAGE_BASE64_LENGTH),
}).strict().superRefine((image, context) => {
  if (!isStrictBase64(image.base64)) {
    context.addIssue({ code: "custom", path: ["base64"], message: "The image data is malformed or exceeds the size limit." });
    return;
  }
  const decoded = atob(image.base64);
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  const matchesMimeType = image.mimeType === "image/png"
    ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    : image.mimeType === "image/jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!matchesMimeType) context.addIssue({ code: "custom", path: ["mimeType"], message: "The image MIME type does not match its data." });
});

export type HeroImageAsset = z.infer<typeof HeroImageAssetSchema>;

export const GenerateHeroImageRequestSchema = z.object({ brief: BusinessBriefSchema }).strict();
export type GenerateHeroImageRequest = z.infer<typeof GenerateHeroImageRequestSchema>;

export function heroImageDataUrl(image: HeroImageAsset) {
  const validated = HeroImageAssetSchema.parse(image);
  return `data:${validated.mimeType};base64,${validated.base64}`;
}
