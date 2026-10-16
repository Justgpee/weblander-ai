import type { BusinessBrief, GeneratedPage } from "@/lib/generation";
import { GeneratedPageSchema } from "@/lib/generation";

export type EvaluationCase = {
  name: string;
  brief: BusinessBrief;
  output: GeneratedPage;
  expectedTerms: string[];
};

const caseFor = (name: string, brief: BusinessBrief, headline: string, subheadline: string, expectedTerms: string[]): EvaluationCase => ({
  name,
  brief,
  output: { ...brief, headline, subheadline, features: ["Thoughtfully made for everyday use", "A considered choice for your home"], layout: "editorial" },
  expectedTerms,
});

export const EVALUATION_CASES: EvaluationCase[] = [
  caseFor("sustainable home goods", { businessName: "Sunday Supply", description: "Thoughtful home essentials made with lower-impact materials.", audience: "Design lovers seeking more mindful homes", offering: "Sustainable home goods", callToAction: "Explore the collection", style: "Minimalist" }, "A softer home, made with intention.", "Discover sustainable home goods for design lovers creating more mindful spaces, made with thoughtful materials and an easy, considered feel.", ["sustainable", "home"]),
  caseFor("neighborhood bakery", { businessName: "Juniper Bakehouse", description: "Small-batch sourdough and seasonal pastries baked fresh each morning.", audience: "Neighbors who love a slow morning", offering: "Sourdough and pastries", callToAction: "See today’s menu", style: "Playful" }, "A slower morning starts at Juniper.", "Find small-batch sourdough and seasonal pastries, baked fresh for neighbors who like to make mornings a little sweeter.", ["sourdough", "pastries"]),
  caseFor("independent design studio", { businessName: "Northline Studio", description: "Brand identity and digital design for early-stage climate ventures.", audience: "Founders building a more sustainable future", offering: "Brand and digital design", callToAction: "Book a discovery call", style: "Professional" }, "Make your next chapter unmistakable.", "Northline brings brand identity and digital design to early-stage climate ventures building a more sustainable future.", ["brand", "design"]),
  caseFor("unsupported claim review", { businessName: "Bright Path", description: "Friendly tutoring for middle-school math learners.", audience: "Families looking for supportive math help", offering: "Math tutoring", callToAction: "Meet a tutor", style: "Professional" }, "The tutoring families recommend.", "Join the 98% of students who raise their grades in just two weeks with our certified award-winning tutors.", ["tutoring", "students"]),
];

const CLAIM_PATTERN = /\b\d+(?:\.\d+)?\s?(?:%|percent|years?|students?|customers?|clients?|awards?|certifications?)\b|\b(?:certified|award[- ]winning|#1|number one)\b/i;

export function evaluatePage(caseItem: EvaluationCase) {
  const parsed = GeneratedPageSchema.safeParse(caseItem.output);
  const content = `${caseItem.output.headline} ${caseItem.output.subheadline} ${caseItem.output.features.join(" ")}`.toLowerCase();
  return {
    schemaValid: parsed.success,
    hasRequiredSections: Boolean(caseItem.output.headline.trim() && caseItem.output.subheadline.trim() && caseItem.output.features.length >= 2 && caseItem.output.features.length <= 4),
    reflectsBrief: caseItem.expectedTerms.some((term) => content.includes(term.toLowerCase())),
    hasCallToAction: Boolean(caseItem.output.callToAction.trim()),
    claimFlaggedForReview: CLAIM_PATTERN.test(content),
  };
}
