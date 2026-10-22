import { GenerationError } from "@/lib/ai/errors";
import { requestGeneratedHeroImage } from "@/lib/ai/openai-image-provider";
import { HeroImageAssetSchema, type GenerateHeroImageRequest, type HeroImageAsset } from "@/lib/site-image";

export type HeroImageProvider = (request: GenerateHeroImageRequest) => Promise<unknown>;

export async function generateHeroImage(
  request: GenerateHeroImageRequest,
  provider: HeroImageProvider = requestGeneratedHeroImage,
): Promise<HeroImageAsset> {
  let image: unknown;
  try {
    image = await provider(request);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("PROVIDER", "Image generation is temporarily unavailable. Please try again.");
  }
  const result = HeroImageAssetSchema.safeParse(image);
  if (!result.success) throw new GenerationError("INVALID_OUTPUT", "The image service returned unusable content. Please try again.");
  return result.data;
}
