import { z } from "zod";
import { BusinessBriefSchema, GeneratedPageContentSchema } from "@/lib/generation";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";

export const SITE_TEMPLATE_IDS = ["generic", "restaurant", "fashion", "real-estate"] as const;
export const SiteTemplateIdSchema = z.enum(SITE_TEMPLATE_IDS);
export type SiteTemplateId = z.infer<typeof SiteTemplateIdSchema>;

export const RestaurantMenuHighlightSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(160),
}).strict();

export const RestaurantContentSchema = z.object({
  menuHighlights: z.array(RestaurantMenuHighlightSchema).min(2).max(4),
  // Optional story copy may be omitted when the project has no supplied detail.
  story: z.string().trim().min(1).max(600).optional(),
  // Location and hours are optional and should only be populated from supplied business details.
  location: z.string().trim().min(1).max(240).optional(),
  openingHours: z.string().trim().min(1).max(240).optional(),
}).strict();
export type RestaurantContent = z.infer<typeof RestaurantContentSchema>;

export const FashionCollectionHighlightSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(160),
}).strict();

/** Empty optional stories are omitted by editors and generation services, as with restaurant content. */
export const FashionContentSchema = z.object({
  collectionHighlights: z.array(FashionCollectionHighlightSchema).min(2).max(4),
  brandStory: z.string().trim().min(1).max(600).optional(),
}).strict();
export type FashionContent = z.infer<typeof FashionContentSchema>;

export const RealEstateFeaturedPropertySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(200),
}).strict();

export const RealEstateContentSchema = z.object({
  featuredProperties: z.array(RealEstateFeaturedPropertySchema).min(2).max(4),
  agencyStory: z.string().trim().min(1).max(600).optional(),
}).strict();
export type RealEstateContent = z.infer<typeof RealEstateContentSchema>;

export const GenericSiteTemplateSchema = z.object({
  id: z.literal("generic"),
}).strict();

export const RestaurantSiteTemplateSchema = z.object({
  id: z.literal("restaurant"),
  content: RestaurantContentSchema,
}).strict();
export type RestaurantSiteTemplate = z.infer<typeof RestaurantSiteTemplateSchema>;

export const FashionSiteTemplateSchema = z.object({
  id: z.literal("fashion"),
  content: FashionContentSchema,
}).strict();
export type FashionSiteTemplate = z.infer<typeof FashionSiteTemplateSchema>;

export const RealEstateSiteTemplateSchema = z.object({
  id: z.literal("real-estate"),
  content: RealEstateContentSchema,
}).strict();
export type RealEstateSiteTemplate = z.infer<typeof RealEstateSiteTemplateSchema>;

/** Frozen template union for collection v5 validation and migration. */
export const SiteTemplateV5Schema = z.discriminatedUnion("id", [
  GenericSiteTemplateSchema,
  RestaurantSiteTemplateSchema,
]);

/** Frozen template union for collection v6 validation and migration. */
export const SiteTemplateV6Schema = z.discriminatedUnion("id", [
  GenericSiteTemplateSchema,
  RestaurantSiteTemplateSchema,
  FashionSiteTemplateSchema,
]);

/** Template-specific content stays separate from the business brief and page copy. */
export const SiteTemplateSchema = z.discriminatedUnion("id", [
  GenericSiteTemplateSchema,
  RestaurantSiteTemplateSchema,
  FashionSiteTemplateSchema,
  RealEstateSiteTemplateSchema,
]);
export type SiteTemplate = z.infer<typeof SiteTemplateSchema>;

export const DEFAULT_SITE_TEMPLATE: SiteTemplate = { id: "generic" };

/** Intended initial navigation labels for a newly selected restaurant template. */
export const RESTAURANT_NAVIGATION_LABELS = ["Our story", "Menu", "Visit"] as const;
export const FASHION_NAVIGATION_LABELS = ["Our story", "Collections", "Journal"] as const;
export const REAL_ESTATE_NAVIGATION_LABELS = ["Home", "Properties", "Our story"] as const;

function matchesNavigation(settings: SiteSettings, labels: readonly string[], destinations: readonly (string | readonly string[])[]) {
  return settings.navigation.every((entry, index) => {
    const allowedDestinations = destinations[index];
    return entry.label === labels[index]
      && (Array.isArray(allowedDestinations) ? allowedDestinations.includes(entry.destination) : entry.destination === allowedDestinations);
  });
}

/** Apply restaurant section links only when the project still has untouched generic defaults. */
export function initializeRestaurantNavigation(settings: SiteSettings, content: RestaurantContent): SiteSettings {
  const isUntouchedDefault = settings.navigation.every((entry, index) => {
    const defaultEntry = DEFAULT_SITE_SETTINGS.navigation[index];
    return entry.label === defaultEntry.label && entry.destination === defaultEntry.destination;
  });
  if (!isUntouchedDefault) return settings;

  return {
    ...settings,
    navigation: [
      { label: RESTAURANT_NAVIGATION_LABELS[0], destination: content.story?.trim() ? "#site-story" : "" },
      { label: RESTAURANT_NAVIGATION_LABELS[1], destination: "#site-menu" },
      { label: RESTAURANT_NAVIGATION_LABELS[2], destination: content.location?.trim() || content.openingHours?.trim() ? "#site-visit" : "" },
    ],
  };
}

