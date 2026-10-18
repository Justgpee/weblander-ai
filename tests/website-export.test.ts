import { describe, expect, it } from "vitest";
import { VISUAL_STYLES, type GeneratedPage } from "@/lib/generation";
import { createWebsiteExport, renderGeneratedWebsite, sanitizeExportFilename, validateCtaDestination } from "@/lib/website-export";
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/lib/site-settings";

const page: GeneratedPage = {
  businessName: "Northline Studio", description: "Design for independent teams.", audience: "Founders", offering: "Brand identity",
  callToAction: "Book a conversation", style: "Professional", headline: "Build a brand with a clearer point of view.",
  subheadline: "Thoughtful identity and digital design for independent teams ready to grow.",
  features: ["A focused identity system for your next chapter", "Clear direction for meaningful growth"], layout: "editorial",
};

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

  it("uses the same site markup renderer for the preview", () => {
    const previewMarkup = renderGeneratedWebsite(page);
    const { html } = createWebsiteExport(page, "editorial");
    expect(previewMarkup).toContain('<h1 id="site-headline">Build a brand');
    expect(previewMarkup).toContain('class="site-mock professional editorial preview"');
    expect(html).toContain('<h1 id="site-headline">Build a brand');
  });

  it("renders configured navigation and CTA destinations as escaped functional links", () => {
    const settings: SiteSettings = {
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
      const inlineStyle = 'style="--site-ink:#1A2938;--site-bg:#F7F4EE;--site-accent:#A56B42;--site-serif:&#39;Trebuchet MS&#39;, Arial, sans-serif;--site-body-font:&#39;Trebuchet MS&#39;, Arial, sans-serif"';
      expect(preview).toContain(inlineStyle);
      expect(exported).toContain(inlineStyle);
      expect(exported).toContain("Trebuchet MS");
      expect(exported).not.toMatch(/@import|fonts\.googleapis|https?:\/\/[^\s"']+\.css/i);
    }
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

  it("keeps the preview renderable while the user temporarily edits a field below its final minimum", () => {
    expect(renderGeneratedWebsite({ ...page, headline: "Hi" })).toContain("<h1 id=\"site-headline\">Hi</h1>");
  });
});
