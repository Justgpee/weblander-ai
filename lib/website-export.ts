import { z } from "zod";
import { GeneratedPageSchema, VisualStyleSchema, type GeneratedPage } from "@/lib/generation";
import { DEFAULT_SITE_SETTINGS, SiteDestinationSchema, SiteSettingsSchema, validateSiteDestination, type SiteSettings } from "@/lib/site-settings";

/** Site-only styles shared by the live preview and the standalone document. */
export const GENERATED_SITE_CSS = `
body{margin:0}.site-mock{--site-bg:#f1f0e9;--site-ink:#283026;--site-accent:#63745a;--site-serif:Georgia,'Times New Roman',serif;box-sizing:border-box;position:relative;overflow:hidden;min-height:100vh;padding:0 clamp(20px,6vw,88px) 24px;background:var(--site-bg);color:var(--site-ink);font-family:Arial,Helvetica,sans-serif}
.site-mock *{box-sizing:border-box}.site-mock.luxury{--site-bg:#eee8dd;--site-ink:#332b22;--site-accent:#9a7951;--site-serif:Georgia,'Times New Roman',serif}.site-mock.bold{--site-bg:#f1e5dc;--site-ink:#362921;--site-accent:#bd6346;--site-serif:Arial,Helvetica,sans-serif}.site-mock.playful{--site-bg:#f4eaf0;--site-ink:#392b36;--site-accent:#a16c91;--site-serif:Georgia,'Times New Roman',serif}.site-mock.professional{--site-bg:#eaf0f2;--site-ink:#24333c;--site-accent:#4e7786;--site-serif:Arial,Helvetica,sans-serif}
.site-nav{min-height:76px;border-bottom:1px solid color-mix(in srgb,var(--site-ink) 16%,transparent);display:flex;justify-content:space-between;align-items:center;gap:16px;font-size:14px}.site-logo{font-family:var(--site-serif);font-size:20px;font-weight:600;overflow-wrap:anywhere}.site-nav-links{display:flex;gap:clamp(12px,2.2vw,30px);color:color-mix(in srgb,var(--site-ink) 76%,transparent);font-size:13px}.site-nav-action{border:1px solid var(--site-ink);padding:10px 16px;font-size:13px;text-decoration:none;color:var(--site-ink)}
.site-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.92fr);gap:clamp(20px,5vw,72px);align-items:center;min-height:min(700px,78vh);padding:clamp(42px,8vh,96px) 0}.site-copy{position:relative;z-index:1}.site-kicker{font-size:11px;letter-spacing:1.5px;color:var(--site-ink);font-weight:700}.site-kicker i{font-style:normal;margin-left:5px}.site-copy h1{font-family:var(--site-serif);font-size:clamp(38px,6vw,76px);font-weight:400;letter-spacing:-.045em;line-height:1.03;margin:18px 0 20px;max-width:760px;overflow-wrap:anywhere}.site-mock.bold .site-copy h1,.site-mock.professional .site-copy h1{font-weight:700;letter-spacing:-.055em}.site-copy>p{color:color-mix(in srgb,var(--site-ink) 78%,transparent);font-size:clamp(15px,1.5vw,18px);line-height:1.7;max-width:580px;margin:0}.site-actions{margin-top:28px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}.site-cta{display:inline-flex;align-items:center;gap:10px;background:var(--site-ink);color:var(--site-bg);border:2px solid var(--site-accent);border-radius:2px;padding:13px 19px;font:600 15px/1.2 Arial,Helvetica,sans-serif;text-decoration:none}.site-cta:focus-visible,.site-nav-action:focus-visible{outline:3px solid var(--site-ink);outline-offset:4px}.site-audience{font-size:13px;color:color-mix(in srgb,var(--site-ink) 75%,transparent)}.site-features{padding-left:20px;margin:24px 0 0;color:color-mix(in srgb,var(--site-ink) 82%,transparent);font-size:14px;line-height:1.65}.site-features li+li{margin-top:6px}
.site-art{min-height:380px;display:flex;flex-direction:column;justify-content:center}.site-arch{position:relative;height:clamp(250px,38vw,440px);max-width:430px;width:100%;margin:auto;background:color-mix(in srgb,var(--site-accent) 20%,var(--site-bg));border-radius:220px 220px 3px 3px;overflow:hidden}.site-orb{position:absolute;top:13%;right:16%;width:30%;aspect-ratio:1;border-radius:50%;background:color-mix(in srgb,var(--site-accent) 33%,#e9cda8)}.site-vase{position:absolute;z-index:1;bottom:17%;background:color-mix(in srgb,var(--site-ink) 70%,var(--site-bg));box-shadow:inset 12px 0 20px #ffffff21}.site-vase-one{height:35%;width:23%;left:16%;border-radius:43% 43% 17% 17%}.site-vase-one:before{content:"";position:absolute;width:34%;height:20%;top:-14%;left:33%;border-radius:3px 3px 0 0;background:inherit}.site-vase-two{height:27%;width:19%;right:14%;border-radius:40% 40% 12% 12%;background:color-mix(in srgb,var(--site-accent) 55%,#dbbca0)}.site-vase-two:before{content:"";position:absolute;width:38%;height:20%;top:-14%;left:31%;border-radius:3px 3px 0 0;background:inherit}.site-table{position:absolute;height:7%;bottom:13%;left:8%;right:8%;border-radius:2px;background:color-mix(in srgb,var(--site-ink) 43%,var(--site-bg))}.site-spark{position:absolute;top:18%;left:13%;color:var(--site-accent);font-size:30px}.site-art-caption{text-align:center;font-size:12px;color:color-mix(in srgb,var(--site-ink) 70%,transparent);padding:12px}.site-bottom{border-top:1px solid color-mix(in srgb,var(--site-ink) 18%,transparent);padding-top:14px;display:flex;justify-content:space-between;text-transform:uppercase;letter-spacing:1px;font-size:11px;color:color-mix(in srgb,var(--site-ink) 72%,transparent)}
.site-mock.split .site-hero{grid-template-columns:minmax(0,.9fr) minmax(220px,1.1fr)}.site-mock.split .site-art{grid-column:2;grid-row:1}.site-mock.split .site-copy{grid-column:1;grid-row:1}
.site-cta-text{display:inline;color:var(--site-ink);background:transparent;border:0;padding:0;font:inherit}
.site-mock.preview{min-height:450px;padding:0 22px 13px;font-family:Arial,Helvetica,sans-serif}.site-mock.preview .site-nav{height:53px;min-height:0;font-size:8px}.site-mock.preview .site-logo{font-size:13px}.site-mock.preview .site-nav-links{gap:17px;font-size:7px}.site-mock.preview .site-nav-action{padding:8px 10px;font-size:7px}.site-mock.preview .site-hero{grid-template-columns:1fr .92fr;gap:15px;min-height:354px;padding:20px 0 10px}.site-mock.preview.split .site-hero{grid-template-columns:.9fr 1.1fr}.site-mock.preview .site-copy{padding-left:8px}.site-mock.preview .site-kicker{font-size:6px;letter-spacing:1px}.site-mock.preview .site-copy h1{font-size:clamp(23px,3vw,36px);letter-spacing:-1px;line-height:1.03;margin:11px 0 10px;max-width:260px}.site-mock.preview.bold .site-copy h1,.site-mock.preview.professional .site-copy h1{letter-spacing:-1.4px}.site-mock.preview .site-copy>p{font-size:8px;line-height:1.65;max-width:225px}.site-mock.preview .site-actions{margin-top:17px;gap:10px}.site-mock.preview .site-cta{padding:8px 10px;font-size:7px}.site-mock.preview .site-audience{font-size:6px}.site-mock.preview .site-features{padding-left:13px;margin:11px 0 0;font-size:7px;line-height:1.55}.site-mock.preview .site-features li+li{margin-top:3px}.site-mock.preview .site-art{min-height:0}.site-mock.preview .site-arch{height:235px;max-width:220px;border-radius:100px 100px 3px 3px}.site-mock.preview .site-orb{top:31px;right:35px;width:75px}.site-mock.preview .site-vase{bottom:40px}.site-mock.preview .site-vase-one{height:81px;width:50px;left:35px}.site-mock.preview .site-vase-two{height:62px;width:40px;right:31px}.site-mock.preview .site-table{height:15px;bottom:32px;left:18px;right:17px}.site-mock.preview .site-spark{top:41px;left:28px;font-size:15px}.site-mock.preview .site-art-caption{position:absolute;bottom:19px;left:0;right:0;font-size:6px;padding:0}.site-mock.preview .site-bottom{padding-top:8px;font-size:6px;letter-spacing:.8px}
@media(max-width:700px){.site-nav{min-height:64px}.site-nav-links{display:none}.site-hero,.site-mock.split .site-hero{grid-template-columns:1fr;min-height:0;padding:54px 0}.site-mock.split .site-art,.site-mock.split .site-copy{grid-column:auto;grid-row:auto}.site-art{min-height:300px}.site-copy h1{font-size:clamp(38px,11vw,60px)}.site-bottom{font-size:9px}.site-mock.preview{padding-left:12px;padding-right:12px}.site-mock.preview .site-hero,.site-mock.preview.split .site-hero{grid-template-columns:1fr .8fr;gap:6px;min-height:300px;padding:20px 0 10px}.site-mock.preview .site-copy{padding-left:0}.site-mock.preview .site-copy h1{font-size:24px}.site-mock.preview .site-copy>p{font-size:7px}.site-mock.preview .site-nav-links{display:none}.site-mock.preview .site-arch{height:190px}.site-mock.preview .site-art{min-height:0;padding-top:15px}}
@media(max-width:420px){.site-mock.preview .site-hero,.site-mock.preview.split .site-hero{grid-template-columns:1fr}.site-mock.preview .site-art{display:none}.site-mock.preview .site-copy h1{font-size:30px;max-width:none}}
.site-nav-links a{color:inherit;text-decoration:none}.site-nav-links a:hover{text-decoration:underline}.site-nav-links a:focus-visible,.site-cta:focus-visible{outline:3px solid var(--site-ink);outline-offset:4px}
@media(max-width:700px){.site-mock .site-nav-links,.site-mock.preview .site-nav-links{display:flex;flex-wrap:wrap;gap:8px;font-size:11px}}
`;

