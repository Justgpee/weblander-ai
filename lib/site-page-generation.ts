import { z } from "zod";
import {
  ProjectPageIdSchema,
  ProjectPageV8Schema,
  ProjectPageSlugSchema,
  ProjectPageTitleSchema,
  type ProjectPageV8,
} from "@/lib/projects";
import { BusinessBriefSchema } from "@/lib/generation";
import { SiteTemplateSchema } from "@/lib/site-templates";
import { isSitePageKindCompatible } from "@/lib/site-page-kind";

export const SitePageTypeSchema = z.enum(["home", "about", "services", "products", "contact"]);
export type SitePageType = z.infer<typeof SitePageTypeSchema>;

export const SitePageIdentitySchema = z.object({
  id: ProjectPageIdSchema,
  slug: ProjectPageSlugSchema,
  title: ProjectPageTitleSchema,
}).strict();
export type SitePageIdentity = z.infer<typeof SitePageIdentitySchema>;

export const SitePageGenerationRequestSchema = z.object({
  brief: BusinessBriefSchema,
  pageType: SitePageTypeSchema,
  identity: SitePageIdentitySchema,
  template: SiteTemplateSchema,
}).strict().superRefine((request, context) => {
  if (!isSitePageKindCompatible(request.pageType, request.template.id)) {
    context.addIssue({ code: "custom", path: ["pageType"], message: "This page type is not supported by the selected template." });
  }
  if (request.pageType === "home" && (request.identity.id !== "home" || request.identity.slug !== "index")) {
    context.addIssue({ code: "custom", path: ["identity"], message: "The home page must use the stable home identity." });
  }
  if (request.pageType !== "home" && request.identity.id === "home") {
    context.addIssue({ code: "custom", path: ["identity", "id"], message: "Only the home page may use the home identity." });
  }
});
export type SitePageGenerationRequest = z.infer<typeof SitePageGenerationRequestSchema>;

/** Provider-facing schema stays in the portable Structured Outputs subset. */
export const SitePageGenerationOutputSchema = z.object({
  headline: z.string().trim(),
  description: z.string().trim(),
  features: z.array(z.string().trim()),
  callToAction: z.string().trim(),
}).strict();
export type SitePageGenerationOutput = z.infer<typeof SitePageGenerationOutputSchema>;

export const SitePageGenerationResponseSchema = ProjectPageV8Schema;
export type SitePageGenerationResponse = ProjectPageV8;
