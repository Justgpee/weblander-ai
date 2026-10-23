import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_SETTINGS } from "@/lib/site-settings";
import {
  DEFAULT_SITE_TEMPLATE,
  RealEstateContentSchema,
  RealEstateFeaturedPropertySchema,
  RealEstateSiteTemplateSchema,
  FashionContentSchema,
  FashionSiteTemplateSchema,
  FashionCollectionHighlightSchema,
  FashionTemplateGenerationRequestSchema,
  FashionTemplateStructuredOutputSchema,
  FASHION_NAVIGATION_LABELS,
  initializeFashionNavigation,
  initializeRealEstateNavigation,
  initializeRestaurantNavigation,
  RESTAURANT_NAVIGATION_LABELS,
  REAL_ESTATE_NAVIGATION_LABELS,
  RestaurantContentSchema,
  RestaurantTemplateGenerationRequestSchema,
  RestaurantTemplateStructuredOutputSchema,
  SiteTemplateIdSchema,
  SiteTemplateSchema,
} from "@/lib/site-templates";

const highlights = (count: number) => Array.from({ length: count }, (_, index) => ({
  name: `Dish ${index + 1}`,
  description: `A short description for dish ${index + 1}.`,
}));

describe("site template schemas", () => {
  it("provides a safe generic default and validates the supported template identifiers", () => {
    expect(DEFAULT_SITE_TEMPLATE).toEqual({ id: "generic" });
    expect(SiteTemplateIdSchema.safeParse("generic").success).toBe(true);
    expect(SiteTemplateIdSchema.safeParse("restaurant").success).toBe(true);
    expect(SiteTemplateIdSchema.safeParse("fashion").success).toBe(true);
    expect(SiteTemplateIdSchema.safeParse("real-estate").success).toBe(true);
    expect(SiteTemplateSchema.safeParse(DEFAULT_SITE_TEMPLATE).success).toBe(true);
    expect(RESTAURANT_NAVIGATION_LABELS).toEqual(["Our story", "Menu", "Visit"]);
  });

  it("validates strict Real Estate highlights and optional agency story", () => {
    const properties = (count: number) => Array.from({ length: count }, (_, index) => ({
      name: `Property collection ${index + 1}`,
      description: `A considered property highlight grounded in the supplied agency brief, number ${index + 1}.`,
    }));
    for (const count of [2, 4]) {
      expect(RealEstateContentSchema.safeParse({ featuredProperties: properties(count) }).success).toBe(true);
    }
    for (const count of [0, 1, 5]) {
      expect(RealEstateContentSchema.safeParse({ featuredProperties: properties(count) }).success).toBe(false);
    }
    expect(RealEstateFeaturedPropertySchema.safeParse({ name: "n".repeat(80), description: "d".repeat(200) }).success).toBe(true);
    expect(RealEstateFeaturedPropertySchema.safeParse({ name: "n".repeat(81), description: "A valid description." }).success).toBe(false);
    expect(RealEstateFeaturedPropertySchema.safeParse({ name: "Valid name", description: "d".repeat(201) }).success).toBe(false);
    expect(RealEstateFeaturedPropertySchema.safeParse({ name: " ", description: "A valid description." }).success).toBe(false);
    expect(RealEstateFeaturedPropertySchema.safeParse({ name: "A valid name", description: "  " }).success).toBe(false);
    expect(RealEstateContentSchema.safeParse({ featuredProperties: properties(2), agencyStory: "s".repeat(600) }).success).toBe(true);
    expect(RealEstateContentSchema.safeParse({ featuredProperties: properties(2), agencyStory: "s".repeat(601) }).success).toBe(false);
    expect(RealEstateContentSchema.safeParse({ featuredProperties: properties(2), agencyStory: "  " }).success).toBe(false);
    expect(RealEstateContentSchema.safeParse({ featuredProperties: properties(2), prices: [100] }).success).toBe(false);
    expect(RealEstateFeaturedPropertySchema.safeParse({ name: "Property", description: "A grounded description.", address: "1 Main Street" }).success).toBe(false);
    expect(RealEstateSiteTemplateSchema.safeParse({ id: "real-estate", content: { featuredProperties: properties(2) } }).success).toBe(true);
    expect(RealEstateSiteTemplateSchema.safeParse({ id: "real-estate", content: { featuredProperties: properties(1) } }).success).toBe(false);
  });

  it.each([2, 4])("accepts restaurant content with %i menu highlights", (count) => {
    expect(RestaurantContentSchema.safeParse({ menuHighlights: highlights(count) }).success).toBe(true);
  });

  it.each([0, 1, 5])("rejects restaurant content with %i menu highlights", (count) => {
    expect(RestaurantContentSchema.safeParse({ menuHighlights: highlights(count) }).success).toBe(false);
  });

  it("accepts bounded optional restaurant copy and rejects malformed or extra fields", () => {
    const content = {
      menuHighlights: highlights(2),
      story: "A neighborhood kitchen focused on seasonal cooking and shared tables.",
      location: "Downtown",
      openingHours: "Tuesday to Sunday, 11 am to 9 pm",
    };
    expect(RestaurantContentSchema.safeParse(content).success).toBe(true);
    expect(RestaurantContentSchema.safeParse({ ...content, location: "x".repeat(241) }).success).toBe(false);
    expect(RestaurantContentSchema.safeParse({ ...content, prices: [12, 18] }).success).toBe(false);
    expect(RestaurantContentSchema.safeParse({ menuHighlights: [{ name: "", description: "Fresh pasta" }, highlights(1)[0]] }).success).toBe(false);
  });

  it("enforces menu highlight name and description lengths", () => {
    expect(RestaurantContentSchema.safeParse({ menuHighlights: [{ name: "n".repeat(60), description: "d".repeat(160) }, highlights(1)[0]] }).success).toBe(true);
    expect(RestaurantContentSchema.safeParse({ menuHighlights: [{ name: "n".repeat(61), description: "Valid dish description." }, highlights(1)[0]] }).success).toBe(false);
    expect(RestaurantContentSchema.safeParse({ menuHighlights: [{ name: "Valid dish", description: "d".repeat(161) }, highlights(1)[0]] }).success).toBe(false);
  });

  it.each([2, 4])("accepts Fashion content with %i collection highlights", (count) => {
    const collectionHighlights = highlights(count).map(({ name, description }) => ({ name: name.replace("Dish", "Collection"), description }));
    expect(FashionContentSchema.safeParse({ collectionHighlights }).success).toBe(true);
  });

  it.each([0, 1, 5])("rejects Fashion content with %i collection highlights", (count) => {
    const collectionHighlights = highlights(count).map(({ name, description }) => ({ name: name.replace("Dish", "Collection"), description }));
    expect(FashionContentSchema.safeParse({ collectionHighlights }).success).toBe(false);
  });

  it("validates Fashion collection fields and optional story with strict boundaries", () => {
    const collectionHighlights = [
      { name: "  " + "n".repeat(60) + "  ", description: "d".repeat(160) },
      { name: "Evening forms", description: "Considered silhouettes designed for layered city dressing." },
    ];
    expect(FashionContentSchema.safeParse({ collectionHighlights }).success).toBe(true);
    expect(FashionCollectionHighlightSchema.safeParse({ name: "n".repeat(61), description: "Valid description." }).success).toBe(false);
    expect(FashionCollectionHighlightSchema.safeParse({ name: "Valid name", description: "d".repeat(161) }).success).toBe(false);
    expect(FashionContentSchema.safeParse({ collectionHighlights, brandStory: "A design story grounded in the supplied brief." }).success).toBe(true);
    expect(FashionContentSchema.safeParse({ collectionHighlights, brandStory: "s".repeat(601) }).success).toBe(false);
    expect(FashionContentSchema.safeParse({ collectionHighlights, brandStory: "   " }).success).toBe(false);
    expect(FashionContentSchema.safeParse({ collectionHighlights, unexpected: true }).success).toBe(false);
    expect(FashionContentSchema.safeParse({ collectionHighlights, products: [] }).success).toBe(false);
  });

  it("requires content only for the restaurant discriminant and rejects invalid template variants", () => {
    expect(SiteTemplateSchema.safeParse({ id: "restaurant", content: { menuHighlights: highlights(2) } }).success).toBe(true);
    const fashion = { id: "fashion", content: { collectionHighlights: highlights(2).map(({ name, description }) => ({ name, description })) } };
    expect(FashionSiteTemplateSchema.safeParse(fashion).success).toBe(true);
    expect(SiteTemplateSchema.safeParse(fashion).success).toBe(true);
    expect(SiteTemplateSchema.safeParse({ ...fashion, unrelated: true }).success).toBe(false);
    expect(SiteTemplateSchema.safeParse({ id: "restaurant" }).success).toBe(false);
    expect(SiteTemplateSchema.safeParse({ id: "generic", content: { menuHighlights: highlights(2) } }).success).toBe(false);
    expect(SiteTemplateSchema.safeParse({ id: "agency" }).success).toBe(false);
  });

  it("validates a strict restaurant-generation request", () => {
    const brief = { businessName: "Juniper", description: "Seasonal neighborhood cooking.", audience: "Local diners", offering: "Seasonal plates", callToAction: "View the menu", style: "Professional" };
    expect(RestaurantTemplateGenerationRequestSchema.safeParse({ templateId: "restaurant", brief }).success).toBe(true);
    expect(RestaurantTemplateGenerationRequestSchema.safeParse({ templateId: "generic", brief }).success).toBe(false);
    expect(RestaurantTemplateGenerationRequestSchema.safeParse({ templateId: "restaurant", brief, layout: "split" }).success).toBe(false);
  });

  it("validates a strict Fashion-generation request and structured output", () => {
    const brief = { businessName: "Northline Studio", description: "Independent design for everyday dressing.", audience: "People seeking considered clothing", offering: "Fashion collections", callToAction: "Explore the collection", style: "Professional" };
    expect(FashionTemplateGenerationRequestSchema.safeParse({ templateId: "fashion", brief }).success).toBe(true);
    expect(FashionTemplateGenerationRequestSchema.safeParse({ templateId: "restaurant", brief }).success).toBe(false);
    expect(FashionTemplateGenerationRequestSchema.safeParse({ templateId: "fashion", brief, destination: "https://example.com" }).success).toBe(false);

    const output = {
      pageContent: { headline: "A more considered way to get dressed", subheadline: "Independent fashion for people who value thoughtful pieces and everyday expression.", features: ["Considered ideas for personal style", "A thoughtful direction for everyday wear"] },
      fashionContent: { collectionHighlights: [
        { name: "Spring layers", description: "Lightweight themes for the changing season and everyday dressing." },
        { name: "Evening edit", description: "A considered direction for after-dark looks and special events." },
      ], brandStory: null },
    };
    expect(FashionTemplateStructuredOutputSchema.safeParse(output).success).toBe(true);
    expect(FashionTemplateStructuredOutputSchema.safeParse({ ...output, providerMetadata: "no" }).success).toBe(false);
  });

  it("models optional generated facts as nullable while retaining strict structured output", () => {
    const output = {
      pageContent: { headline: "Seasonal cooking for the whole table", subheadline: "Thoughtful neighborhood food shaped by the seasons and made for sharing.", features: ["Seasonal ingredients prepared with care", "A welcoming table for local diners"] },
      restaurantContent: { menuHighlights: highlights(2), story: null, location: null, openingHours: null },
    };
    expect(RestaurantTemplateStructuredOutputSchema.safeParse(output).success).toBe(true);
    expect(RestaurantTemplateStructuredOutputSchema.safeParse({ ...output, providerMetadata: "no" }).success).toBe(false);
  });

  it("initializes restaurant anchors only for untouched generic navigation defaults", () => {
    const content = { menuHighlights: highlights(2), story: "A kitchen shaped by the seasons.", location: "North district" };
    expect(initializeRestaurantNavigation(DEFAULT_SITE_SETTINGS, content).navigation).toEqual([
      { label: "Our story", destination: "#site-story" },
      { label: "Menu", destination: "#site-menu" },
      { label: "Visit", destination: "#site-visit" },
    ]);
    const withoutOptionalSections = initializeRestaurantNavigation(DEFAULT_SITE_SETTINGS, { menuHighlights: highlights(2) });
    expect(withoutOptionalSections.navigation).toEqual([
      { label: "Our story", destination: "" },
      { label: "Menu", destination: "#site-menu" },
      { label: "Visit", destination: "" },
    ]);
    const customized = { ...DEFAULT_SITE_SETTINGS, navigation: [
      { label: "My story", destination: "https://example.com/story" },
      ...DEFAULT_SITE_SETTINGS.navigation.slice(1),
    ] as unknown as typeof DEFAULT_SITE_SETTINGS.navigation };
    expect(initializeRestaurantNavigation(customized, content)).toBe(customized);
  });

  it("initializes Fashion section anchors only for untouched defaults and omits the story link when absent", () => {
    expect(FASHION_NAVIGATION_LABELS).toEqual(["Our story", "Collections", "Journal"]);
    const fashionContent = {
      collectionHighlights: highlights(2).map(({ name, description }) => ({ name: name.replace("Dish", "Collection"), description })),
      brandStory: "A design studio with a thoughtful point of view.",
    };
    const withStory = initializeFashionNavigation(DEFAULT_SITE_SETTINGS, fashionContent);
    expect(withStory.navigation).toEqual([
      { label: "Our story", destination: "#site-brand-story" },
      { label: "Collections", destination: "#site-collections" },
      { label: "Journal", destination: "" },
    ]);
    const withoutStory = initializeFashionNavigation(DEFAULT_SITE_SETTINGS, {
      collectionHighlights: highlights(2).map(({ name, description }) => ({ name: name.replace("Dish", "Collection"), description })),
    });
    expect(withoutStory.navigation[0]).toEqual({ label: "Our story", destination: "" });
    expect(withoutStory.navigation[1]).toEqual({ label: "Collections", destination: "#site-collections" });

    const customized = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "The studio", destination: "https://example.com/story" },
        DEFAULT_SITE_SETTINGS.navigation[1],
        DEFAULT_SITE_SETTINGS.navigation[2],
      ] as unknown as typeof DEFAULT_SITE_SETTINGS.navigation,
    };
    expect(initializeFashionNavigation(customized, fashionContent)).toBe(customized);
  });

  it("initializes Real Estate navigation and repairs only recognized stale template defaults", () => {
    expect(REAL_ESTATE_NAVIGATION_LABELS).toEqual(["Home", "Properties", "Our story"]);
    const content = {
      featuredProperties: [
        { name: "Garden Courtyard", description: "A considered home beside a shared garden." },
        { name: "Harbor Residences", description: "A thoughtful residential setting." },
      ],
      agencyStory: "An independent agency helping people find a place to call home.",
    };
    const initialized = initializeRealEstateNavigation(DEFAULT_SITE_SETTINGS, content);
    expect(initialized.navigation).toEqual([
      { label: "Home", destination: "#top" },
      { label: "Properties", destination: "#site-properties" },
      { label: "Our story", destination: "#site-agency-story" },
    ]);

    const withoutStory = initializeRealEstateNavigation(DEFAULT_SITE_SETTINGS, { featuredProperties: content.featuredProperties });
    expect(withoutStory.navigation[2]).toEqual({ label: "Our story", destination: "" });

    const staleFashion = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Our story", destination: "#site-brand-story" },
        { label: "Collections", destination: "#site-collections" },
        { label: "Journal", destination: "" },
      ] as unknown as typeof DEFAULT_SITE_SETTINGS.navigation,
    };
    expect(initializeRealEstateNavigation(staleFashion, content).navigation).toEqual(initialized.navigation);

    const custom = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Visit our homes", destination: "https://example.com/homes" },
        { label: "Available ideas", destination: "#site-properties" },
        { label: "Our people", destination: "https://example.com/agency" },
      ] as unknown as typeof DEFAULT_SITE_SETTINGS.navigation,
    };
    expect(initializeRealEstateNavigation(custom, content)).toBe(custom);
  });
});