export const validateCtaDestination = validateSiteDestination;

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function siteMarkup(page: GeneratedPage, siteSettings: SiteSettings, preview = false): string {
  const styleClass = page.style.toLowerCase();
  const classes = ["site-mock", styleClass, page.layout, ...(preview ? ["preview"] : [])].join(" ");
  const ctaDestinationResult = SiteSettingsSchema.shape.ctaDestination.safeParse(siteSettings.ctaDestination);
  const ctaHref = ctaDestinationResult.success ? validateSiteDestination(ctaDestinationResult.data) : undefined;
  const cta = ctaHref
    ? `<a class="site-cta" href="${escapeHtml(ctaHref)}">${escapeHtml(page.callToAction)} <span aria-hidden="true">↗</span></a>`
    : `<span class="site-cta site-cta-text">${escapeHtml(page.callToAction)}</span>`;
  const features = page.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("");
  const navigation = siteSettings.navigation.map(({ label, destination }) => {
    const destinationResult = SiteDestinationSchema.safeParse(destination);
    const href = destinationResult.success ? validateSiteDestination(destinationResult.data) : undefined;
    return href ? `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>` : `<span>${escapeHtml(label)}</span>`;
  }).join("");
  return `<div class="${classes}"><header id="top" class="site-nav"><span class="site-logo">${escapeHtml(page.businessName)}</span><nav class="site-nav-links" aria-label="Website sections">${navigation}</nav></header><main><section class="site-hero" aria-labelledby="site-headline"><div class="site-copy"><span class="site-kicker">MADE WITH INTENTION <i aria-hidden="true">✦</i></span><h1 id="site-headline">${escapeHtml(page.headline)}</h1><p>${escapeHtml(page.subheadline)}</p><div class="site-actions">${cta}<span class="site-audience">For ${escapeHtml(page.audience.toLowerCase())}</span></div><ul class="site-features">${features}</ul></div><div class="site-art" aria-hidden="true"><div class="site-arch"><div class="site-orb"></div><div class="site-vase site-vase-one"></div><div class="site-vase site-vase-two"></div><div class="site-table"></div><span class="site-spark">✳</span></div><span class="site-art-caption">Fig. 01 — The everyday edit</span></div></section></main><footer class="site-bottom"><span>Designed for the everyday</span><span>01 / 03</span></footer></div>`;
}

