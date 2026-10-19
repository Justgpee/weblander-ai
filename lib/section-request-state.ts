import type { EditableSection } from "@/lib/generation";

export type SectionRequestState = Record<EditableSection, { loading: boolean; error: string }>;

export function createEmptySectionRequestState(): SectionRequestState {
  return {
    headline: { loading: false, error: "" },
    description: { loading: false, error: "" },
    features: { loading: false, error: "" },
    callToAction: { loading: false, error: "" },
  };
}
