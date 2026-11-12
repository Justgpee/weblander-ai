import { describe, expect, it } from "vitest";
import { VISUAL_STYLES, type GeneratedPage } from "@/lib/generation";
import { createWebsiteExport, GENERATED_SITE_CSS, renderGeneratedWebsite, sanitizeExportFilename, validateCtaDestination } from "@/lib/website-export";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";
import { DEFAULT_SITE_TEMPLATE, initializeFashionNavigation, initializeRealEstateNavigation, initializeRestaurantNavigation, type FashionSiteTemplate, type SiteTemplate } from "@/lib/site-templates";
import { siteNavigationDestinationOptions } from "@/lib/site-navigation-options";

const page: GeneratedPage = {
  businessName: "Northline Studio", description: "Design for independent teams.", audience: "Founders", offering: "Brand identity",
  callToAction: "Book a conversation", style: "Professional", headline: "Build a brand with a clearer point of view.",
  subheadline: "Thoughtful identity and digital design for independent teams ready to grow.",
  features: ["A focused identity system for your next chapter", "Clear direction for meaningful growth"], layout: "editorial",
};
const heroImage = { mimeType: "image/webp" as const, base64: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).toString("base64") };
const restaurantTemplate: SiteTemplate = {
  id: "restaurant",
  content: {
    menuHighlights: [
      { name: "Garden pasta", description: "Fresh pasta with seasonal vegetables and herbs." },
      { name: "Roasted carrots", description: "Slow-roasted carrots with a bright citrus dressing." },
    ],
    story: "A neighborhood kitchen shaped by seasonal cooking and shared tables.",
    location: "North district",
    openingHours: "Tuesday to Sunday, 11 am to 9 pm",
  },
};
const fashionTemplate: FashionSiteTemplate = {
  id: "fashion",
  content: {
    collectionHighlights: [
      { name: "Everyday forms", description: "Considered pieces for the rhythm of daily dressing." },
      { name: "Evening edit", description: "A refined direction for after-dark expression." },
      { name: "Soft structure", description: "Layering ideas with relaxed and thoughtful shapes." },
    ],
    brandStory: "An independent design studio exploring clothing as a thoughtful part of everyday life.",
  },
};
const realEstateTemplate: SiteTemplate = {
  id: "real-estate",
  content: {
    featuredProperties: [
      { name: "Garden Courtyard", description: "A calm home concept shaped around a shared garden." },
      { name: "Harbor Residences", description: "Contemporary living with a thoughtful sense of space." },
      { name: "The Linden House", description: "A welcoming residential setting with considered details." },
    ],
    agencyStory: "We help people explore places that feel right for the next chapter.",
  },
};
function renderedBody(markup: string) {
  return markup.match(/<body>\n([\s\S]*)\n<\/body>/)?.[1] ?? markup;
}

