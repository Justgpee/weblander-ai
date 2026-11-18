import { z } from "zod";
import { BusinessBriefSchema, SectionContentSchemas } from "@/lib/generation";
import { ProjectIdSchema, ProjectPageContentSchema, ProjectPageIdSchema, ProjectPageSlugSchema, ProjectPageTitleSchema } from "@/lib/projects";
import { SiteTemplateSchema, type SiteTemplate } from "@/lib/site-templates";
import { hasCanonicalSitePageIdentity, isSitePageKindCompatible, SitePageKindSchema } from "@/lib/site-page-kind";
import {
  FashionCollectionHighlightSchema,
  RealEstateFeaturedPropertySchema,
  RestaurantMenuHighlightSchema,
} from "@/lib/site-templates";

export const PageRegenerationSectionSchema = z.enum([
  "headline", "description", "features", "callToAction",
  "menuHighlights", "collectionHighlights", "featuredProperties",
]);
export type PageRegenerationSection = z.infer<typeof PageRegenerationSectionSchema>;
export const TemplateRegenerationSectionSchema = z.enum(["menuHighlights", "collectionHighlights", "featuredProperties"]);
export type TemplateRegenerationSection = z.infer<typeof TemplateRegenerationSectionSchema>;

export const PageSectionContentSchemas = {
  headline: SectionContentSchemas.headline,
  description: SectionContentSchemas.description,
  features: SectionContentSchemas.features,
  callToAction: SectionContentSchemas.callToAction,
  menuHighlights: z.object({ menuHighlights: z.array(RestaurantMenuHighlightSchema).min(2).max(4) }).strict(),
  collectionHighlights: z.object({ collectionHighlights: z.array(FashionCollectionHighlightSchema).min(2).max(4) }).strict(),
  featuredProperties: z.object({ featuredProperties: z.array(RealEstateFeaturedPropertySchema).min(2).max(4) }).strict(),
} satisfies Record<PageRegenerationSection, z.ZodType>;

export const PageSectionStructuredOutputSchemas = {
  headline: z.object({ headline: z.string().trim() }).strict(),
  description: z.object({ subheadline: z.string().trim() }).strict(),
  features: z.object({ features: z.array(z.string().trim()) }).strict(),
  callToAction: z.object({ callToAction: z.string().trim() }).strict(),
  menuHighlights: z.object({ menuHighlights: z.array(z.object({ name: z.string().trim(), description: z.string().trim() }).strict()) }).strict(),
  collectionHighlights: z.object({ collectionHighlights: z.array(z.object({ name: z.string().trim(), description: z.string().trim() }).strict()) }).strict(),
  featuredProperties: z.object({ featuredProperties: z.array(z.object({ name: z.string().trim(), description: z.string().trim() }).strict()) }).strict(),
} satisfies Record<PageRegenerationSection, z.ZodType>;

export const PageSectionGenerationRequestSchema = z.object({
  projectId: ProjectIdSchema.nullable(),
  brief: BusinessBriefSchema,
  page: z.object({
    id: ProjectPageIdSchema,
    slug: ProjectPageSlugSchema,
    title: ProjectPageTitleSchema,
    kind: SitePageKindSchema,
    content: ProjectPageContentSchema,
    template: SiteTemplateSchema,
  }).strict().superRefine((page, context) => {
    if (page.kind !== "legacy" && !isSitePageKindCompatible(page.kind, page.template.id)) {
      context.addIssue({ code: "custom", path: ["kind"], message: "This page kind is not supported by its template." });
    }
    if (page.kind !== "legacy" && !hasCanonicalSitePageIdentity(page.kind, page)) {
      context.addIssue({ code: "custom", path: ["id"], message: "This page kind must use its stable page identity." });
    }
  }),
  section: PageRegenerationSectionSchema,
}).strict().superRefine((request, context) => {
  const valid = request.section === "menuHighlights" ? request.page.template.id === "restaurant"
    : request.section === "collectionHighlights" ? request.page.template.id === "fashion"
    : request.section === "featuredProperties" ? request.page.template.id === "real-estate"
    : true;
  if (!valid) context.addIssue({ code: "custom", path: ["section"], message: "This section is not supported by the page template." });
});
export type PageSectionGenerationRequest = z.infer<typeof PageSectionGenerationRequestSchema>;

/** Merge a response into only its target field when that field has not been edited since request start. */
export function mergeTemplateSectionIfUnchanged(
  template: SiteTemplate,
  section: TemplateRegenerationSection,
  output: unknown,
  requestedRevision: number,
  currentRevision: number,
): SiteTemplate {
  if (requestedRevision !== currentRevision) return template;
  if (section === "menuHighlights" && template.id === "restaurant") {
    const validated = PageSectionContentSchemas.menuHighlights.parse(output);
    return { ...template, content: { ...template.content, ...validated } };
  }
  if (section === "collectionHighlights" && template.id === "fashion") {
    const validated = PageSectionContentSchemas.collectionHighlights.parse(output);
    return { ...template, content: { ...template.content, ...validated } };
  }
  if (section === "featuredProperties" && template.id === "real-estate") {
    const validated = PageSectionContentSchemas.featuredProperties.parse(output);
    return { ...template, content: { ...template.content, ...validated } };
  }
  return template;
}
