import type { EditableSection } from "@/lib/generation";
import { createRequestIdentityGuard, settleRequestWithIdentity, type RequestIdentity } from "@/lib/request-identity";

export type SectionRequestTicket = {
  section: EditableSection;
  identity: RequestIdentity;
  revision: number;
};

const SECTIONS: EditableSection[] = ["headline", "description", "features", "callToAction"];

/** Coordinates studio request identities and only finalizes state for current requests. */
export function createStudioRequestCoordinator() {
  const generationGuard = createRequestIdentityGuard();
  const heroImageGuard = createRequestIdentityGuard();
  const sectionGuards = {
    headline: createRequestIdentityGuard(),
    description: createRequestIdentityGuard(),
    features: createRequestIdentityGuard(),
    callToAction: createRequestIdentityGuard(),
  };
  const inFlightSections = new Set<EditableSection>();
  const sectionRevisions: Record<EditableSection, number> = { headline: 0, description: 0, features: 0, callToAction: 0 };
  let projectRevision = 0;
  let generationRevision = 0;
  let briefRevision = 0;
  let heroImageInFlight = false;

  function generationContextKey(projectId: string | null) {
    return `${projectRevision}:${generationRevision}:${projectId ?? "draft"}`;
  }

  function sectionContextKey(projectId: string | null) {
    return `${projectRevision}:${briefRevision}:${projectId ?? "draft"}`;
  }

  function heroImageContextKey(projectId: string | null) {
    return `${projectRevision}:${briefRevision}:${projectId ?? "draft"}`;
  }

  function invalidateGeneration(onInvalidate?: () => void) {
    generationGuard.invalidate();
    onInvalidate?.();
  }

  function invalidateSections(onReset?: () => void) {
    for (const section of SECTIONS) {
      sectionRevisions[section] += 1;
      sectionGuards[section].invalidate();
    }
    inFlightSections.clear();
    onReset?.();
  }

  function invalidateHeroImage(onReset?: () => void) {
    heroImageGuard.invalidate();
    heroImageInFlight = false;
    onReset?.();
  }

  function isSectionRevisionCurrent(ticket: SectionRequestTicket) {
    return sectionRevisions[ticket.section] === ticket.revision;
  }

  return {
    generationContextKey,
    sectionContextKey,
    heroImageContextKey,
    beginGeneration(projectId: string | null) {
      return generationGuard.begin(generationContextKey(projectId));
    },
    isGenerationCurrent(identity: RequestIdentity, context: string) {
      return generationGuard.isCurrent(identity, context);
    },
    beginHeroImage(projectId: string | null): RequestIdentity | null {
      if (heroImageInFlight) return null;
      heroImageInFlight = true;
      return heroImageGuard.begin(heroImageContextKey(projectId));
    },
    isHeroImageCurrent(identity: RequestIdentity, context: string) {
      return heroImageGuard.isCurrent(identity, context);
    },
    async runHeroImage<T>(
      identity: RequestIdentity,
      getContext: () => string,
      request: () => Promise<T>,
      onSuccess: (value: T) => void,
      onFailure: (error: unknown) => void,
      onFinally: () => void,
    ) {
      try {
        await settleRequestWithIdentity(request, heroImageGuard, identity, getContext, onSuccess, onFailure);
      } finally {
        if (heroImageGuard.isCurrent(identity, getContext())) {
          heroImageInFlight = false;
          onFinally();
        }
      }
    },
    invalidateHeroImage,
    async runGeneration<T>(
      identity: RequestIdentity,
      getContext: () => string,
      request: () => Promise<T>,
      onSuccess: (value: T) => void,
      onFailure: (error: unknown) => void,
      onFinally: () => void,
    ) {
      try {
        await settleRequestWithIdentity(request, generationGuard, identity, getContext, onSuccess, onFailure);
      } finally {
        if (generationGuard.isCurrent(identity, getContext())) onFinally();
      }
    },
    beginSection(section: EditableSection, projectId: string | null): SectionRequestTicket | null {
      if (inFlightSections.has(section)) return null;
      inFlightSections.add(section);
      return {
        section,
        identity: sectionGuards[section].begin(sectionContextKey(projectId)),
        revision: sectionRevisions[section],
      };
    },
    isSectionCurrent(ticket: SectionRequestTicket, context: string) {
      return sectionGuards[ticket.section].isCurrent(ticket.identity, context);
    },
    currentSectionRevision(section: EditableSection) {
      return sectionRevisions[section];
    },
    async runSection<T>(
      ticket: SectionRequestTicket,
      getContext: () => string,
      request: () => Promise<T>,
      onSuccess: (value: T) => void,
      onFailure: (error: unknown) => void,
      onFinally: () => void,
    ) {
      const guard = sectionGuards[ticket.section];
      try {
        await settleRequestWithIdentity(
          request,
          guard,
          ticket.identity,
          getContext,
          (value) => {
            if (isSectionRevisionCurrent(ticket)) onSuccess(value);
          },
          onFailure,
        );
      } finally {
        if (guard.isCurrent(ticket.identity, getContext())) {
          inFlightSections.delete(ticket.section);
          onFinally();
        }
      }
    },
    projectTransition(onGenerationInvalidated?: () => void, onSectionsReset?: () => void, onHeroImageReset?: () => void) {
      projectRevision += 1;
      invalidateGeneration(onGenerationInvalidated);
      invalidateSections(onSectionsReset);
      invalidateHeroImage(onHeroImageReset);
    },
    briefChanged(onGenerationInvalidated?: () => void, onSectionsReset?: () => void, onHeroImageReset?: () => void) {
      generationRevision += 1;
      briefRevision += 1;
      invalidateGeneration(onGenerationInvalidated);
      invalidateSections(onSectionsReset);
      invalidateHeroImage(onHeroImageReset);
    },
    layoutChanged(onGenerationInvalidated?: () => void) {
      generationRevision += 1;
      invalidateGeneration(onGenerationInvalidated);
    },
    contentEdited(section: EditableSection, onGenerationInvalidated?: () => void) {
      generationRevision += 1;
      sectionRevisions[section] += 1;
      invalidateGeneration(onGenerationInvalidated);
    },
    pageReplaced(onSectionsReset?: () => void) {
      invalidateSections(onSectionsReset);
    },
    isSectionInFlight(section: EditableSection) {
      return inFlightSections.has(section);
    },
  };
}