describe("standalone website export", () => {
  it("renders each validated layout and visual style", () => {
    for (const layout of ["editorial", "split"] as const) {
      for (const style of VISUAL_STYLES) {
        const exported = createWebsiteExport({ ...page, style }, layout);
        expect(exported.html).toContain(`site-mock ${style.toLowerCase()} ${layout}`);
        expect(exported.html).toContain("<style>");
      }
    }
  });

  it("shares container-responsive tablet and mobile rules between the preview and exported document", () => {
    expect(GENERATED_SITE_CSS).toContain("container:site / inline-size");
    expect(GENERATED_SITE_CSS).toContain("@container site (min-width:701px) and (max-width:900px)");
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:700px)");
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:420px)");
    expect(GENERATED_SITE_CSS).toContain("@container site (min-width:480px) and (max-width:700px)");
    expect(GENERATED_SITE_CSS).toContain(".site-mock.preview.split .site-hero{grid-template-columns:minmax(0,.88fr) minmax(0,1.12fr)");
    expect(GENERATED_SITE_CSS).toContain(".site-mock.preview.editorial .site-copy{grid-row:2");

    for (const layout of ["editorial", "split"] as const) {
      for (const style of VISUAL_STYLES) {
        const currentPage = { ...page, layout, style };
        const preview = renderGeneratedWebsite(currentPage);
        const exported = createWebsiteExport(currentPage, layout).html;
        expect(preview).toContain(`class="site-mock ${style.toLowerCase()} ${layout} preview"`);
        expect(exported).toContain(`class="site-mock ${style.toLowerCase()} ${layout}"`);
        expect(exported).toContain(`<style>${GENERATED_SITE_CSS}</style>`);
      }
    }
  });

  it("gives Studio layouts different compositions for all four templates while leaving export breakpoints untouched", () => {
    const templates: SiteTemplate[] = [
      { id: "generic" },
      restaurantTemplate,
      fashionTemplate,
      realEstateTemplate,
    ];

    for (const template of templates) {
      const editorialPreview = renderGeneratedWebsite({ ...page, layout: "editorial" }, DEFAULT_SITE_SETTINGS, null, template);
      const splitPreview = renderGeneratedWebsite({ ...page, layout: "split" }, DEFAULT_SITE_SETTINGS, null, template);
      const editorialExport = createWebsiteExport({ ...page, layout: "editorial" }, "editorial", DEFAULT_SITE_SETTINGS, null, template).html;
      const splitExport = createWebsiteExport({ ...page, layout: "split" }, "split", DEFAULT_SITE_SETTINGS, null, template).html;

      expect(editorialPreview).toContain(" editorial preview");
      expect(splitPreview).toContain(" split preview");
      expect(editorialExport.match(/<div class="([^"]*site-mock[^"]*)"/)?.[1]).not.toContain("preview");
      expect(splitExport.match(/<div class="([^"]*site-mock[^"]*)"/)?.[1]).not.toContain("preview");
      expect(GENERATED_SITE_CSS).toContain(".site-mock.preview.editorial .site-copy{grid-row:2");
      expect(GENERATED_SITE_CSS).toContain(".site-mock.preview.split .site-copy{grid-column:1;grid-row:1}");
      expect(GENERATED_SITE_CSS).toContain("@container site (max-width:700px){.site-mock{padding-inline:");
      expect(GENERATED_SITE_CSS).toContain(".site-hero,.site-mock.split .site-hero{grid-template-columns:minmax(0,1fr)");
      expect(GENERATED_SITE_CSS).toContain("@container site (max-width:479px){.site-mock.preview.editorial .site-hero");
    }
  });

  it("keeps navigation, copy, artwork, features, CTA and footer usable at narrow container widths", () => {
    for (const rule of [
      ".site-nav-links{width:100%;justify-content:flex-start",
      ".site-nav-links a,.site-nav-links span,.site-nav-links button{min-width:0;max-width:100%;overflow-wrap:anywhere}",
      ".site-copy h1{font-size:clamp(38px,9cqi,64px)",
      ".site-copy>p{font-size:clamp(15px,3cqi,18px)",
      ".site-cta{width:100%;justify-content:center}",
      ".site-features{margin-top:20px;font-size:14px}",
      ".site-bottom{justify-content:flex-start}",
    ]) expect(GENERATED_SITE_CSS).toContain(rule);
    expect(GENERATED_SITE_CSS).not.toContain(".site-mock.preview .site-art{display:none}");

    const longContent = {
      ...page,
      businessName: "Long-business-name-with-unbrokenwordthatmustwrap",
      headline: "A headline with unusually long content and unbrokenwordsthatmustwrapcleanly",
      subheadline: "A description with extensive copy and a verylongunbrokenwordthatmustwrapinstead of causing horizontal overflow.",
      features: ["A feature with a verylongunbrokenwordthatmustwrapinside the available width", "A second feature that remains readable on narrow screens"],
    };
    const preview = renderGeneratedWebsite(longContent);
    const exported = createWebsiteExport(longContent, "editorial").html;
    for (const markup of [preview, exported]) {
      expect(markup).toContain("verylongunbrokenwordthatmustwrap");
      expect(markup).toContain("site-features");
      expect(markup).toContain("site-nav-links");
    }
  });

  it("applies a clear type scale and balanced content composition without changing markup semantics", () => {
    for (const rule of [
      ".site-copy h1{font-size:clamp(42px,6.8cqi,82px);line-height:1.02;letter-spacing:-.04em;max-width:12ch",
      ".site-copy>p{max-width:48ch;line-height:1.68}",
      ".site-hero{grid-template-columns:minmax(0,1.04fr) minmax(0,.96fr);gap:clamp(36px,6cqi,88px)",
      ".site-mock.split .site-hero{grid-template-columns:minmax(0,.94fr) minmax(0,1.06fr)}",
      ".site-features{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))",
      ".site-features li{border-top:1px solid",
      ".site-cta{min-height:48px",
      ".site-bottom{margin-top:clamp(12px,2cqi,24px)",
      ".site-features{grid-template-columns:minmax(0,1fr);gap:8px;margin-top:24px}",
    ]) expect(GENERATED_SITE_CSS).toContain(rule);

    const preview = renderGeneratedWebsite(page);
    const exported = createWebsiteExport(page, "editorial").html;
    for (const markup of [preview, exported]) {
      expect(markup).toContain("<ul class=\"site-features\">");
      expect(markup).toContain("<li>A focused identity system for your next chapter</li>");
      expect(markup).toContain("<h1 id=\"site-headline\">");
      expect(markup).toContain("<footer class=\"site-bottom\">");
    }
  });

  it("gives every existing visual style a distinctive treatment beyond its palette and font", () => {
    const styleMarkers: Record<(typeof VISUAL_STYLES)[number], string[]> = {
      Minimalist: [".site-mock.minimalist .site-features{gap:8px 28px}", ".site-mock.minimalist .site-cta{background:transparent;color:var(--site-ink);border:1px solid var(--site-ink)"],
      Luxury: [".site-mock.luxury .site-nav-links{text-transform:uppercase", ".site-mock.luxury .site-hero-image{border-radius:50% 50% 2px 2px}", ".site-mock.luxury .site-features li{border-top-style:double"],
      Bold: [".site-mock.bold .site-copy h1{font-size:clamp(46px,8cqi,92px)", ".site-mock.bold .site-features li{border-top:0;border-left:3px solid var(--site-accent)", ".site-mock.bold .site-cta{border-width:3px;border-radius:0"],
      Playful: [".site-mock.playful .site-features li{border:1px solid color-mix", ".site-mock.playful .site-cta{border-radius:999px", ".site-mock.playful .site-arch{border-radius:46% 54%"],
      Professional: [".site-mock.professional .site-kicker{width:fit-content", ".site-mock.professional .site-features{grid-template-columns:minmax(0,1fr)", ".site-mock.professional .site-nav-links{text-transform:uppercase"],
    };

    for (const style of VISUAL_STYLES) {
      const exported = createWebsiteExport({ ...page, style }, "editorial").html;
      for (const marker of styleMarkers[style]) {
        expect(GENERATED_SITE_CSS).toContain(marker);
        expect(exported).toContain(marker);
      }
    }
  });

  it("exports complete semantic HTML with embedded site styles and no editor or network dependencies", () => {
    const { html } = createWebsiteExport(page, "split", "https://example.com/contact");
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<meta name=\"viewport\"");
    expect(html).toContain("<header id=\"top\" class=\"site-nav\"");
    expect(html).toContain("<main>");
    expect(html).toContain("<h1 id=\"site-headline\"");
    expect(html).toContain("<ul class=\"site-features\"");
    expect(html).toContain("<footer class=\"site-bottom\"");
    expect(html).toContain("href=\"https://example.com/contact\"");
    expect(html).not.toMatch(/<(?:script|link)\b/i);
    expect(html).not.toMatch(/\b(?:fetch|XMLHttpRequest|openai|api[_-]?key)\b/i);
    expect(html).not.toMatch(/class=\"(?:app-shell|sidebar|copy-editor|project-toolbar)\"/i);
    expect(html).not.toMatch(/https?:\/\/[^\s"']+\.css\b/i);
  });

  it("exports the latest edited fields and selected layout without losing content", () => {
    const latest = { ...page, headline: "The edited headline belongs in the download.", subheadline: "The edited description is included in this standalone page.", features: ["First edited feature remains present", "Second edited feature remains present"], callToAction: "Start a conversation", style: "Luxury" as const };
    const { html } = createWebsiteExport(latest, "split");
    expect(html).toContain("The edited headline belongs in the download.");
    expect(html).toContain("The edited description is included in this standalone page.");
    expect(html).toContain("First edited feature remains present");
    expect(html).toContain("Start a conversation");
    expect(html).toContain("site-mock luxury split");
    expect(html).toContain("<title>Northline Studio</title>");
  });

  it("escapes HTML-like content, quotes, ampersands, and keeps Unicode", () => {
    const edited = { ...page, businessName: `A "Bright" & Bold`, headline: `<script>alert("x")</script> café`, subheadline: `This & that <b>remain text</b> — 東京`, callToAction: `Let’s go & grow`, features: [`Safe <img src=x> & sound`, `Quotes " and ' stay text` ] };
    const { html } = createWebsiteExport(edited, "editorial", "https://example.com/?a=1&b=2");
    expect(html).toContain("A &quot;Bright&quot; &amp; Bold");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; café");
    expect(html).toContain("This &amp; that &lt;b&gt;remain text&lt;/b&gt; — 東京");
    expect(html).toContain("Safe &lt;img src=x&gt; &amp; sound");
    expect(html).toContain("Quotes &quot; and &#39; stay text");
    expect(html).toContain("href=\"https://example.com/?a=1&amp;b=2\"");
    expect(html).not.toContain("<script>");
  });

  it("accepts safe absolute URLs and deliberate same-page anchors only", () => {
    expect(validateCtaDestination(" https://example.com/path ")).toBe("https://example.com/path");
    expect(validateCtaDestination("http://example.com")).toBe("http://example.com/");
    expect(validateCtaDestination("#top")).toBe("#top");
    expect(validateCtaDestination("")).toBeUndefined();
    for (const unsafe of ["javascript:alert(1)", "data:text/html,bad", "file:///etc/passwd", "//example.com", "https://user:pass@example.com", "#bad anchor", "#contact-us"]) {
      expect(() => validateCtaDestination(unsafe), unsafe).toThrow();
    }
  });

  it("uses a safe filename and a fallback for empty or invalid names", () => {
    expect(sanitizeExportFilename("Northline & Studio")).toBe("weblander-northline-studio.html");
    expect(sanitizeExportFilename("Café 東京")).toBe("weblander-cafe.html");
    expect(sanitizeExportFilename("../../")).toBe("weblander-website.html");
    expect(sanitizeExportFilename("")).toBe("weblander-website.html");
    expect(sanitizeExportFilename("N".repeat(100))).toHaveLength("weblander-".length + 60 + ".html".length);
  });

  it("rejects invalid export page and layout values", () => {
    expect(() => createWebsiteExport({ ...page, features: ["short", "also short"] }, "editorial")).toThrow();
    expect(() => createWebsiteExport(page, "unknown")).toThrow();
    expect(() => createWebsiteExport({ ...page, style: "Custom CSS" }, "editorial")).toThrow();
  });

  it("renders an omitted CTA destination as non-interactive text", () => {
    const { html } = createWebsiteExport(page, "editorial");
    expect(html).toContain('<span class="site-cta site-cta-text">Book a conversation</span>');
    expect(html).not.toMatch(/<a class="site-cta"/);
    expect(html).not.toMatch(/<button\b/i);
  });

  it("renders working typed CTA destinations in standalone HTML and leaves unavailable targets inactive", () => {
    const externalHtml = createWebsiteExport(page, "editorial", {
      ...DEFAULT_SITE_SETTINGS,
      ctaDestination: "",
      ctaTarget: { type: "external", url: "https://example.com/book?source=studio" },
    }).html;
    expect(externalHtml).toContain('<a class="site-cta" href="https://example.com/book?source=studio">Book a conversation');

    const sectionHtml = createWebsiteExport(page, "editorial", {
      ...DEFAULT_SITE_SETTINGS,
      ctaDestination: "",
      ctaTarget: { type: "current-section", anchor: "#site-headline" },
    }).html;
    expect(sectionHtml).toContain('<a class="site-cta" href="#site-headline">Book a conversation');
    expect(sectionHtml).toContain('<h1 id="site-headline">');

    const typedSamePageSectionHtml = createWebsiteExport(page, "editorial", {
      ...DEFAULT_SITE_SETTINGS,
      ctaDestination: "",
      ctaTarget: { type: "section", pageId: "home", anchor: "#site-headline" },
    }).html;
    expect(typedSamePageSectionHtml).toContain('<a class="site-cta" href="#site-headline">Book a conversation');

    const crossPageHtml = createWebsiteExport(page, "editorial", {
      ...DEFAULT_SITE_SETTINGS,
      ctaDestination: "",
      ctaTarget: { type: "section", pageId: "about", anchor: "#site-about" },
    }, null, DEFAULT_SITE_TEMPLATE, {
      currentPageId: "home",
      pageKind: "home",
      pages: [{ id: "home", template: DEFAULT_SITE_TEMPLATE }, { id: "about", template: DEFAULT_SITE_TEMPLATE, kind: "about" }],
    }).html;
    expect(crossPageHtml).toContain('<span class="site-cta site-cta-text">Book a conversation</span>');
    expect(crossPageHtml).not.toContain('<a class="site-cta"');

    const blankHtml = createWebsiteExport(page, "editorial", DEFAULT_SITE_SETTINGS).html;
    expect(blankHtml).toContain('<span class="site-cta site-cta-text">Book a conversation</span>');
    expect(blankHtml).not.toContain('<a class="site-cta"');
  });

  it("renders the logo as a preview link and scopes standalone logo links to included pages", () => {
    const preview = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, DEFAULT_SITE_TEMPLATE, {
      currentPageId: "about",
      pageKind: "about",
      pages: [{ id: "home", template: DEFAULT_SITE_TEMPLATE, kind: "home" }, { id: "about", template: DEFAULT_SITE_TEMPLATE, kind: "about" }],
    });
    expect(preview).toContain('<a class="site-logo" href="#top" aria-label="Return to homepage">Northline Studio</a>');
    expect(GENERATED_SITE_CSS).toContain(".site-logo:focus-visible");

    const homeHtml = createWebsiteExport(page, "editorial").html;
    expect(homeHtml).toContain('<a class="site-logo" href="#top" aria-label="Return to homepage">Northline Studio</a>');

    const secondaryHtml = createWebsiteExport(page, "editorial", DEFAULT_SITE_SETTINGS, null, DEFAULT_SITE_TEMPLATE, {
      currentPageId: "about",
      pageKind: "about",
      pages: [{ id: "home", template: DEFAULT_SITE_TEMPLATE, kind: "home" }, { id: "about", template: DEFAULT_SITE_TEMPLATE, kind: "about" }],
    }).html;
    expect(secondaryHtml).toContain('<span class="site-logo" aria-label="Homepage unavailable">Northline Studio</span>');
    expect(secondaryHtml).not.toContain('<a class="site-logo"');
  });

  it("uses the same site markup renderer for the preview", () => {
    const previewMarkup = renderGeneratedWebsite(page);
    const { html } = createWebsiteExport(page, "editorial");
    expect(previewMarkup).toContain('<h1 id="site-headline">Build a brand');
    expect(previewMarkup).toContain('class="site-mock professional editorial preview"');
    expect(html).toContain('<h1 id="site-headline">Build a brand');
  });

  it("renders configured navigation and CTA destinations as escaped functional links", () => {
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Our <story> & more", destination: "#top" },
        { label: "Collections", destination: "https://example.com/shop?a=1&b=2" },
        { label: "Journal", destination: "" },
      ],
      ctaDestination: "https://example.com/contact?from=site&next=%2F",
      appearance: { ...DEFAULT_SITE_SETTINGS.appearance },
    };
    const preview = renderGeneratedWebsite(page, settings);
    const exported = createWebsiteExport(page, "split", settings).html;
    for (const markup of [preview, exported]) {
      expect(markup).toContain('<a href="#top">Our &lt;story&gt; &amp; more</a>');
      expect(markup).toContain('<a href="https://example.com/shop?a=1&amp;b=2">Collections</a>');
      expect(markup).toContain("<span>Journal</span>");
      expect(markup).not.toContain('<a href="">Journal</a>');
      expect(markup).toContain('href="https://example.com/contact?from=site&amp;next=%2F"');
      expect(markup).not.toContain("Our <story>");
    }
  });

  it("uses typed preview navigation and degrades cross-page targets safely in single-page exports", () => {
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "External", destination: "https://example.com/visit", target: { type: "external", url: "https://example.com/visit" } },
        { label: "Hero", destination: "#site-headline", target: { type: "section", pageId: "home", anchor: "#site-headline" } },
        { label: "Contact", destination: "", target: { type: "page", pageId: "contact" } },
      ],
      ctaDestination: "https://example.com/book",
    };
    const pages = [
      { id: "home", template: { id: "generic" } as const },
      { id: "contact", template: { id: "generic" } as const },
      { id: "about", template: { id: "restaurant", content: restaurantTemplate.content } as const },
    ];
    const previewSettings: SiteSettings = {
      ...settings,
      navigation: [
        ...settings.navigation.slice(0, 2),
        { label: "Story elsewhere", destination: "", target: { type: "section", pageId: "about", anchor: "#site-story" } },
      ] as SiteSettings["navigation"],
    };
    const preview = renderGeneratedWebsite(page, previewSettings, null, restaurantTemplate, { currentPageId: "home", pages });
    expect(preview).toContain('<a href="https://example.com/visit">External</a>');
    expect(preview).toContain('<a href="#site-headline">Hero</a>');
    expect(preview).toContain('data-site-navigation-action="page-section" data-page-id="about" data-site-navigation-anchor="#site-story"');
    expect(preview).toContain('class="site-cta" href="https://example.com/book"');

    const exported = createWebsiteExport(page, page.layout, previewSettings, null, restaurantTemplate, { currentPageId: "home", pages }).html;
    expect(exported).toContain('<a href="https://example.com/visit">External</a>');
    expect(exported).toContain('<a href="#site-headline">Hero</a>');
    expect(exported).toContain("<span>Story elsewhere</span>");
    expect(exported).not.toContain('data-site-navigation-action=');
    expect(exported).not.toContain('href="page:');

    const pageLinkExport = createWebsiteExport(page, page.layout, settings, null, restaurantTemplate, { currentPageId: "home", pages }).html;
    expect(pageLinkExport).toContain("<span>Contact</span>");
    expect(pageLinkExport).not.toContain('href="contact"');
  });

  it("keeps empty, unresolved, and missing page targets noninteractive", () => {
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "None", destination: "", target: { type: "none" } },
        { label: "Legacy", destination: "#site-properties", target: { type: "unresolved", value: "#site-properties" } },
        { label: "Missing", destination: "", target: { type: "page", pageId: "missing" } },
      ],
    };
    const markup = renderGeneratedWebsite(page, settings, null, undefined, { currentPageId: "home", pages: [{ id: "home", template: { id: "generic" } }] });
    expect(markup).toContain("<span>None</span>");
    expect(markup).toContain("<span>Legacy</span>");
    expect(markup).toContain("<span>Missing</span>");
    expect(markup).not.toContain('data-page-id="missing"');
  });

  it("renders the latest navigation settings immediately while keeping CTA settings independent", () => {
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Our approach", destination: "#site-headline" },
        { label: "Custom page", destination: "https://example.com/approach" },
        { label: "Journal", destination: "" },
      ],
      ctaDestination: "https://example.com/contact",
    };
    const markup = renderGeneratedWebsite(page, settings);
    expect(markup).toContain('<a href="#site-headline">Our approach</a>');
    expect(markup).toContain('<a href="https://example.com/approach">Custom page</a>');
    expect(markup).toContain("<span>Journal</span>");
    expect(markup).toContain('<a class="site-cta" href="https://example.com/contact">Book a conversation <span aria-hidden="true">↗</span></a>');
  });

  it("uses matching resolved appearance values in preview and export for every style and layout", () => {
    for (const style of VISUAL_STYLES) for (const layout of ["editorial", "split"] as const) {
      const customized: SiteSettings = {
        ...DEFAULT_SITE_SETTINGS,
        appearance: {
          colors: { primary: "#1A2938", background: "#F7F4EE", accent: "#A56B42" },
          typography: "humanist-sans",
        },
      };
      const currentPage = { ...page, style, layout };
      const preview = renderGeneratedWebsite(currentPage, customized);
      const exported = createWebsiteExport(currentPage, layout, customized).html;
      const previewStyle = preview.match(/<div class="site-mock[^"]*" style="([^"]+)"/)?.[1];
      const exportStyle = exported.match(/<div class="site-mock[^"]*" style="([^"]+)"/)?.[1];
      expect(previewStyle).toContain("--site-ink:#1A2938;--site-bg:#F7F4EE;--site-accent:#A56B42");
      expect(previewStyle).toContain("--site-heading-weight:");
      expect(previewStyle).toContain("--site-button-radius:");
      expect(previewStyle).toContain("--site-image-radius:");
      expect(exportStyle).toBe(previewStyle);
      expect(exported).toContain("Trebuchet MS");
      expect(exported).toContain(`<style>${GENERATED_SITE_CSS}</style>`);
      expect(exported).not.toMatch(/@import|fonts\.googleapis|https?:\/\/[^\s"']+\.css/i);
    }
  });

  it("applies distinct token-driven properties in preview and embeds the same styling in export", () => {
    const rootStyle = (markup: string) => {
      const value = markup.match(/<div class="site-mock[^"]*" style="([^"]+)"/)?.[1];
      expect(value).toBeTruthy();
      return Object.fromEntries(value!.split(";").map((declaration) => {
        const separator = declaration.indexOf(":");
        return [declaration.slice(0, separator), declaration.slice(separator + 1)];
      }));
    };
    for (const style of VISUAL_STYLES) for (const layout of ["editorial", "split"] as const) {
      const currentPage = { ...page, style, layout };
      const preview = renderGeneratedWebsite(currentPage);
      const exported = createWebsiteExport(currentPage, layout).html;
      expect(rootStyle(preview)).toEqual(rootStyle(exported));
      expect(exported).toContain(`<style>${GENERATED_SITE_CSS}</style>`);
    }

    const minimalist = rootStyle(renderGeneratedWebsite({ ...page, style: "Minimalist" }));
    const professional = rootStyle(renderGeneratedWebsite({ ...page, style: "Professional" }));
    for (const property of ["--site-serif", "--site-heading-weight", "--site-heading-size", "--site-section-space", "--site-card-gap", "--site-radius", "--site-button-radius", "--site-nav-tracking"]) {
      expect(minimalist[property]).not.toBe(professional[property]);
    }
    for (const rule of [
      ".site-mock.site-mock .site-copy h1{font-family:var(--site-serif",
      ".site-mock.site-mock .site-cta:not(.site-cta-text){border-radius:var(--site-button-radius)",
      ".site-mock.site-mock .site-hero-image,.site-mock.site-mock .fashion-artboard",
      ".site-mock.site-mock main>section:not(.site-hero){padding-block:var(--site-section-space)",
    ]) expect(GENERATED_SITE_CSS).toContain(rule);
  });

  it("preserves style variants across page purposes, industries, layouts, and custom appearances", () => {
    const cases = [
      { template: DEFAULT_SITE_TEMPLATE, kind: "home" as const },
      { template: DEFAULT_SITE_TEMPLATE, kind: "about" as const },
      { template: DEFAULT_SITE_TEMPLATE, kind: "services" as const },
      { template: DEFAULT_SITE_TEMPLATE, kind: "products" as const },
      { template: DEFAULT_SITE_TEMPLATE, kind: "contact" as const },
      { template: DEFAULT_SITE_TEMPLATE, kind: "legacy" as const },
      { template: restaurantTemplate, kind: "home" as const },
      { template: restaurantTemplate, kind: "services" as const },
      { template: restaurantTemplate, kind: "about" as const },
      { template: restaurantTemplate, kind: "contact" as const },
      { template: fashionTemplate, kind: "home" as const },
      { template: fashionTemplate, kind: "products" as const },
      { template: fashionTemplate, kind: "about" as const },
      { template: fashionTemplate, kind: "contact" as const },
      { template: realEstateTemplate, kind: "home" as const },
      { template: realEstateTemplate, kind: "services" as const },
      { template: realEstateTemplate, kind: "about" as const },
      { template: realEstateTemplate, kind: "contact" as const },
    ];
    const customizedSettings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      appearance: { colors: { primary: "#111111", background: "#FFFFFF", accent: "#666666" }, typography: "humanist-sans" },
    };
    for (const current of cases) for (const style of VISUAL_STYLES) for (const layout of ["editorial", "split"] as const) {
      const currentPage = { ...page, style, layout };
      const pageContext = { currentPageId: "style-qa", pageKind: current.kind, pages: [{ id: "style-qa", template: current.template, kind: current.kind }] };
      const preview = renderGeneratedWebsite(currentPage, customizedSettings, null, current.template, pageContext);
      const exported = createWebsiteExport(currentPage, layout, customizedSettings, null, current.template, pageContext).html;
      expect(renderedBody(exported)).toBe(preview.replace(` ${layout} preview`, ` ${layout}`));
      expect(preview.match(/<div class="([^"]*site-mock[^"]*)"/)?.[1]).toContain(`${style.toLowerCase()} ${layout}`);
      expect(preview).toContain("--site-ink:#111111;--site-bg:#FFFFFF;--site-accent:#666666");
      expect(preview).toContain("--site-section-space:");
      expect(preview).toContain("--site-image-radius:");
      expect(exported).toContain(`<style>${GENERATED_SITE_CSS}</style>`);
    }
  });

  it("renders distinct About and Contact compositions across templates, styles, and layouts with matching preview and export anchors", () => {
    const templates = [DEFAULT_SITE_TEMPLATE, restaurantTemplate, fashionTemplate, realEstateTemplate];
    for (const template of templates) for (const kind of ["about", "contact"] as const) {
      for (const style of VISUAL_STYLES) for (const layout of ["editorial", "split"] as const) {
        const currentPage = { ...page, style, layout, headline: kind === "about" ? "A little about our work" : "Start a conversation", subheadline: kind === "about" ? "A thoughtful introduction to the business." : "A clear way to take the next step." };
        const context = { currentPageId: kind, pageKind: kind, pages: [{ id: kind, template, kind }] };
        const preview = renderGeneratedWebsite(currentPage, DEFAULT_SITE_SETTINGS, heroImage, template, context);
        const exported = createWebsiteExport(currentPage, layout, DEFAULT_SITE_SETTINGS, heroImage, template, context).html;
        const anchors = siteNavigationDestinationOptions(template, kind).map(({ destination }) => destination.slice(1));

        expect(renderedBody(exported)).toBe(preview.replace(` ${layout} preview`, ` ${layout}`));
        expect(preview).toContain(` ${style.toLowerCase()} ${layout} preview`);
        expect(preview).toContain(kind === "about" ? 'class="site-about-composition" id="site-about"' : 'class="site-contact-action" id="site-contact"');
        expect(preview).toContain('class="site-hero-image"');
        expect(preview).toContain(`--site-heading-weight:`);
        for (const anchor of anchors) expect(preview).toContain(`id="${anchor}"`);
        if (kind === "about") expect(preview).toContain(currentPage.features[0]);

        if (kind === "about" && template.id === "restaurant") expect(preview).toContain("A neighborhood kitchen shaped by seasonal cooking and shared tables.");
        if (kind === "about" && template.id === "fashion") expect(preview).toContain("An independent design studio exploring clothing as a thoughtful part of everyday life.");
        if (kind === "about" && template.id === "real-estate") expect(preview).toContain("We help people explore places that feel right for the next chapter.");
        if (kind === "contact" && template.id === "restaurant") {
          expect(preview).toContain("North district");
          expect(preview).toContain("Tuesday to Sunday, 11 am to 9 pm");
        } else if (kind === "contact") {
          expect(preview).not.toContain('id="site-visit"');
        }
        expect(preview).not.toContain("<form");
        expect(preview).not.toContain("mailto:");
        expect(exported).toContain(`<style>${GENERATED_SITE_CSS}</style>`);
      }
    }
  });

  it("omits missing template stories and contact details without losing page-purpose sections", () => {
    const sparseTemplates: SiteTemplate[] = [
      { id: "restaurant", content: { menuHighlights: restaurantTemplate.content.menuHighlights } },
      { id: "fashion", content: { collectionHighlights: fashionTemplate.content.collectionHighlights } },
      { id: "real-estate", content: { featuredProperties: realEstateTemplate.content.featuredProperties } },
    ];
    for (const template of sparseTemplates) {
      const about = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, template, { currentPageId: "about", pageKind: "about", pages: [{ id: "about", template, kind: "about" }] });
      const contact = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, template, { currentPageId: "contact", pageKind: "contact", pages: [{ id: "contact", template, kind: "contact" }] });
      expect(about).toContain('id="site-about"');
      expect(about).not.toContain('id="site-story"');
      expect(about).not.toContain('id="site-brand-story"');
      expect(about).not.toContain('id="site-agency-story"');
      expect(contact).toContain('id="site-contact"');
      expect(contact).not.toContain('id="site-visit"');
      expect(about).toContain('class="site-art');
      expect(contact).toContain('class="site-art');
      expect(about).not.toContain('<img class="site-hero-image"');
      expect(contact).not.toContain('<img class="site-hero-image"');
      expect(siteNavigationDestinationOptions(template, "about").map(({ destination }) => destination)).not.toContain("#site-story");
      expect(siteNavigationDestinationOptions(template, "contact").map(({ destination }) => destination)).not.toContain("#site-visit");
    }
  });

  it("escapes About and Contact content and keeps an unset Contact CTA noninteractive", () => {
    const unsafeCopy = { ...page, businessName: 'Northline "Studio" & Co.', headline: "About <script>alert(1)</script>", subheadline: "Copy with <b>markup</b> & symbols.", features: ["Carefully <chosen> ideas", "Design & direction"] };
    const restaurant: SiteTemplate = { id: "restaurant", content: {
      menuHighlights: restaurantTemplate.content.menuHighlights,
      story: `A kitchen's <story> & shared tables.`, location: `Lagos & "nearby"`, openingHours: "Weekdays <by appointment>",
    } };
    const about = renderGeneratedWebsite(unsafeCopy, DEFAULT_SITE_SETTINGS, null, restaurant, { currentPageId: "about", pageKind: "about", pages: [{ id: "about", template: restaurant, kind: "about" }] });
    const contact = renderGeneratedWebsite(unsafeCopy, DEFAULT_SITE_SETTINGS, null, restaurant, { currentPageId: "contact", pageKind: "contact", pages: [{ id: "contact", template: restaurant, kind: "contact" }] });
    for (const markup of [about, contact]) {
      expect(markup).toContain("About &lt;script&gt;alert(1)&lt;/script&gt;");
      expect(markup).toContain("Northline &quot;Studio&quot; &amp; Co.");
      expect(markup).not.toContain("<script>");
    }
    expect(about).toContain("A kitchen&#39;s &lt;story&gt; &amp; shared tables.");
    expect(contact).toContain("Lagos &amp; &quot;nearby&quot;");
    expect(contact).toContain("Weekdays &lt;by appointment&gt;");
    expect(contact).toContain('<span class="site-cta site-cta-text">Book a conversation</span>');
    expect(contact).not.toContain('<a class="site-cta"');
  });

  it("rejects customized color combinations that do not meet text contrast", () => {
    expect(() => createWebsiteExport(page, "editorial", {
      ...DEFAULT_SITE_SETTINGS,
      appearance: { colors: { primary: "#777777", background: "#888888", accent: null }, typography: "preset" },
    })).toThrow(/contrast requirements/);
  });

  it("uses blank link settings as non-interactive labels and rejects unsafe settings", () => {
    const html = createWebsiteExport(page, "editorial", DEFAULT_SITE_SETTINGS).html;
    const preview = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS);
    expect(html).toContain("<span>Our story</span><span>Collections</span><span>Journal</span>");
    expect(html).not.toMatch(/<a href="">/);
    expect(preview).toContain('<span class="site-cta site-cta-text">Book a conversation</span>');
    expect(() => createWebsiteExport(page, "editorial", {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [{ label: "Bad", destination: "javascript:alert(1)" }, ...DEFAULT_SITE_SETTINGS.navigation.slice(1)],
    } as never)).toThrow();
  });

  it("renders the same embedded decorative image in both layouts and exports offline with a narrow CSP allowance", () => {
    for (const layout of ["editorial", "split"] as const) {
      const currentPage = { ...page, layout };
      const preview = renderGeneratedWebsite(currentPage, DEFAULT_SITE_SETTINGS, heroImage);
      const { html } = createWebsiteExport(currentPage, layout, DEFAULT_SITE_SETTINGS, heroImage);
      const imageMarkup = `<img class="site-hero-image" src="data:image/webp;base64,${heroImage.base64}" alt="" />`;
      expect(preview).toContain(imageMarkup);
      expect(html).toContain(imageMarkup);
      expect(html).toContain("img-src data:");
      expect(html).toContain(".site-hero-image{display:block;width:min(100%,500px);height:auto;aspect-ratio:4/3");
      expect(html).toContain("@container site (max-width:700px)");
      expect(html).not.toMatch(/https?:\/\//);
      expect(html).not.toMatch(/<(?:script|link)\b/i);
      expect(html).toContain(`site-mock professional ${layout}`);
    }
  });

  it("retains CSS illustration fallback and does not widen export CSP when the image is absent", () => {
    const { html } = createWebsiteExport(page, "editorial");
    expect(renderGeneratedWebsite(page)).toContain('<div class="site-arch">');
    expect(html).toContain('<div class="site-arch">');
    expect(renderGeneratedWebsite(page)).toContain('<span class="site-art-caption">Fig. 01 — The everyday edit</span>');
    expect(html).toContain('<span class="site-art-caption">Fig. 01 — The everyday edit</span>');
    const restaurantPreview = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, restaurantTemplate);
    const restaurantExport = createWebsiteExport(page, "editorial", DEFAULT_SITE_SETTINGS, null, restaurantTemplate).html;
    for (const markup of [restaurantPreview, restaurantExport]) {
      expect(markup).toContain('<div class="site-art restaurant-art" aria-hidden="true">');
      expect(markup).toContain('<div class="restaurant-grill"></div>');
      expect(markup).toContain('<div class="restaurant-plate">');
      expect(markup).toContain('<div class="restaurant-chicken"></div>');
      expect(markup).toContain('<div class="restaurant-rice"></div>');
      expect(markup).toContain('<div class="restaurant-plantain"><i class="restaurant-plantain-slice restaurant-plantain-slice-one"></i>');
      expect(markup).toContain('<i class="restaurant-chicken-bone"></i>');
      expect(markup).toContain('<div class="restaurant-steam"></div>');
      expect(markup).toContain('<i class="restaurant-leaf restaurant-leaf-one"></i>');
      expect(markup).toContain('<i class="restaurant-leaf restaurant-leaf-three"></i>');
    }
    expect(restaurantExport).toContain(".restaurant-art .restaurant-artboard{");
    expect(restaurantExport).toContain(".site-mock.restaurant-site.luxury .restaurant-artboard");
    expect(restaurantExport).toContain(".site-mock.restaurant-site.bold .restaurant-artboard");
    expect(restaurantExport).toContain(".site-mock.restaurant-site.playful .restaurant-artboard");
    expect(restaurantExport).toContain(".site-mock.restaurant-site.minimalist .restaurant-artboard");
    expect(restaurantExport).toContain(".site-mock.restaurant-site.professional .restaurant-artboard");
    expect(restaurantExport).toContain(".restaurant-art .restaurant-chicken-bone{");
    expect(restaurantExport).toContain(".restaurant-art .restaurant-plantain-slice{");
    expect(html).not.toContain("img-src data:");
    expect(html).toContain(".site-arch{position:relative;height:clamp(220px,35cqi,440px)");
    expect(html).toContain("@container site (max-width:700px)");
  });

  it("rejects invalid image data rather than placing it into preview or export markup", () => {
    const malformed = { mimeType: "image/svg+xml", base64: "PHN2Zz4=" } as never;
    expect(() => renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, malformed)).toThrow();
    expect(() => createWebsiteExport(page, "editorial", DEFAULT_SITE_SETTINGS, malformed)).toThrow();
  });

  it("keeps the preview renderable while the user temporarily edits a field below its final minimum", () => {
    expect(renderGeneratedWebsite({ ...page, headline: "Hi" })).toContain("<h1 id=\"site-headline\">Hi</h1>");
  });

  it("renders restaurant-specific sections from validated template content in preview and export", () => {
    const settings = initializeRestaurantNavigation(DEFAULT_SITE_SETTINGS, restaurantTemplate.content);
    for (const layout of ["editorial", "split"] as const) for (const style of VISUAL_STYLES) {
      const currentPage = { ...page, layout, style };
      const preview = renderGeneratedWebsite(currentPage, settings, null, restaurantTemplate);
      const exported = createWebsiteExport(currentPage, layout, settings, null, restaurantTemplate).html;
      for (const markup of [preview, exported]) {
        expect(markup).toContain(`class="site-mock restaurant-site ${style.toLowerCase()} ${layout}`);
        expect(markup).toContain('<div class="site-art restaurant-art" aria-hidden="true">');
        expect(markup).toContain('<div class="restaurant-grill"></div>');
        expect(markup).toContain('<i class="restaurant-chicken-bone"></i>');
        expect(markup).toContain("restaurant-plantain-slice");
        expect(markup).toContain('<nav class="site-nav-links" aria-label="Restaurant navigation">');
        expect(markup).toContain('<section class="restaurant-menu" id="site-menu" aria-labelledby="site-menu-heading">');
        expect(markup).toContain("Garden pasta");
        expect(markup).toContain("Fresh pasta with seasonal vegetables and herbs.");
        expect(markup).toContain("Roasted carrots");
        expect(markup).toContain('id="site-story"');
        expect(markup).toContain('id="site-visit"');
        expect(markup).not.toContain('class="site-features"');
        expect(markup).not.toContain("Designed for the everyday");
        expect(markup).toContain('href="#site-menu">Menu</a>');
      }
      expect(exported).toContain(`<style>${GENERATED_SITE_CSS}</style>`);
    }
    expect(GENERATED_SITE_CSS).toContain(".restaurant-menu-grid{list-style:none");
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:700px){.restaurant-site");
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:700px){.restaurant-art .restaurant-artboard");
  });

  it("renders Restaurant Services as a distinct Menu page with matching preview and offline export", () => {
    const settings: SiteSettings = {
      ...initializeRestaurantNavigation(DEFAULT_SITE_SETTINGS, restaurantTemplate.content),
      navigation: [
        { label: "Menu", destination: "#site-menu", target: { type: "section", pageId: "services", anchor: "#site-menu" } },
        { label: "Our story", destination: "", target: { type: "section", pageId: "services", anchor: "#site-story" } },
        { label: "Visit", destination: "", target: { type: "section", pageId: "services", anchor: "#site-visit" } },
      ],
      ctaDestination: "",
    };
    for (const layout of ["editorial", "split"] as const) for (const style of VISUAL_STYLES) {
      const currentPage = { ...page, layout, style };
      const pageContext = { currentPageId: "services", pageKind: "services" as const, pages: [{ id: "services", template: restaurantTemplate, kind: "services" as const }] };
      const preview = renderGeneratedWebsite(currentPage, settings, null, restaurantTemplate, pageContext);
      const exported = createWebsiteExport(currentPage, layout, settings, null, restaurantTemplate, pageContext).html;
      const body = exported.match(/<body>\n([\s\S]*)\n<\/body>/)?.[1];
      expect(body).toBe(preview.replace(` ${layout} preview`, ` ${layout}`));
      for (const markup of [preview, exported]) {
        expect(markup).toContain(`class="site-mock restaurant-site ${style.toLowerCase()} ${layout}${markup === preview ? " preview" : ""} restaurant-menu-page"`);
        expect(markup).toContain('<section class="restaurant-menu restaurant-menu-page-listing" id="site-menu"');
        expect(markup).toContain('<ol class="restaurant-menu-grid restaurant-menu-page-grid">');
        expect(markup).toContain('<span class="restaurant-menu-index" aria-hidden="true">01</span>');
        expect(markup).toContain("Garden pasta");
        expect(markup).toContain("Roasted carrots");
        expect(markup).toContain('<span class="site-cta site-cta-text">Book a conversation</span>');
        expect(markup).toContain("<span>Our story</span>");
        expect(markup).toContain("<span>Visit</span>");
        expect(markup).not.toContain('id="site-story"');
        expect(markup).not.toContain('id="site-visit"');
        expect(markup).not.toContain("For Founders");
        expect(markup).not.toContain('class="site-features"');
      }
      expect(exported).toContain(`<style>${GENERATED_SITE_CSS}</style>`);
    }
    expect(GENERATED_SITE_CSS).toContain(".site-mock.restaurant-menu-page.minimalist .restaurant-menu-page-listing");
    expect(GENERATED_SITE_CSS).toContain(".site-mock.restaurant-menu-page.luxury .restaurant-dish");
    expect(GENERATED_SITE_CSS).toContain(".site-mock.restaurant-menu-page.bold .restaurant-section-heading h2");
    expect(GENERATED_SITE_CSS).toContain(".site-mock.restaurant-menu-page.playful .restaurant-menu-index");
    expect(GENERATED_SITE_CSS).toContain(".site-mock.restaurant-menu-page.professional .restaurant-menu-page-grid");
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:700px){.restaurant-menu-page");

    const withImage = renderGeneratedWebsite(page, settings, heroImage, restaurantTemplate, { currentPageId: "services", pageKind: "services", pages: [{ id: "services", template: restaurantTemplate, kind: "services" }] });
    expect(withImage).toContain(`src="data:image/webp;base64,${heroImage.base64}"`);
    expect(withImage).not.toContain("restaurant-artboard");
  });

  it("renders Fashion Collections, Real Estate Properties, and Generic Services and Products by page purpose", () => {
    const cases = [
      { template: fashionTemplate, pageKind: "products" as const, section: "site-collections", className: "fashion-collections-page", art: "fashion-artboard", expected: ["Everyday forms", "Evening edit", "Soft structure"], forbidden: ["site-brand-story", "Purchase", "Add to cart"] },
      { template: realEstateTemplate, pageKind: "services" as const, section: "site-properties", className: "real-estate-properties-page", art: "real-estate-artboard", expected: ["Garden Courtyard", "Harbor Residences", "The Linden House", "PROPERTY HIGHLIGHT"], forbidden: ["site-agency-story", "Active listings", "bedrooms", "Availability"] },
      { template: DEFAULT_SITE_TEMPLATE, pageKind: "services" as const, section: "site-services", className: "generic-services-page", art: "site-arch", expected: page.features, forbidden: ["site-products", "Add to cart", "Checkout"] },
      { template: DEFAULT_SITE_TEMPLATE, pageKind: "products" as const, section: "site-products", className: "generic-products-page", art: "site-arch", expected: page.features, forbidden: ["site-services", "Add to cart", "Checkout", "Inventory"] },
    ];
    for (const current of cases) for (const layout of ["editorial", "split"] as const) for (const style of VISUAL_STYLES) {
      const currentPage = { ...page, layout, style };
      const context = { currentPageId: current.pageKind, pageKind: current.pageKind, pages: [{ id: current.pageKind, template: current.template, kind: current.pageKind }] };
      const settings: SiteSettings = {
        ...DEFAULT_SITE_SETTINGS,
        navigation: [
          { label: "Section", destination: `#${current.section}`, target: { type: "section", pageId: current.pageKind, anchor: `#${current.section}` as "#site-collections" | "#site-properties" | "#site-services" | "#site-products" } },
          { label: "No link", destination: "", target: { type: "none" } },
          { label: "External", destination: "https://example.com", target: { type: "external", url: "https://example.com/" } },
        ],
      };
      const preview = renderGeneratedWebsite(currentPage, settings, null, current.template, context);
      const exported = createWebsiteExport(currentPage, layout, settings, null, current.template, context).html;
      const body = exported.match(/<body>\n([\s\S]*)\n<\/body>/)?.[1];
      expect(body).toBe(preview.replace(` ${layout} preview`, ` ${layout}`));
      for (const markup of [preview, exported]) {
        expect(markup).toContain(` ${current.className}`);
        expect(markup).toContain(`id="${current.section}"`);
        expect(markup).toContain(`<a href="#${current.section}">Section</a>`);
        expect(markup).toContain('<span>No link</span>');
        expect(markup).toContain('<a href="https://example.com/">External</a>');
        for (const text of current.expected) expect(markup).toContain(text);
        for (const text of current.forbidden) expect(markup).not.toContain(text);
        expect(markup).toContain(current.art);
      }
      expect(exported).toContain(`<style>${GENERATED_SITE_CSS}</style>`);
    }
    for (const pagePurpose of ["fashion-collections-page", "real-estate-properties-page", "generic-services-page", "generic-products-page"]) {
      for (const style of VISUAL_STYLES) expect(GENERATED_SITE_CSS).toContain(`.site-mock.${pagePurpose}.${style.toLowerCase()}`);
    }
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:700px){.purpose-page");
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:700px){.restaurant-menu-page");
  });

  it("keeps the generic composition intact and includes restaurant optional sections independently", () => {
    const generic = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS);
    expect(generic).toContain('<ul class="site-features">');
    expect(generic).toContain("Designed for the everyday");
    expect(generic).not.toContain("restaurant-site");

    const storyOnly: SiteTemplate = { id: "restaurant", content: { menuHighlights: restaurantTemplate.content.menuHighlights, story: "A small kitchen guided by the seasons." } };
    const visitOnly: SiteTemplate = { id: "restaurant", content: { menuHighlights: restaurantTemplate.content.menuHighlights, openingHours: "Wednesday to Sunday, 12 pm to 8 pm" } };
    const storyMarkup = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, storyOnly);
    const visitMarkup = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, visitOnly);
    expect(storyMarkup).toContain('id="site-story"');
    expect(storyMarkup).not.toContain('id="site-visit"');
    expect(visitMarkup).not.toContain('id="site-story"');
    expect(visitMarkup).toContain('id="site-visit"');
    expect(visitMarkup).toContain("Opening hours");
    expect(visitMarkup).not.toContain("Location</dt>");
  });

  it("escapes restaurant copy and omits blank optional sections and unavailable anchor links", () => {
    const customContent = {
      menuHighlights: [
        { name: `Chef's <garden> plate`, description: "Fresh & seasonal <ingredients> for every table." },
        restaurantTemplate.content.menuHighlights[1],
      ],
    };
    const template: SiteTemplate = { id: "restaurant", content: customContent };
    const settings = initializeRestaurantNavigation(DEFAULT_SITE_SETTINGS, template.content);
    const preview = renderGeneratedWebsite(page, settings, null, template);
    const exported = createWebsiteExport(page, "editorial", settings, null, template).html;
    for (const markup of [preview, exported]) {
      expect(markup).toContain("Chef&#39;s &lt;garden&gt; plate");
      expect(markup).toContain("Fresh &amp; seasonal &lt;ingredients&gt; for every table.");
      expect(markup).not.toContain('id="site-story"');
      expect(markup).not.toContain('id="site-visit"');
      expect(markup).not.toContain("Our story</h2>");
      expect(markup).toContain("<span>Our story</span>");
      expect(markup).toContain("<span>Visit</span>");
      expect(markup).toContain('<a href="#site-menu">Menu</a>');
      expect(markup).not.toMatch(/<script\b/i);
    }
  });

  it("keeps restaurant navigation customizations, CTA safety, appearance, and image fallback", () => {
    const customizedSettings: SiteSettings = {
      ...initializeRestaurantNavigation(DEFAULT_SITE_SETTINGS, restaurantTemplate.content),
      navigation: [
        { label: "Our kitchen", destination: "#site-story" },
        { label: "Food & drink", destination: "#site-menu" },
        { label: "Visit us", destination: "https://example.com/visit?from=site&next=%2F" },
      ],
      ctaDestination: "#site-menu",
      appearance: { colors: { primary: "#1A2938", background: "#F7F4EE", accent: "#A56B42" }, typography: "editorial-serif" },
    };
    const customizedPage = { ...page, style: "Luxury" as const, layout: "split" as const };
    const previewWithImage = renderGeneratedWebsite(customizedPage, customizedSettings, heroImage, restaurantTemplate);
    const exportWithImage = createWebsiteExport(customizedPage, "split", customizedSettings, heroImage, restaurantTemplate).html;
    for (const markup of [previewWithImage, exportWithImage]) {
      expect(markup).toContain("Our kitchen</a>");
      expect(markup).toContain("Food &amp; drink</a>");
      expect(markup).toContain('href="https://example.com/visit?from=site&amp;next=%2F"');
      expect(markup).toContain('class="site-cta" href="#site-menu"');
      expect(markup).toContain("--site-ink:#1A2938;--site-bg:#F7F4EE;--site-accent:#A56B42");
      expect(markup).toContain(`data:image/webp;base64,${heroImage.base64}`);
      expect(markup).not.toContain('class="restaurant-artboard"');
    }

    const noImagePreview = renderGeneratedWebsite(customizedPage, customizedSettings, null, restaurantTemplate);
    const noImageExport = createWebsiteExport(customizedPage, "split", customizedSettings, null, restaurantTemplate).html;
    expect(noImagePreview).toContain('<div class="restaurant-artboard">');
    expect(noImageExport).toContain('<div class="restaurant-artboard">');
    expect(noImageExport).not.toContain("img-src data:");
  });

  it("does not expose unsupported section anchors as interactive links and handles invalid restaurant data safely", () => {
    const settings = { ...DEFAULT_SITE_SETTINGS, ctaDestination: "#site-visit", navigation: [
      { label: "Story", destination: "#site-story" },
      { label: "Menu", destination: "#site-menu" },
      { label: "Visit", destination: "#site-visit" },
    ] } as SiteSettings;
    const contentlessTemplate = { id: "restaurant", content: { menuHighlights: restaurantTemplate.content.menuHighlights } } as const;
    const markup = renderGeneratedWebsite(page, settings, null, contentlessTemplate);
    expect(markup).toContain("<span>Story</span>");
    expect(markup).toContain('<a href="#site-menu">Menu</a>');
    expect(markup).toContain("<span>Visit</span>");
    expect(markup).toContain('<span class="site-cta site-cta-text">Book a conversation</span>');
    expect(() => createWebsiteExport(page, "editorial", settings, null, { id: "restaurant", content: { menuHighlights: [] } })).toThrow();
    expect(renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, { id: "restaurant", content: { menuHighlights: [] } as never })).not.toContain("restaurant-site");
  });

  it("renders a distinct Fashion composition in preview and export for both layouts and all styles", () => {
    for (const layout of ["editorial", "split"] as const) for (const style of VISUAL_STYLES) {
      const currentPage = { ...page, layout, style };
      const preview = renderGeneratedWebsite(currentPage, DEFAULT_SITE_SETTINGS, null, fashionTemplate);
      const exported = createWebsiteExport(currentPage, layout, DEFAULT_SITE_SETTINGS, null, fashionTemplate).html;
      const exportedBody = exported.match(/<body>\n([\s\S]*)\n<\/body>/)?.[1];
      expect(exportedBody).toBe(preview.replace(" " + layout + " preview", " " + layout));
      for (const markup of [preview, exported]) {
        expect(markup).toContain("class=\"site-mock fashion-site " + style.toLowerCase() + " " + layout);
        expect(markup).toContain("<nav class=\"site-nav-links\" aria-label=\"Fashion brand navigation\">");
        expect(markup).toContain("<section class=\"fashion-collections\" id=\"site-collections\"");
        expect(markup).toContain("Everyday forms");
        expect(markup).toContain("Evening edit");
        expect(markup).toContain("Soft structure");
        expect(markup).toContain("id=\"site-brand-story\"");
        expect(markup).toContain("An independent design studio exploring clothing");
        expect(markup).toContain("class=\"site-bottom fashion-footer\"");
        expect(markup).not.toContain("class=\"site-features\"");
        expect(markup).not.toContain("class=\"site-mock restaurant-site");
      }
      expect(exported).toContain("<style>" + GENERATED_SITE_CSS + "</style>");
    }
    for (const style of VISUAL_STYLES) expect(GENERATED_SITE_CSS).toContain(".site-mock.fashion-site." + style.toLowerCase());
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:700px){.fashion-site");
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:420px){.fashion-site");
  });

  it("omits an absent Fashion story and only activates navigation and CTA anchors that exist", () => {
    const noStory: SiteTemplate = { id: "fashion", content: { collectionHighlights: fashionTemplate.content.collectionHighlights } };
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Our story", destination: "#site-brand-story" },
        { label: "Collections", destination: "#site-collections" },
        { label: "Journal", destination: "#site-headline" },
      ],
      ctaDestination: "#site-collections",
    };
    const previewWithoutStory = renderGeneratedWebsite(page, settings, null, noStory);
    const exportWithoutStory = createWebsiteExport(page, "editorial", settings, null, noStory).html;
    for (const markup of [previewWithoutStory, exportWithoutStory]) {
      expect(markup).not.toContain("id=\"site-brand-story\"");
      expect(markup).toContain("<span>Our story</span>");
      expect(markup).toContain("<a href=\"#site-collections\">Collections</a>");
      expect(markup).toContain("<a class=\"site-cta\" href=\"#site-collections\">");
    }
    const noDestination = createWebsiteExport(page, "split", DEFAULT_SITE_SETTINGS, null, noStory).html;
    expect(noDestination).toContain("<span class=\"site-cta site-cta-text\">Book a conversation</span>");
    expect(noDestination).not.toMatch(/<a class=\"site-cta\"/);
  });

  it("connects default Fashion Story and Collections navigation to rendered sections in preview and export", () => {
    const settings = initializeFashionNavigation(DEFAULT_SITE_SETTINGS, fashionTemplate.content);
    const preview = renderGeneratedWebsite(page, settings, null, fashionTemplate);
    const exported = createWebsiteExport(page, "editorial", settings, null, fashionTemplate).html;
    const exportedBody = exported.match(/<body>\n([\s\S]*)\n<\/body>/)?.[1];
    expect(exportedBody).toBe(preview.replace(" editorial preview", " editorial"));
    for (const markup of [preview, exported]) {
      expect(markup).toContain("<a href=\"#site-brand-story\">Our story</a>");
      expect(markup).toContain("<a href=\"#site-collections\">Collections</a>");
      expect(markup).toContain("id=\"site-brand-story\"");
      expect(markup).toContain("id=\"site-collections\"");
    }
    expect(preview).not.toContain("THE LABEL");
    expect(preview).not.toContain("A point of view, made to wear.");
    expect(preview).not.toContain("Independent style, considered daily.");
  });

  it("keeps the Fashion story field separate from hero and collection fields", () => {
    const storyOnlyEdit: SiteTemplate = {
      id: "fashion",
      content: {
        collectionHighlights: fashionTemplate.content.collectionHighlights,
        brandStory: "Modiste creates custom-made pieces with intention and craftsmanship.",
      },
    };
    const markup = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, storyOnlyEdit);
    expect(markup).toContain("<h1 id=\"site-headline\">" + page.headline + "</h1>");
    expect(markup).toContain("<p>" + page.subheadline + "</p>");
    expect(markup).toContain("<h2 id=\"fashion-story-heading\">Brand story</h2><p>Modiste creates custom-made pieces with intention and craftsmanship.</p>");
    expect(markup).toContain("Everyday forms");
    expect(markup).not.toContain("Modiste creates custom-made pieces with intention and craftsmanship</h1>");
    expect(markup).not.toContain("Independent style, considered daily.");
  });

  it("prefers validated Fashion hero images, embeds them offline, and escapes all Fashion copy", () => {
    const escapedTemplate: SiteTemplate = {
      id: "fashion",
      content: {
        collectionHighlights: [
          { name: "Spring <edit> & more", description: "A \"soft\" direction & <idea> for everyday style." },
          fashionTemplate.content.collectionHighlights[1],
        ],
        brandStory: "A label's story, shaped by <care> & craft.",
      },
    };
    const previewWithImage = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, heroImage, escapedTemplate);
    const exportedWithImage = createWebsiteExport(page, "editorial", DEFAULT_SITE_SETTINGS, heroImage, escapedTemplate).html;
    for (const markup of [previewWithImage, exportedWithImage]) {
      expect(markup).toContain("src=\"data:image/webp;base64," + heroImage.base64 + "\"");
      expect(markup).not.toContain("<div class=\"fashion-artboard\">");
      expect(markup).toContain("Spring &lt;edit&gt; &amp; more");
      expect(markup).toContain("A &quot;soft&quot; direction &amp; &lt;idea&gt;");
      expect(markup).toContain("A label&#39;s story, shaped by &lt;care&gt; &amp; craft.");
      expect(markup).not.toContain("Spring <edit>");
    }
    expect(exportedWithImage).toContain("img-src data:");
    expect(exportedWithImage).toContain("<style>" + GENERATED_SITE_CSS + "</style>");
    const previewFallback = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, escapedTemplate);
    const exportFallback = createWebsiteExport(page, "editorial", DEFAULT_SITE_SETTINGS, null, escapedTemplate).html;
    for (const markup of [previewFallback, exportFallback]) {
      expect(markup).toContain("<div class=\"site-art fashion-art\" aria-hidden=\"true\">");
      expect(markup).toContain("<div class=\"fashion-garment\"><i></i></div>");
      expect(markup).not.toContain("<img class=");
    }
    expect(exportFallback).not.toContain("img-src data:");
  });

  it("keeps Fashion style CSS scoped and leaves generic and restaurant branches intact", () => {
    const generic = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS);
    const restaurant = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, restaurantTemplate);
    const fashion = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, fashionTemplate);
    expect(generic).toContain("<div class=\"site-art\" aria-hidden=\"true\"><div class=\"site-arch\">");
    expect(generic).not.toContain("fashion-site");
    expect(restaurant).toContain("restaurant-site");
    expect(restaurant).not.toContain("fashion-site");
    expect(fashion).toContain("fashion-site");
    for (const style of VISUAL_STYLES) expect(GENERATED_SITE_CSS).toContain(".site-mock.fashion-site." + style.toLowerCase());
  });

  it("preserves customized Fashion appearance values in both preview and standalone export", () => {
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      appearance: {
        colors: { primary: "#1A2938", background: "#F7F4EE", accent: "#A56B42" },
        typography: "editorial-serif",
      },
    };
    const preview = renderGeneratedWebsite(page, settings, null, fashionTemplate);
    const exported = createWebsiteExport(page, "editorial", settings, null, fashionTemplate).html;
    expect(preview).toContain("--site-ink:#1A2938;--site-bg:#F7F4EE;--site-accent:#A56B42");
    expect(exported).toContain("--site-ink:#1A2938;--site-bg:#F7F4EE;--site-accent:#A56B42");
    expect(exported).toContain("Georgia, &#39;Times New Roman&#39;, serif");
  });

  it("renders a distinct Real Estate composition in preview and export for both layouts and all styles", () => {
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Home", destination: "#top" },
        { label: "Properties", destination: "#site-properties" },
        { label: "Our approach", destination: "#site-agency-story" },
      ],
      ctaDestination: "#site-properties",
    };
    for (const layout of ["editorial", "split"] as const) for (const style of VISUAL_STYLES) {
      const currentPage = { ...page, layout, style };
      const preview = renderGeneratedWebsite(currentPage, settings, null, realEstateTemplate);
      const exported = createWebsiteExport(currentPage, layout, settings, null, realEstateTemplate).html;
      const exportedBody = exported.match(/<body>\n([\s\S]*)\n<\/body>/)?.[1];
      expect(exportedBody).toBe(preview.replace(" " + layout + " preview", " " + layout));
      for (const markup of [preview, exported]) {
        expect(markup).toContain(`class="site-mock real-estate-site ${style.toLowerCase()} ${layout}`);
        expect(markup).toContain('<nav class="site-nav-links" aria-label="Real estate agency navigation">');
        expect(markup).toContain('<section class="real-estate-properties" id="site-properties"');
        expect(markup).toContain("Property highlights");
        expect(markup).toContain("PROPERTY HIGHLIGHT / 01");
        expect(markup).not.toContain("Featured properties");
        expect(markup).toContain("Garden Courtyard");
        expect(markup).toContain("Harbor Residences");
        expect(markup).toContain("The Linden House");
        expect(markup).toContain('id="site-agency-story"');
        expect(markup).toContain("We help people explore places");
        expect(markup).toContain('<a href="#site-properties">Properties</a>');
        expect(markup).toContain('<a class="site-cta" href="#site-properties">');
        expect(markup).not.toContain('class="site-features"');
        expect(renderedBody(markup)).not.toContain("restaurant-site");
        expect(renderedBody(markup)).not.toContain("fashion-site");
      }
      expect(exported).toContain(`<style>${GENERATED_SITE_CSS}</style>`);
    }
    expect(GENERATED_SITE_CSS).toContain(".real-estate-artboard{");
    expect(GENERATED_SITE_CSS).toContain(".real-estate-property-list{");
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:700px){.real-estate-site");
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:420px){.real-estate-site");
    for (const style of VISUAL_STYLES) expect(GENERATED_SITE_CSS).toContain(`.site-mock.real-estate-site.${style.toLowerCase()}`);
  });

  it("renders each configured Real Estate anchor only when its target section exists", () => {
    const settings = initializeRealEstateNavigation(DEFAULT_SITE_SETTINGS, realEstateTemplate.content);
    const preview = renderGeneratedWebsite(page, settings, null, realEstateTemplate);
    const exported = createWebsiteExport(page, "editorial", settings, null, realEstateTemplate).html;
    const body = renderedBody(exported);
    for (const { destination } of settings.navigation) {
      if (!destination.startsWith("#")) continue;
      expect(body).toContain(`id="${destination.slice(1)}"`);
      expect(preview).toContain(`href="${destination}"`);
    }

    const unavailableStorySettings: SiteSettings = {
      ...settings,
      navigation: [
        settings.navigation[0],
        settings.navigation[1],
        { label: "Our story", destination: "#site-agency-story" },
      ],
    };
    const noStory: SiteTemplate = {
      id: "real-estate",
      content: { featuredProperties: realEstateTemplate.content.featuredProperties },
    };
    const noStoryMarkup = renderGeneratedWebsite(page, unavailableStorySettings, null, noStory);
    expect(noStoryMarkup).not.toContain('id="site-agency-story"');
    expect(noStoryMarkup).toContain("<span>Our story</span>");
    expect(noStoryMarkup).not.toContain('<a href="#site-agency-story">');
    expect(noStoryMarkup).toContain('<a href="#site-properties">Properties</a>');

    const customizedSettings: SiteSettings = {
      ...settings,
      navigation: [
        { label: "Find a home", destination: "#site-properties" },
        { label: "Our team", destination: "https://example.com/agency?from=site&view=team" },
        { label: "Start here", destination: "#top" },
      ],
    };
    const customized = renderGeneratedWebsite(page, customizedSettings, null, realEstateTemplate);
    expect(customized).toContain('<a href="#site-properties">Find a home</a>');
    expect(customized).toContain('<a href="https://example.com/agency?from=site&amp;view=team">Our team</a>');
    expect(customized).toContain('<a href="#top">Start here</a>');
  });

  it("escapes Real Estate copy and omits a blank optional story and its navigation target", () => {
    const template: SiteTemplate = {
      id: "real-estate",
      content: {
        featuredProperties: [
          { name: `O'Brien <residence> & more`, description: `A "considered" home & <garden>.` },
          realEstateTemplate.content.featuredProperties[1],
        ],
      },
    };
    const settings: SiteSettings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "Our story", destination: "#site-agency-story" },
        { label: "Properties", destination: "#site-properties" },
        { label: "Journal", destination: "#site-headline" },
      ],
      ctaDestination: "",
    };
    const preview = renderGeneratedWebsite(page, settings, null, template);
    const exported = createWebsiteExport(page, "editorial", settings, null, template).html;
    for (const markup of [preview, exported]) {
      expect(markup).toContain("O&#39;Brien &lt;residence&gt; &amp; more");
      expect(markup).toContain("A &quot;considered&quot; home &amp; &lt;garden&gt;.");
      expect(markup).not.toContain('id="site-agency-story"');
      expect(markup).toContain("<span>Our story</span>");
      expect(markup).toContain('<a href="#site-properties">Properties</a>');
      expect(markup).toContain('<span class="site-cta site-cta-text">Book a conversation</span>');
      expect(markup).not.toMatch(/<a class="site-cta"/);
      expect(markup).not.toMatch(/<script\b/i);
    }
    expect(() => createWebsiteExport(page, "editorial", settings, null, {
      id: "real-estate",
      content: { ...template.content, agencyStory: "   " },
    })).toThrow();
  });

  it("prefers validated Real Estate hero images and keeps fallback and other template compositions isolated", () => {
    const previewWithImage = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, heroImage, realEstateTemplate);
    const exportWithImage = createWebsiteExport(page, "split", DEFAULT_SITE_SETTINGS, heroImage, realEstateTemplate).html;
    for (const markup of [previewWithImage, exportWithImage]) {
      expect(markup).toContain(`src="data:image/webp;base64,${heroImage.base64}"`);
      expect(renderedBody(markup)).not.toContain("real-estate-artboard");
      expect(renderedBody(markup)).toContain('id="site-properties"');
    }
    const previewFallback = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, realEstateTemplate);
    const exportFallback = createWebsiteExport(page, "split", DEFAULT_SITE_SETTINGS, null, realEstateTemplate).html;
    for (const markup of [previewFallback, exportFallback]) {
      expect(renderedBody(markup)).toContain('<div class="site-art real-estate-art" aria-hidden="true">');
      expect(renderedBody(markup)).toContain('<div class="real-estate-artboard">');
      expect(renderedBody(markup)).toContain("real-estate-building-two");
      expect(renderedBody(markup)).not.toContain('<a href="#site-properties">Properties</a>');
      expect(renderedBody(markup)).not.toContain('class="site-art restaurant-art"');
      expect(renderedBody(markup)).not.toContain('class="site-art fashion-art"');
    }
    expect(exportFallback).not.toContain("img-src data:");
    expect(exportFallback).toContain(`<style>${GENERATED_SITE_CSS}</style>`);

    const generic = renderGeneratedWebsite(page);
    const restaurant = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, restaurantTemplate);
    const fashion = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, fashionTemplate);
    expect(generic).toContain('<div class="site-art" aria-hidden="true"><div class="site-arch">');
    expect(generic).not.toContain("real-estate-site");
    expect(restaurant).not.toContain("real-estate-site");
    expect(fashion).not.toContain("real-estate-site");
  });

  it("renders the Real Estate agency story exactly once without unrelated hard-coded story copy", () => {
    const storyCopy = realEstateTemplate.content.agencyStory!;
    const preview = renderGeneratedWebsite(page, DEFAULT_SITE_SETTINGS, null, realEstateTemplate);
    const exported = createWebsiteExport(page, "split", DEFAULT_SITE_SETTINGS, null, realEstateTemplate).html;
    for (const markup of [preview, renderedBody(exported)]) {
      expect(markup).toContain('<section class="real-estate-story" id="site-agency-story"');
      expect(markup).toContain("<h2 id=\"real-estate-story-heading\">Agency story</h2>");
      expect(markup.split(storyCopy)).toHaveLength(2);
      expect(markup).not.toContain("OUR APPROACH");
      expect(markup).not.toContain("A thoughtful approach to finding your place");
    }
  });

  it("preserves audience capitalization in preview and export for every template", () => {
    const capitalizedPage = { ...page, audience: "First-Time Buyers & Design-Led Founders" };
    for (const template of [undefined, restaurantTemplate, fashionTemplate, realEstateTemplate] as const) {
      const preview = renderGeneratedWebsite(capitalizedPage, DEFAULT_SITE_SETTINGS, null, template);
      const exported = createWebsiteExport(capitalizedPage, "editorial", DEFAULT_SITE_SETTINGS, null, template).html;
      expect(preview).toContain("For First-Time Buyers &amp; Design-Led Founders");
      expect(renderedBody(exported)).toContain("For First-Time Buyers &amp; Design-Led Founders");
      expect(preview).not.toContain("first-time buyers &amp; design-led founders");
    }
  });
});
