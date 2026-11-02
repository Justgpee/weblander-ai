import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_TEMPLATE, type SiteTemplate } from "@/lib/site-templates";
import {
  CUSTOM_SITE_DESTINATION,
  NO_SITE_DESTINATION,
  siteNavigationDestinationOptions,
  siteNavigationDestinationSelection,
  siteNavigationEntryWithTarget,
  siteNavigationTargetOptions,
  siteNavigationTargetFromLegacy,
  siteNavigationTargetProjection,
  normalizeSiteNavigationTargets,
  safeExternalNavigationTarget,
  type SiteNavigationPageOptionSource,
  validateSiteNavigationTargets,
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

  it("limits Restaurant Menu page section anchors to sections that the Menu composition renders", () => {
    const restaurantWithSections: SiteTemplate = {
      ...restaurant,
      content: { ...restaurant.content, story: "A family kitchen", location: "Lagos", openingHours: "Daily" },
    };
    expect(siteNavigationDestinationOptions(restaurantWithSections, "home").map(({ destination }) => destination)).toContain("#site-story");
    expect(siteNavigationDestinationOptions(restaurantWithSections, "home").map(({ destination }) => destination)).toContain("#site-visit");
    expect(siteNavigationDestinationOptions(restaurantWithSections, "services").map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline", "#site-menu",
    ]);
    const menuPage: SiteNavigationPageOptionSource = { id: "services", slug: "services", title: "Services", kind: "services", template: restaurantWithSections };
    const choices = siteNavigationTargetOptions([menuPage]);
    expect(choices.some(({ target }) => target.type === "section" && target.pageId === "services" && target.anchor === "#site-menu")).toBe(true);
    expect(choices.some(({ target }) => target.type === "section" && target.pageId === "services" && target.anchor === "#site-story")).toBe(false);
    expect(choices.some(({ target }) => target.type === "section" && target.pageId === "services" && target.anchor === "#site-visit")).toBe(false);
  });

  it("offers purpose-specific Fashion, Real Estate, and Generic page anchors only on matching pages", () => {
    const fashionWithStory: SiteTemplate = { ...fashion, content: { ...fashion.content, brandStory: "A thoughtful design studio." } };
    const realEstateWithStory: SiteTemplate = { ...realEstate, content: { ...realEstate.content, agencyStory: "Local knowledge and thoughtful guidance." } };
    expect(siteNavigationDestinationOptions(fashionWithStory, "products").map(({ destination }) => destination)).toContain("#site-collections");
    expect(siteNavigationDestinationOptions(fashionWithStory, "products").map(({ destination }) => destination)).not.toContain("#site-brand-story");
    expect(siteNavigationDestinationOptions(realEstateWithStory, "services").map(({ destination }) => destination)).toContain("#site-properties");
    expect(siteNavigationDestinationOptions(realEstateWithStory, "services").map(({ destination }) => destination)).not.toContain("#site-agency-story");
    expect(siteNavigationDestinationOptions(DEFAULT_SITE_TEMPLATE, "services").map(({ destination }) => destination)).toContain("#site-services");
    expect(siteNavigationDestinationOptions(DEFAULT_SITE_TEMPLATE, "products").map(({ destination }) => destination)).toContain("#site-products");
    expect(siteNavigationDestinationOptions(DEFAULT_SITE_TEMPLATE, "home").map(({ destination }) => destination)).not.toContain("#site-products");
  });

  it("offers About and Contact anchors only for their dedicated compositions and rendered optional information", () => {
    expect(siteNavigationDestinationOptions(DEFAULT_SITE_TEMPLATE, "about").map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline", "#site-about",
    ]);
    expect(siteNavigationDestinationOptions(DEFAULT_SITE_TEMPLATE, "contact").map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline", "#site-contact",
    ]);
    expect(siteNavigationDestinationOptions(restaurant, "about").map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline", "#site-about",
    ]);
    expect(siteNavigationDestinationOptions(restaurant, "contact").map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline", "#site-contact",
    ]);

    const restaurantDetails: SiteTemplate = { ...restaurant, content: { ...restaurant.content, story: "A family kitchen", location: "Lagos" } };
    expect(siteNavigationDestinationOptions(restaurantDetails, "about").map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline", "#site-about", "#site-story",
    ]);
    expect(siteNavigationDestinationOptions(restaurantDetails, "contact").map(({ destination }) => destination)).toEqual([
      "#top", "#site-headline", "#site-contact", "#site-visit",
    ]);
    expect(siteNavigationDestinationOptions(fashion, "about").map(({ destination }) => destination)).not.toContain("#site-collections");
    expect(siteNavigationDestinationOptions(realEstate, "contact").map(({ destination }) => destination)).not.toContain("#site-properties");
  });

  it("does not resolve typed story or visit targets to a Restaurant Menu page", () => {
    const menuPage = { id: "services", template: { ...restaurant, content: { ...restaurant.content, story: "A family kitchen", location: "Lagos" } }, kind: "services" as const };
    expect(validateSiteNavigationTargets({
      navigation: [{ target: { type: "section", pageId: "services", anchor: "#site-story" } }],
    } as never, [menuPage])).toBe(false);
  });

  it("distinguishes no destination, known sections, and preserved custom URLs or anchors", () => {
    const options = siteNavigationDestinationOptions(realEstate);
    expect(siteNavigationDestinationSelection("", options)).toBe(NO_SITE_DESTINATION);
    expect(siteNavigationDestinationSelection("#site-properties", options)).toBe("#site-properties");
    expect(siteNavigationDestinationSelection("https://example.com/collections", options)).toBe(CUSTOM_SITE_DESTINATION);
    // A formerly valid anchor from another template is kept as a custom value, not cleared.
    expect(siteNavigationDestinationSelection("#site-collections", options)).toBe(CUSTOM_SITE_DESTINATION);
  });

  it("normalizes legacy values without guessing unavailable anchors or pages", () => {
    const restaurantHome = { id: "home", template: restaurant };
    expect(siteNavigationTargetFromLegacy("", restaurantHome)).toEqual({ type: "none" });
    expect(siteNavigationTargetFromLegacy("https://example.com/menu", restaurantHome)).toEqual({ type: "external", url: "https://example.com/menu" });
    expect(siteNavigationTargetFromLegacy("#site-menu", restaurantHome)).toEqual({ type: "section", pageId: "home", anchor: "#site-menu" });
    expect(siteNavigationTargetFromLegacy("#site-properties", restaurantHome)).toEqual({ type: "unresolved", value: "#site-properties" });
    expect(siteNavigationTargetProjection({ type: "page", pageId: "contact" })).toBe("");
    expect(siteNavigationTargetProjection({ type: "section", pageId: "contact", anchor: "#site-headline" })).toBe("");
    expect(siteNavigationTargetProjection({ type: "section", pageId: "home", anchor: "#site-menu" })).toBe("#site-menu");
    expect(() => siteNavigationTargetFromLegacy("javascript:alert(1)", restaurantHome)).toThrow();
  });

  it("preserves typed page targets and validates page and section references against actual pages", () => {
    const home = { id: "home", template: restaurant };
    const contact = { id: "contact", template: restaurant };
    const settings = normalizeSiteNavigationTargets({
      navigation: [
        { label: "Menu", destination: "#site-menu", target: { type: "section", pageId: "home", anchor: "#site-menu" } },
        { label: "Contact", destination: "", target: { type: "page", pageId: "contact" } },
        { label: "External", destination: "https://example.com", target: { type: "external", url: "https://example.com/" } },
      ],
      ctaDestination: "",
      appearance: { colors: { primary: null, background: null, accent: null }, typography: "preset" },
    }, [home, contact]);
    expect(settings.navigation[1].target).toEqual({ type: "page", pageId: "contact" });
    expect(validateSiteNavigationTargets(settings, [home, contact])).toBe(true);
    expect(validateSiteNavigationTargets(settings, [home])).toBe(false);
    expect(validateSiteNavigationTargets({
      ...settings,
      navigation: [
        { ...settings.navigation[0], destination: "#site-properties", target: { type: "section", pageId: "home", anchor: "#site-properties" } },
        ...settings.navigation.slice(1),
      ] as typeof settings.navigation,
    }, [home, contact])).toBe(false);
  });

  it("offers stable page IDs and only sections rendered by pages that exist", () => {
    const pages = [
      { id: "home", slug: "index", title: "Home", kind: "home" as const, template: restaurant },
      { id: "about", slug: "about", title: "About", kind: "about" as const, template: restaurantWithStory() },
    ];
    const options = siteNavigationTargetOptions(pages);
    expect(options).toContainEqual({ value: "page:about", label: "About page", target: { type: "page", pageId: "about" } });
    expect(options).toContainEqual({ value: "section:about:#site-story", label: "About — Our story", target: { type: "section", pageId: "about", anchor: "#site-story" } });
    expect(options.some(({ target }) => (target.type === "page" || target.type === "section") && target.pageId === "missing")).toBe(false);
    expect(options.some(({ target }) => target.type === "section" && target.pageId === "about" && target.anchor === "#site-about")).toBe(true);
    expect(options.some(({ target }) => target.type === "section" && target.pageId === "about" && target.anchor === "#site-menu")).toBe(false);
    const pageForTemplate = (template: SiteTemplate): SiteNavigationPageOptionSource => ({ id: "home", slug: "index", title: "Home", kind: "home", template });
    const fashionPage = pageForTemplate(fashion);
    const realEstatePage = pageForTemplate(realEstate);
    expect(siteNavigationTargetOptions([fashionPage]).some(({ label }) => label === "Home — Collections")).toBe(true);
    expect(siteNavigationTargetOptions([realEstatePage]).some(({ label }) => label === "Home — Properties")).toBe(true);
  });

  it("keeps labels while synchronizing typed targets with the legacy destination projection", () => {
    const entry = { label: "Visit our studios", destination: "", target: { type: "none" as const } };
    expect(siteNavigationEntryWithTarget(entry, { type: "page", pageId: "contact" })).toEqual({
      label: "Visit our studios", destination: "", target: { type: "page", pageId: "contact" },
    });
    expect(siteNavigationEntryWithTarget(entry, { type: "section", pageId: "home", anchor: "#site-menu" })).toEqual({
      label: "Visit our studios", destination: "#site-menu", target: { type: "section", pageId: "home", anchor: "#site-menu" },
    });
    expect(safeExternalNavigationTarget("https://example.com/path")).toEqual({ type: "external", url: "https://example.com/path" });
    for (const unsafe of ["javascript:alert(1)", "//example.com", "https://user:pass@example.com"]) {
      expect(safeExternalNavigationTarget(unsafe)).toBeUndefined();
    }
  });
});

function restaurantWithStory(): SiteTemplate {
  return {
    id: "restaurant",
    content: {
      menuHighlights: [
        { name: "Grilled meals", description: "Prepared over charcoal for a smoky finish." },
        { name: "Local dishes", description: "Homemade dishes with a familiar touch." },
      ],
      story: "A family kitchen",
    },
  };
}
