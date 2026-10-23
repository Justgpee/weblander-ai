import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_TEMPLATE, type SiteTemplate } from "@/lib/site-templates";
import {
  CUSTOM_SITE_DESTINATION,
  NO_SITE_DESTINATION,
  siteNavigationDestinationOptions,
  siteNavigationDestinationSelection,
} from "@/lib/site-navigation-options";

const restaurant: SiteTemplate = { id: "restaurant", content: {
  menuHighlights: [
    { name: "Grilled meals", description: "Prepared over charcoal for a smoky finish." },
    { name: "Local dishes", description: "Homemade dishes with a familiar touch." },
  ],
} };
const fashion: SiteTemplate = { id: "fashion", content: {
  collectionHighlights: [
    { name: "Spring layers", description: "Light pieces for changing weather." },
    { name: "Evening edit", description: "A considered after-dark selection." },
  ],
} };
const realEstate: SiteTemplate = { id: "real-estate", content: {
  featuredProperties: [
    { name: "Thoughtful homes", description: "Ideas for the next chapter." },
    { name: "City retreats", description: "Spaces close to what matters." },
  ],
} };

describe("template-aware navigation destination options", () => {
  it("offers only sections rendered by each template and keeps generic choices narrow", () => {
    expect(siteNavigationDestinationOptions(DEFAULT_SITE_TEMPLATE).map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline",
    ]);
    expect(siteNavigationDestinationOptions(restaurant).map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline", "#site-menu",
    ]);
    expect(siteNavigationDestinationOptions(fashion).map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline", "#site-collections",
    ]);
    expect(siteNavigationDestinationOptions(realEstate).map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline", "#site-properties",
    ]);
  });

  it("offers story and visit destinations only when the corresponding section is rendered", () => {
    const restaurantWithSections: SiteTemplate = {
      ...restaurant,
      content: { ...restaurant.content, story: "A family kitchen", location: "Lagos" },
    };
    const fashionWithStory: SiteTemplate = { ...fashion, content: { ...fashion.content, brandStory: "Made with care." } };
    const realEstateWithStory: SiteTemplate = { ...realEstate, content: { ...realEstate.content, agencyStory: "Local expertise." } };

    expect(siteNavigationDestinationOptions(restaurantWithSections).map(({ destination }) => destination)).toContain("#site-story");
    expect(siteNavigationDestinationOptions(restaurantWithSections).map(({ destination }) => destination)).toContain("#site-visit");
    expect(siteNavigationDestinationOptions(fashionWithStory).map(({ destination }) => destination)).toContain("#site-brand-story");
    expect(siteNavigationDestinationOptions(realEstateWithStory).map(({ destination }) => destination)).toContain("#site-agency-story");
  });

  it("distinguishes no destination, known sections, and preserved custom URLs or anchors", () => {
    const options = siteNavigationDestinationOptions(realEstate);
    expect(siteNavigationDestinationSelection("", options)).toBe(NO_SITE_DESTINATION);
    expect(siteNavigationDestinationSelection("#site-properties", options)).toBe("#site-properties");
    expect(siteNavigationDestinationSelection("https://example.com/collections", options)).toBe(CUSTOM_SITE_DESTINATION);
    // A formerly valid anchor from another template is kept as a custom value, not cleared.
    expect(siteNavigationDestinationSelection("#site-collections", options)).toBe(CUSTOM_SITE_DESTINATION);
  });
});
