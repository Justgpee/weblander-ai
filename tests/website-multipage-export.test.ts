import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { createMultiPageWebsiteFiles, createWebsiteExport, GENERATED_SITE_CSS, renderGeneratedWebsite } from "@/lib/website-export";
import { projectSnapshotFromPages, type ProjectPage } from "@/lib/projects";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";
import type { BusinessBrief } from "@/lib/generation";
import type { SiteTemplate } from "@/lib/site-templates";
import { createWebsiteZipBlob, downloadWebsiteZip, type WebsiteDownloadPlatform } from "@/lib/website-zip";
import { siteLogoAssetDataUrl, type SiteLogoAsset } from "@/lib/site-logo";

const brief: BusinessBrief = {
  businessName: "Northline Studio", description: "Design for independent teams.", audience: "Founders",
  offering: "Brand identity", callToAction: "Book a conversation", style: "Professional",
};
const content = { headline: "Build a brand with a clearer point of view.", description: "Thoughtful identity and digital design for independent teams ready to grow.", features: ["A focused identity system for your next chapter", "Clear direction for meaningful growth"], callToAction: "Talk with our team" };
const fashion: SiteTemplate = { id: "fashion", content: { collectionHighlights: [
  { name: "Everyday forms", description: "Considered pieces for the rhythm of daily dressing." },
  { name: "Evening edit", description: "A refined direction for after-dark expression." },
], brandStory: "An independent design studio exploring clothing as a thoughtful part of everyday life." } };
const restaurant: SiteTemplate = { id: "restaurant", content: { menuHighlights: [
  { name: "Garden pasta", description: "Fresh pasta with seasonal vegetables and herbs." },
  { name: "Roasted carrots", description: "Slow-roasted carrots with a bright citrus dressing." },
], story: "A neighborhood kitchen shaped by seasonal cooking and shared tables." } };
const realEstate: SiteTemplate = { id: "real-estate", content: { featuredProperties: [
  { name: "Garden Courtyard", description: "A calm home concept shaped around a shared garden." },
  { name: "Harbor Residences", description: "Contemporary living with a thoughtful sense of space." },
] } };
const logoBytes = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=", "base64"));
const logo: SiteLogoAsset = { assetId: "11111111-1111-4111-8111-111111111111", mimeType: "image/png", bytes: logoBytes, dataUrl: siteLogoAssetDataUrl("image/png", logoBytes) };

function page(id: string, slug: string, title: string, kind: ProjectPage["kind"], template: SiteTemplate): ProjectPage {
  return { id, slug, title, kind, content, template } as ProjectPage;
}

function snapshotFor(template: SiteTemplate = { id: "generic" }, settings: SiteSettings = DEFAULT_SITE_SETTINGS) {
  const home = page("home", "index", "Home", "home", template);
  return projectSnapshotFromPages(brief, [home], "editorial", settings);
}

