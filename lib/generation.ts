import { z } from "zod";

export const VISUAL_STYLES = ["Minimalist", "Luxury", "Bold", "Playful", "Professional"] as const;
export const VisualStyleSchema = z.enum(VISUAL_STYLES);
export type VisualStyle = z.infer<typeof VisualStyleSchema>;

export const BusinessBriefSchema = z.object({
  businessName: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(240),
  audience: z.string().trim().min(1).max(100),
  offering: z.string().trim().min(1).max(80),
  callToAction: z.string().trim().min(1).max(36),
  style: VisualStyleSchema,
}).strict();
export type BusinessBrief = z.infer<typeof BusinessBriefSchema>;

export const GeneratedPageContentSchema = z.object({
  // Keep the model-facing schema inside Structured Outputs' portable subset;
  // enforce length limits in the application schema below.
  headline: z.string().trim(),
  subheadline: z.string().trim(),
  features: z.array(z.string().trim()),
}).strict();
export type GeneratedPageContent = z.infer<typeof GeneratedPageContentSchema>;

export const GeneratedPageSchema = BusinessBriefSchema.extend({
  headline: z.string().trim().min(8).max(100),
  subheadline: z.string().trim().min(20).max(240),
  features: z.array(z.string().trim().min(8).max(90)).min(2).max(4),
  layout: z.enum(["editorial", "split"]),
}).strict();
export type GeneratedPage = z.infer<typeof GeneratedPageSchema>;

export const EditableSectionSchema = z.enum(["headline", "description", "features", "callToAction"]);
export type EditableSection = z.infer<typeof EditableSectionSchema>;

// Keep model-facing schemas in the portable Structured Outputs subset; these
// application schemas enforce the stricter length and item-count constraints.
export const SectionStructuredOutputSchemas = {
  headline: z.object({ headline: z.string().trim() }).strict(),
  description: z.object({ subheadline: z.string().trim() }).strict(),
  features: z.object({ features: z.array(z.string().trim()) }).strict(),
  callToAction: z.object({ callToAction: z.string().trim() }).strict(),
} satisfies Record<EditableSection, z.ZodType>;

export const SectionContentSchemas = {
  headline: z.object({ headline: z.string().trim().min(8).max(100) }).strict(),
  description: z.object({ subheadline: z.string().trim().min(20).max(240) }).strict(),
  features: z.object({ features: z.array(z.string().trim().min(8).max(90)).min(2).max(4) }).strict(),
  callToAction: z.object({ callToAction: z.string().trim().min(1).max(36) }).strict(),
} satisfies Record<EditableSection, z.ZodType>;

export const SectionRegenerationRequestSchema = z.object({
  brief: BusinessBriefSchema,
  section: EditableSectionSchema,
}).strict();
export type SectionRegenerationRequest = z.infer<typeof SectionRegenerationRequestSchema>;

export const EMPTY_BRIEF: BusinessBrief = {
  businessName: "",
  description: "",
  audience: "",
  offering: "",
  callToAction: "",
  style: "Minimalist",
};