export function renderGeneratedWebsite(page: GeneratedPage, siteSettings: SiteSettings = DEFAULT_SITE_SETTINGS): string {
  // Editor fields may be temporarily below their final submission limits while
  // the user is typing. Restrict class-generating values, while escaping all copy.
  const style = VisualStyleSchema.parse(page.style);
  const layout = z.enum(["editorial", "split"]).parse(page.layout);
  // Invalid in-progress editor values stay visible but non-interactive; saves and
  // exports still require the complete strict settings schema.
  return siteMarkup({ ...page, style, layout }, siteSettings, true);
}

export function sanitizeExportFilename(businessName: string): string {
  const slug = businessName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
  return `weblander-${slug || "website"}.html`;
}

export function createWebsiteExport(page: unknown, layout: unknown, settingsOrDestination: SiteSettings | string = DEFAULT_SITE_SETTINGS): { html: string; filename: string } {
  const validatedPage = GeneratedPageSchema.parse({ ...(page as object), layout });
  const settings = SiteSettingsSchema.parse(typeof settingsOrDestination === "string"
    ? { ...DEFAULT_SITE_SETTINGS, ctaDestination: settingsOrDestination }
    : settingsOrDestination);
  const title = escapeHtml(validatedPage.businessName);
  const description = escapeHtml(validatedPage.subheadline);
  const markup = siteMarkup(validatedPage, settings);
  const html = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="description" content="${description}">\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">\n<title>${title}</title>\n<style>${GENERATED_SITE_CSS}</style>\n</head>\n<body>\n${markup}\n</body>\n</html>`;
  return { html, filename: sanitizeExportFilename(validatedPage.businessName) };
}