/** Apply Fashion section links only when the project still has untouched generic defaults. */
export function initializeFashionNavigation(settings: SiteSettings, content: FashionContent): SiteSettings {
  const isUntouchedDefault = settings.navigation.every((entry, index) => {
    const defaultEntry = DEFAULT_SITE_SETTINGS.navigation[index];
    return entry.label === defaultEntry.label && entry.destination === defaultEntry.destination;
  });
  if (!isUntouchedDefault) return settings;

  return {
    ...settings,
    navigation: [
      { label: FASHION_NAVIGATION_LABELS[0], destination: content.brandStory?.trim() ? "#site-brand-story" : "" },
      { label: FASHION_NAVIGATION_LABELS[1], destination: "#site-collections" },
      { label: FASHION_NAVIGATION_LABELS[2], destination: "" },
    ],
  };
}

/**
 * Replace untouched generic or known template-default navigation when a Real Estate
 * project is opened/generated. Custom navigation, including valid custom URLs, stays intact.
 */
export function initializeRealEstateNavigation(settings: SiteSettings, content: RealEstateContent): SiteSettings {
  const isGenericDefault = matchesNavigation(
    settings,
    DEFAULT_SITE_SETTINGS.navigation.map(({ label }) => label),
    DEFAULT_SITE_SETTINGS.navigation.map(({ destination }) => destination),
  );
  const isRestaurantDefault = matchesNavigation(settings, RESTAURANT_NAVIGATION_LABELS, [
    ["", "#site-story"], "#site-menu", ["", "#site-visit"],
  ]);
  const isFashionDefault = matchesNavigation(settings, FASHION_NAVIGATION_LABELS, [
    ["", "#site-brand-story"], "#site-collections", "",
  ]);
  const isRealEstateDefault = matchesNavigation(settings, REAL_ESTATE_NAVIGATION_LABELS, [
    "#top", "#site-properties", ["", "#site-agency-story"],
  ]);
  if (!isGenericDefault && !isRestaurantDefault && !isFashionDefault && !isRealEstateDefault) return settings;

  return {
    ...settings,
    navigation: [
      { label: REAL_ESTATE_NAVIGATION_LABELS[0], destination: "#top" },
      { label: REAL_ESTATE_NAVIGATION_LABELS[1], destination: "#site-properties" },
      { label: REAL_ESTATE_NAVIGATION_LABELS[2], destination: content.agencyStory?.trim() ? "#site-agency-story" : "" },
    ],
  };
}

export const RestaurantTemplateGenerationRequestSchema = z.object({
  templateId: z.literal("restaurant"),
  brief: BusinessBriefSchema,
}).strict();
export type RestaurantTemplateGenerationRequest = z.infer<typeof RestaurantTemplateGenerationRequestSchema>;

export const FashionTemplateGenerationRequestSchema = z.object({
  templateId: z.literal("fashion"),
  brief: BusinessBriefSchema,
}).strict();
export type FashionTemplateGenerationRequest = z.infer<typeof FashionTemplateGenerationRequestSchema>;

export const RealEstateTemplateGenerationRequestSchema = z.object({
  templateId: z.literal("real-estate"),
  brief: BusinessBriefSchema,
}).strict();
export type RealEstateTemplateGenerationRequest = z.infer<typeof RealEstateTemplateGenerationRequestSchema>;

/** OpenAI Structured Outputs requires optional facts to be represented as nullable required fields. */
export const RestaurantTemplateStructuredOutputSchema = z.object({
  pageContent: GeneratedPageContentSchema,
  restaurantContent: z.object({
    menuHighlights: z.array(RestaurantMenuHighlightSchema.extend({
      name: z.string().trim(),
      description: z.string().trim(),
    })),
    story: z.string().trim().nullable(),
    location: z.string().trim().nullable(),
    openingHours: z.string().trim().nullable(),
  }).strict(),
}).strict();
export type RestaurantTemplateStructuredOutput = z.infer<typeof RestaurantTemplateStructuredOutputSchema>;

/** OpenAI Structured Outputs gets nullable optional copy; application validation enforces final bounds. */
export const FashionTemplateStructuredOutputSchema = z.object({
  pageContent: GeneratedPageContentSchema,
  fashionContent: z.object({
    collectionHighlights: z.array(FashionCollectionHighlightSchema.extend({
      name: z.string().trim(),
      description: z.string().trim(),
    })),
    brandStory: z.string().trim().nullable(),
  }).strict(),
}).strict();
export type FashionTemplateStructuredOutput = z.infer<typeof FashionTemplateStructuredOutputSchema>;

/** OpenAI structured output models the optional story as nullable; application validation omits it when blank. */
export const RealEstateTemplateStructuredOutputSchema = z.object({
  pageContent: GeneratedPageContentSchema,
  realEstateContent: z.object({
    featuredProperties: z.array(RealEstateFeaturedPropertySchema.extend({
      name: z.string().trim(),
      description: z.string().trim(),
    })),
    agencyStory: z.string().trim().nullable(),
  }).strict(),
}).strict();
export type RealEstateTemplateStructuredOutput = z.infer<typeof RealEstateTemplateStructuredOutputSchema>;
