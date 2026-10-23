import { GeneratedPageSchema, SectionContentSchemas, type BusinessBrief, type EditableSection, type GeneratedPage } from "@/lib/generation";
import { GenerationError } from "@/lib/ai/errors";
import { requestGeneratedContent, requestGeneratedFashionContent, requestGeneratedRealEstateContent, requestGeneratedRestaurantContent, requestGeneratedSection } from "@/lib/ai/openai-provider";
import {
  FashionContentSchema,
  FashionTemplateStructuredOutputSchema,
  FashionSiteTemplateSchema,
  type FashionSiteTemplate,
  RealEstateContentSchema,
  RealEstateSiteTemplateSchema,
  RealEstateTemplateStructuredOutputSchema,
  type RealEstateSiteTemplate,
  RestaurantContentSchema,
  RestaurantTemplateStructuredOutputSchema,
  RestaurantSiteTemplateSchema,
  type RestaurantSiteTemplate,
} from "@/lib/site-templates";

export type ContentProvider = (brief: BusinessBrief) => Promise<unknown>;
export type SectionContentProvider = (brief: BusinessBrief, section: EditableSection) => Promise<unknown>;
export type RestaurantContentProvider = (brief: BusinessBrief) => Promise<unknown>;
export type FashionContentProvider = (brief: BusinessBrief) => Promise<unknown>;
export type RealEstateContentProvider = (brief: BusinessBrief) => Promise<unknown>;

export async function generateLandingPage(
  brief: BusinessBrief,
  layout: GeneratedPage["layout"],
  provider: ContentProvider = requestGeneratedContent,
): Promise<GeneratedPage> {
  let content: unknown;
  try {
    content = await provider(brief);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("PROVIDER", "The generation service is temporarily unavailable. Please try again.");
  }

  const result = GeneratedPageSchema.safeParse({ ...brief, ...content as object, layout });
  if (!result.success) throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable content. Please try again.");
  return result.data;
}

export async function regeneratePageSection(
  brief: BusinessBrief,
  section: EditableSection,
  provider: SectionContentProvider = requestGeneratedSection,
) {
  let content: unknown;
  try {
    content = await provider(brief, section);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("PROVIDER", "The generation service is temporarily unavailable. Please try again.");
  }

  const result = SectionContentSchemas[section].safeParse(content);
  if (!result.success) throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable content. Please try again.");
  return result.data;
}

export async function generateRestaurantLandingPage(
  brief: BusinessBrief,
  layout: GeneratedPage["layout"],
  provider: RestaurantContentProvider = requestGeneratedRestaurantContent,
): Promise<{ page: GeneratedPage; template: RestaurantSiteTemplate }> {
  let output: unknown;
  try {
    output = await provider(brief);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("PROVIDER", "The generation service is temporarily unavailable. Please try again.");
  }

  const structured = RestaurantTemplateStructuredOutputSchema.safeParse(output);
  if (!structured.success) {
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable restaurant content. Please try again.");
  }

  const optionalFact = (value: string | null) => value?.trim() ? value.trim() : undefined;
  const story = optionalFact(structured.data.restaurantContent.story);
  const location = optionalFact(structured.data.restaurantContent.location);
  const openingHours = optionalFact(structured.data.restaurantContent.openingHours);
  const contentResult = RestaurantContentSchema.safeParse({
    menuHighlights: structured.data.restaurantContent.menuHighlights,
    ...(story ? { story } : {}),
    ...(location ? { location } : {}),
    ...(openingHours ? { openingHours } : {}),
  });
  const pageResult = GeneratedPageSchema.safeParse({ ...brief, ...structured.data.pageContent, layout });
  if (!contentResult.success || !pageResult.success) {
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable restaurant content. Please try again.");
  }

  const templateResult = RestaurantSiteTemplateSchema.safeParse({ id: "restaurant", content: contentResult.data });
  if (!templateResult.success) {
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable restaurant content. Please try again.");
  }
  return { page: pageResult.data, template: templateResult.data };
}

export async function generateFashionLandingPage(
  brief: BusinessBrief,
  layout: GeneratedPage["layout"],
  provider: FashionContentProvider = requestGeneratedFashionContent,
): Promise<{ page: GeneratedPage; template: FashionSiteTemplate }> {
  let output: unknown;
  try {
    output = await provider(brief);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("PROVIDER", "The generation service is temporarily unavailable. Please try again.");
  }

  const structured = FashionTemplateStructuredOutputSchema.safeParse(output);
  if (!structured.success) {
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable fashion content. Please try again.");
  }

  const story = structured.data.fashionContent.brandStory?.trim();
  const contentResult = FashionContentSchema.safeParse({
    collectionHighlights: structured.data.fashionContent.collectionHighlights,
    ...(story ? { brandStory: story } : {}),
  });
  const pageResult = GeneratedPageSchema.safeParse({ ...brief, ...structured.data.pageContent, layout });
  if (!contentResult.success || !pageResult.success) {
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable fashion content. Please try again.");
  }

  const templateResult = FashionSiteTemplateSchema.safeParse({ id: "fashion", content: contentResult.data });
  if (!templateResult.success) {
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable fashion content. Please try again.");
  }
  return { page: pageResult.data, template: templateResult.data };
}

export async function generateRealEstateLandingPage(
  brief: BusinessBrief,
  layout: GeneratedPage["layout"],
  provider: RealEstateContentProvider = requestGeneratedRealEstateContent,
): Promise<{ page: GeneratedPage; template: RealEstateSiteTemplate }> {
  let output: unknown;
  try {
    output = await provider(brief);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError("PROVIDER", "The generation service is temporarily unavailable. Please try again.");
  }

  const structured = RealEstateTemplateStructuredOutputSchema.safeParse(output);
  if (!structured.success) {
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable Real Estate content. Please try again.");
  }

  const agencyStory = structured.data.realEstateContent.agencyStory?.trim();
  const contentResult = RealEstateContentSchema.safeParse({
    featuredProperties: structured.data.realEstateContent.featuredProperties,
    ...(agencyStory ? { agencyStory } : {}),
  });
  const pageResult = GeneratedPageSchema.safeParse({ ...brief, ...structured.data.pageContent, layout });
  if (!contentResult.success || !pageResult.success) {
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable Real Estate content. Please try again.");
  }

  const templateResult = RealEstateSiteTemplateSchema.safeParse({ id: "real-estate", content: contentResult.data });
  if (!templateResult.success) {
    throw new GenerationError("INVALID_OUTPUT", "The generation service returned unusable Real Estate content. Please try again.");
  }
  return { page: pageResult.data, template: templateResult.data };
}
