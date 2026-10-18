import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_SETTINGS,
  SiteDestinationSchema,
  SiteSettingsSchema,
  validateSiteDestination,
} from "@/lib/site-settings";

describe("site settings", () => {
  it("requires exactly three non-empty, bounded navigation labels", () => {
    expect(SiteSettingsSchema.safeParse(DEFAULT_SITE_SETTINGS).success).toBe(true);
    expect(SiteSettingsSchema.safeParse({ ...DEFAULT_SITE_SETTINGS, navigation: DEFAULT_SITE_SETTINGS.navigation.slice(0, 2) }).success).toBe(false);
    expect(SiteSettingsSchema.safeParse({ ...DEFAULT_SITE_SETTINGS, navigation: [{ label: "", destination: "" }, ...DEFAULT_SITE_SETTINGS.navigation.slice(1)] }).success).toBe(false);
    expect(SiteSettingsSchema.safeParse({ ...DEFAULT_SITE_SETTINGS, extra: true }).success).toBe(false);
  });

  it("allows blank destinations, HTTP(S) URLs without credentials, and supported anchors", () => {
    for (const destination of ["", "https://example.com/path?a=1&b=2", "http://localhost:3000/page", "#top", "#site-headline"]) {
      expect(SiteDestinationSchema.safeParse(destination).success, destination).toBe(true);
    }
    expect(validateSiteDestination("")).toBeUndefined();
    expect(validateSiteDestination("#top")).toBe("#top");
    expect(validateSiteDestination("https://example.com")).toBe("https://example.com/");
  });

  it("rejects dangerous schemes, credentials, protocol-relative URLs, controls, and unsupported fragments", () => {
    for (const destination of ["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "//example.com", "\\\\example.com", "https://user:pass@example.com", "#contact", "https://example.com/\npath", "\thttps://example.com", "https://example.com\u0085"]) {
      expect(SiteDestinationSchema.safeParse(destination).success, destination).toBe(false);
    }
  });
});