describe("complete static website export", () => {
  it("uses stored page order, safe deterministic filenames and collision suffixes", () => {
    const pages = [
      page("home", "index", "Home", "home", { id: "generic" }),
      page("about", "about", "About", "about", fashion),
      page("services", "services", "Services", "services", restaurant),
      page("products", "products", "Products", "products", { id: "generic" }),
    ];
    const files = createMultiPageWebsiteFiles(projectSnapshotFromPages(brief, pages, "split"));
    expect(files.slice(0, 4).map(({ path }) => path)).toEqual(["index.html", "about.html", "services.html", "products.html"]);
    expect(() => projectSnapshotFromPages(brief, [pages[0], { ...pages[1], slug: "index" }], "split")).toThrow();
  });

  it("renders every supported template and retains the artwork fallback", () => {
    for (const template of [{ id: "generic" }, restaurant, fashion, realEstate] as SiteTemplate[]) {
      const files = createMultiPageWebsiteFiles(snapshotFor(template));
      const html = files[0].data as string;
      expect(html).toContain(template.id === "generic" ? "site-mock" : `${template.id}-site`);
      expect(html).not.toContain("assets/hero.");
    }
  });

  it("keeps wide export layouts distinct and preserves narrow stacking in standalone and ZIP documents", () => {
    const exportPage = { ...brief, headline: content.headline, subheadline: content.description, features: content.features, layout: "editorial" as const };
    const editorialStandalone = createWebsiteExport(exportPage, "editorial").html;
    const splitStandalone = createWebsiteExport({ ...exportPage, layout: "split" }, "split").html;
    const editorialZip = createMultiPageWebsiteFiles(snapshotFor({ id: "generic" }))[0].data as string;
    const splitZip = createMultiPageWebsiteFiles(projectSnapshotFromPages(brief, [page("home", "index", "Home", "home", { id: "generic" })], "split"))[0].data as string;

    for (const markup of [editorialStandalone, editorialZip]) expect(markup).toMatch(/class="[^"]* editorial"/);
    for (const markup of [splitStandalone, splitZip]) expect(markup).toMatch(/class="[^"]* split"/);
    for (const markup of [editorialStandalone, splitStandalone, editorialZip, splitZip]) {
      expect(markup).not.toMatch(/class="[^"]* preview/);
    }
    expect(GENERATED_SITE_CSS).toContain(".site-mock.split .site-hero{grid-template-columns:minmax(0,.94fr) minmax(0,1.06fr)}");
    expect(GENERATED_SITE_CSS).toContain("@container site (max-width:700px){.site-mock{padding-inline:");
    expect(GENERATED_SITE_CSS).toContain(".site-hero,.site-mock.split .site-hero{grid-template-columns:minmax(0,1fr)");
  });

  it("resolves cross-page navigation, section links, anchors, safe external links and typed CTAs", () => {
    const pages = [
      page("home", "index", "Home", "home", { id: "generic" }),
      page("about", "about", "About", "about", fashion),
    ];
    const settings = {
      ...DEFAULT_SITE_SETTINGS,
      navigation: [
        { label: "About", destination: "", target: { type: "page", pageId: "about" } },
        { label: "Brand story", destination: "", target: { type: "section", pageId: "about", anchor: "#site-brand-story" } },
        { label: "External", destination: "https://example.com/", target: { type: "external", url: "https://example.com/" } },
      ],
      ctaDestination: "",
      ctaTarget: { type: "section", pageId: "about", anchor: "#site-brand-story" },
    } as SiteSettings;
    const files = createMultiPageWebsiteFiles(projectSnapshotFromPages(brief, pages, "editorial", settings));
    const homeHtml = files[0].data as string;
    expect(homeHtml).toContain('href="about.html"');
    expect(homeHtml).toContain('href="about.html#site-brand-story"');
    expect(homeHtml).toContain('href="https://example.com/"');
    expect(homeHtml).toContain('class="site-cta" href="about.html#site-brand-story"');
  });

  it("keeps a cross-page CTA interactive in the studio preview", () => {
    const pages = [page("home", "index", "Home", "home", { id: "generic" }), page("about", "about", "About", "about", fashion)];
    const settings = { ...DEFAULT_SITE_SETTINGS, ctaDestination: "", ctaTarget: { type: "page", pageId: "about" } } as SiteSettings;
    const markup = renderGeneratedWebsite({ ...brief, headline: content.headline, subheadline: content.description, features: content.features, callToAction: content.callToAction, layout: "editorial" }, settings, null, { id: "generic" }, { currentPageId: "home", pageKind: "home", pages });
    expect(markup).toContain('class="site-cta" data-site-navigation-action="page" data-page-id="about"');
    expect(markup).toContain('<a class="site-logo" href="#top" aria-label="Return to homepage">Northline Studio</a>');
    expect(GENERATED_SITE_CSS).toContain(".site-logo:focus-visible");
  });

  it("writes shared CSS and one correctly typed relative image asset", () => {
    const image = { mimeType: "image/webp" as const, base64: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).toString("base64") };
    const files = createMultiPageWebsiteFiles({ ...snapshotFor(), heroImage: image });
    expect(files.filter(({ path }) => path === "assets/site.css")).toHaveLength(1);
    expect(files.find(({ path }) => path === "assets/site.css")?.data).toBe(GENERATED_SITE_CSS);
    expect(files.filter(({ path }) => path.startsWith("assets/hero."))).toHaveLength(1);
    expect(files.find(({ path }) => path === "assets/hero.webp")?.compression).toBe("store");
    expect((files[0].data as string)).toContain('src="assets/hero.webp"');
  });

  it("links every ZIP page logo to the archive homepage", () => {
    const pages = [
      page("home", "index", "Home", "home", { id: "generic" }),
      page("about", "about", "About", "about", fashion),
      page("services", "services", "Services", "services", restaurant),
    ];
    const files = createMultiPageWebsiteFiles(projectSnapshotFromPages(brief, pages, "editorial"));
    for (const file of files.filter(({ path }) => path.endsWith(".html"))) {
      expect(file.data).toContain('<a class="site-logo" href="./index.html" aria-label="Return to homepage">Northline Studio</a>');
    }
  });

  it("renders a project logo in the standalone HTML and includes one relative ZIP asset", async () => {
    const settings = { ...DEFAULT_SITE_SETTINGS, branding: { logoAssetId: logo.assetId, logoDisplayMode: "image-with-name" as const } };
    const pageMarkup = { ...brief, headline: content.headline, subheadline: content.description, features: content.features, layout: "editorial" as const };
    const standalone = renderGeneratedWebsite(pageMarkup, settings, null, { id: "generic" }, undefined, logo);
    expect(standalone).toContain(`<img class="site-logo-image" src="${logo.dataUrl}" alt="" />`);
    expect(standalone).toContain('<span class="site-logo-name">Northline Studio</span>');

    const files = createMultiPageWebsiteFiles(projectSnapshotFromPages(brief, [page("home", "index", "Home", "home", { id: "generic" }), page("about", "about", "About", "about", fashion)], "editorial", settings), logo);
    expect(files.filter(({ path }) => path === "assets/logo.png")).toHaveLength(1);
    expect(files.find(({ path }) => path === "assets/logo.png")).toMatchObject({ data: logoBytes, compression: "store" });
    for (const html of files.filter(({ path }) => path.endsWith(".html")).map(({ data }) => data as string)) {
      expect(html).toContain('src="assets/logo.png"');
      expect(html).toContain('href="./index.html" aria-label="Return to homepage"');
    }
    const entries = unzipSync(new Uint8Array(await (await createWebsiteZipBlob(files)).arrayBuffer()));
    expect([...entries["assets/logo.png"]]).toEqual([...logoBytes]);
  });

  it("embeds a valid PNG in actual standalone HTML for both branding modes", () => {
    const pageMarkup = { ...brief, headline: content.headline, subheadline: content.description, features: content.features, layout: "editorial" as const };
    const context: NonNullable<Parameters<typeof createWebsiteExport>[5]> = { currentPageId: "home", pageKind: "home", pages: [{ id: "home", template: { id: "generic" }, kind: "home" }] };
    const imageOnly = createWebsiteExport(pageMarkup, "editorial", {
      ...DEFAULT_SITE_SETTINGS,
      branding: { logoAssetId: logo.assetId, logoDisplayMode: "image-only" },
    }, null, { id: "generic" }, context, logo).html;
    expect(imageOnly).toContain(`src="${logo.dataUrl}" alt="Northline Studio"`);
    expect(imageOnly).not.toContain('<span class="site-logo-name">');
    expect(imageOnly).toContain("img-src data:");

    const imageAndName = createWebsiteExport(pageMarkup, "editorial", {
      ...DEFAULT_SITE_SETTINGS,
      branding: { logoAssetId: logo.assetId, logoDisplayMode: "image-with-name" },
    }, null, { id: "generic" }, context, logo).html;
    expect(imageAndName).toContain(`src="${logo.dataUrl}" alt=""`);
    expect(imageAndName).toContain('<span class="site-logo-name">Northline Studio</span>');

    const missingLogo = createWebsiteExport(pageMarkup, "editorial", {
      ...DEFAULT_SITE_SETTINGS,
      branding: { logoAssetId: logo.assetId, logoDisplayMode: "image-only" },
    }, null, { id: "generic" }, context, null).html;
    expect(missingLogo).not.toContain('<img class="site-logo-image"');
    expect(missingLogo).toContain("Northline Studio</a>");
  });

  it("does not include a missing, mismatched, or malformed logo payload", () => {
    const settings = { ...DEFAULT_SITE_SETTINGS, branding: { logoAssetId: logo.assetId, logoDisplayMode: "image-only" as const } };
    const snapshot = projectSnapshotFromPages(brief, [page("home", "index", "Home", "home", { id: "generic" })], "editorial", settings);
    expect(createMultiPageWebsiteFiles(snapshot).some(({ path }) => path.startsWith("assets/logo."))).toBe(false);
    expect(createMultiPageWebsiteFiles(snapshot, { ...logo, assetId: "22222222-2222-4222-8222-222222222222" }).some(({ path }) => path.startsWith("assets/logo."))).toBe(false);
    expect(createMultiPageWebsiteFiles(snapshot, { ...logo, dataUrl: "data:text/html,unsafe" }).some(({ path }) => path.startsWith("assets/logo."))).toBe(false);
  });

  it("rejects unresolved page references and creates an extractable ZIP", async () => {
    const invalid = { ...DEFAULT_SITE_SETTINGS, ctaDestination: "", ctaTarget: { type: "page", pageId: "missing" } } as SiteSettings;
    expect(() => createMultiPageWebsiteFiles(projectSnapshotFromPages(brief, [page("home", "index", "Home", "home", { id: "generic" })], "editorial", invalid))).toThrow();
    const files = createMultiPageWebsiteFiles(snapshotFor());
    const blob = await createWebsiteZipBlob(files);
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(entries)).toEqual(["index.html", "assets/site.css"]);
    expect(new TextDecoder().decode(entries["assets/site.css"])).toBe(GENERATED_SITE_CSS);
  });

  it("downloads the ZIP with a temporary URL and schedules its revocation", () => {
    const calls: string[] = [];
    const anchor = { href: "", download: "", hidden: false, click: () => calls.push("click"), remove: () => calls.push("remove") };
    const platform: WebsiteDownloadPlatform = {
      createObjectURL: () => "blob:preview",
      revokeObjectURL: (url) => calls.push(`revoke:${url}`),
      createAnchor: () => anchor,
      append: () => calls.push("append"),
      setTimeout: (callback, delay) => { calls.push(`delay:${delay}`); callback(); },
    };
    downloadWebsiteZip(new Blob(["zip"]), "weblander-website.zip", platform);
    expect(anchor).toMatchObject({ href: "blob:preview", download: "weblander-website.zip", hidden: true });
    expect(calls).toEqual(["append", "click", "remove", "delay:1000", "revoke:blob:preview"]);
  });
});
