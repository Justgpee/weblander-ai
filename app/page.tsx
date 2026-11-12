"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { EMPTY_BRIEF, GeneratedPageSchema, VisualStyleSchema, type BusinessBrief, type EditableSection, type GeneratedPage } from "@/lib/generation";
import { BriefForm } from "@/components/brief-form";
import { WebsitePreview } from "@/components/website-preview";
import { mergeGeneratedSectionIfUnchanged } from "@/lib/page-editing";
import { ProjectManager } from "@/components/project-manager";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { ExportDialog } from "@/components/export-dialog";
import { requestProjectTransition, resolveProjectTransition, type ProjectTransition } from "@/lib/project-transition";
import {
  ProjectStorageError,
  createProjectStorage,
  ProjectPageSchema,
  ProjectPageContentSchema,
  projectSnapshotFromPages,
  pageFromProject,
  siteTemplateFromProject,
  type ProjectPage,
  type ProjectRecord,
  type ProjectStorage,
} from "@/lib/projects";
import { createMultiPageWebsiteFiles, createWebsiteExport } from "@/lib/website-export";
import { AppearanceSchema, DEFAULT_SITE_SETTINGS, SiteDestinationSchema, SiteSettingsSchema, siteCtaTargetFromLegacy, siteCtaTargetLegacyProjection, validateAppearanceContrast, type Appearance, type SiteCtaTarget, type SiteLogoDisplayMode, type SiteNavigationTarget, type SiteSettings } from "@/lib/site-settings";
import { siteNavigationDestinationOptions, siteNavigationEntryWithTarget } from "@/lib/site-navigation-options";
import { createEmptySectionRequestState, type SectionRequestState } from "@/lib/section-request-state";
import { mergeTemplateSectionIfUnchanged, PageRegenerationSectionSchema, PageSectionContentSchemas, type TemplateRegenerationSection } from "@/lib/page-section-generation";
import { createStudioRequestCoordinator } from "@/lib/studio-request-coordinator";
import { createPageGenerationCoordinator, pageKindLabel, updateProjectPage, type AddablePageKind } from "@/lib/studio-pages";
import { resolveStudioPageSelection } from "@/lib/studio-page-selection";
import { runStudioPageGeneration, runStudioPageRegeneration } from "@/lib/studio-page-generation";
import { createStudioPageDraftStore, studioPageDraftKey } from "@/lib/studio-page-drafts";
import { createStudioNavigationCoordinator, type StudioNavigationTicket } from "@/lib/studio-navigation";
import { PageManagement, type PageGenerationUiState, type PageRegenerationUiState } from "@/components/page-management";
import { HeroImageAssetSchema } from "@/lib/site-image";
import { heroImageForProject, type ProjectHeroImageState } from "@/lib/project-hero-image";
import { completeProjectLogoUpload, getProjectLogoReservationCheckpoint, loadProjectLogo, removeAllProjectLogos, removeProjectLogo, pruneProjectLogos, releasePendingProjectLogoReservations, reserveProjectLogoUpload, siteLogoAssetFromStored, SiteLogoStorageError, storeProjectLogo, validateSiteLogoFile, type SiteLogoAsset } from "@/lib/site-logo";
import { SiteLogoAssetIdSchema } from "@/lib/site-logo";
import { DEFAULT_SITE_TEMPLATE, FashionSiteTemplateSchema, initializeFashionNavigation, initializeRealEstateNavigation, initializeRestaurantNavigation, RealEstateSiteTemplateSchema, RestaurantSiteTemplateSchema, type FashionContent, type RealEstateContent, type RestaurantContent, type SiteTemplate, type SiteTemplateId } from "@/lib/site-templates";

function createEmptyPageGenerationState(): PageGenerationUiState {
  return {
    home: { loading: false, error: "" },
    about: { loading: false, error: "" },
    services: { loading: false, error: "" },
    products: { loading: false, error: "" },
    contact: { loading: false, error: "" },
  };
}

function createEmptyPageRegenerationState(): PageRegenerationUiState {
  return {
    home: { loading: false, error: "" },
    about: { loading: false, error: "" },
    services: { loading: false, error: "" },
    products: { loading: false, error: "" },
    contact: { loading: false, error: "" },
  };
}

export default function Home() {
  const [brief, setBrief] = useState<BusinessBrief>(EMPTY_BRIEF);
  const [page, setPage] = useState<GeneratedPage | null>(null);
  const [layout, setLayout] = useState<GeneratedPage["layout"]>("editorial");
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const siteSettingsRef = useRef(siteSettings);
  const [siteTemplate, setSiteTemplate] = useState<SiteTemplate>(DEFAULT_SITE_TEMPLATE);
  const [projectPages, setProjectPages] = useState<ProjectPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("home");
  const [pageGenerationState, setPageGenerationState] = useState<PageGenerationUiState>(() => createEmptyPageGenerationState());
  const [pageRegenerationState, setPageRegenerationState] = useState<PageRegenerationUiState>(createEmptyPageRegenerationState);
  const [restaurantEditorRevision, setRestaurantEditorRevision] = useState(0);
  const [pageEditorRevisions, setPageEditorRevisions] = useState<Record<string, number>>({});
  const [templateValidityRevision, setTemplateValidityRevision] = useState(0);
  const [templateContentValid, setTemplateContentValid] = useState(true);
  const [projectHeroImage, setProjectHeroImage] = useState<ProjectHeroImageState>({ projectId: null, image: null });
  const [siteLogoAsset, setSiteLogoAsset] = useState<SiteLogoAsset | null>(null);
  const [logoUploadState, setLogoUploadState] = useState({ loading: false, error: "" });
  const [heroImageState, setHeroImageState] = useState({ loading: false, error: "" });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [sectionState, setSectionState] = useState<SectionRequestState>(createEmptySectionRequestState);
  const [templateSectionStates, setTemplateSectionStates] = useState<Record<string, { loading: boolean; error: string }>>({});
  const [requestCoordinator] = useState(createStudioRequestCoordinator);
  const [pageGenerationCoordinator] = useState(createPageGenerationCoordinator);
  const [navigationCoordinator] = useState(createStudioNavigationCoordinator);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const heroImage = heroImageForProject(projectHeroImage, activeProjectId);
  const [activeProjectName, setActiveProjectName] = useState("");
  const [activeProjectRevision, setActiveProjectRevision] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [dirtyRevision, setDirtyRevision] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved" | "error">("idle");
  const [projectStorageError, setProjectStorageError] = useState("");
  const [logoCleanupRetryProjectId, setLogoCleanupRetryProjectId] = useState<string | null>(null);
  const [projectsUnavailable, setProjectsUnavailable] = useState(false);
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [websiteZipState, setWebsiteZipState] = useState({ loading: false, error: "", success: "" });
  const [pendingTransition, setPendingTransition] = useState<ProjectTransition | null>(null);
  const pendingTransitionRef = useRef<ProjectTransition | null>(null);
  const projectStorageRef = useRef<ProjectStorage | null>(null);
  const projectPagesRef = useRef<ProjectPage[]>([]);
  const pageDraftsRef = useRef(createStudioPageDraftStore<GeneratedPage>());
  const activeProjectIdRef = useRef<string | null>(null);
  const draftProjectIdRef = useRef<string | null>(null);
  const draftLogoOwnerIdRef = useRef<string | null>(null);
  const selectedPageIdRef = useRef("home");
  const activeProjectRevisionRef = useRef(0);
  const dirtyRevisionRef = useRef(0);
  const isDirtyRef = useRef(false);
  const saveCurrentProjectRef = useRef<() => boolean>(() => false);
  const templateSectionRevisionsRef = useRef(new Map<string, number>());
  const templateSectionInFlightRef = useRef(new Set<string>());

  function setPages(pages: ProjectPage[]) {
    projectPagesRef.current = pages;
    setProjectPages(pages);
  }

  function updateSiteSettings(update: SiteSettings | ((current: SiteSettings) => SiteSettings)) {
    const next = typeof update === "function" ? update(siteSettingsRef.current) : update;
    siteSettingsRef.current = next;
    setSiteSettings(next);
  }

  function templateSectionKey(projectId: string | null, pageId: string, section: TemplateRegenerationSection) {
    return `${projectId ?? "draft"}:${pageId}:${section}`;
  }

  function setTemplateSectionState(projectId: string | null, pageId: string, section: TemplateRegenerationSection, next: { loading: boolean; error: string }) {
    const key = templateSectionKey(projectId, pageId, section);
    setTemplateSectionStates((current) => ({ ...current, [key]: next }));
  }

  const currentPagesForSnapshot = useCallback((): ProjectPage[] => {
    if (!page) throw new Error("A website page is required before saving.");
    const pages = projectPagesRef.current;
    const current = pages.find((record) => record.id === selectedPageId);
    if (!current && selectedPageId !== "home") throw new Error("The selected page is no longer available.");
    const content = ProjectPageContentSchema.parse({
      headline: page.headline,
      description: page.subheadline,
      features: page.features,
      callToAction: page.callToAction,
    });
    const edited = ProjectPageSchema.parse({
      ...(current ?? { id: "home", slug: "index", title: "Home", kind: "home" }),
      content,
      template: templateContentValid ? siteTemplate : current?.template ?? siteTemplate,
    });
    if (!current) return [edited];
    return pages.map((record) => record.id === selectedPageId ? edited : record);
  }, [page, selectedPageId, siteTemplate, templateContentValid]);

  const allPageDraftsValid = useCallback(() => {
    return pageDraftsRef.current.areAllDraftsValid((draft) => ProjectPageContentSchema.safeParse({ headline: draft.headline, description: draft.subheadline, features: draft.features, callToAction: draft.callToAction }).success);
  }, []);

  function invalidatePageGenerationForContextChange() {
    pageGenerationCoordinator.invalidateForContextChange();
    setPageGenerationState(createEmptyPageGenerationState());
    setPageRegenerationState(createEmptyPageRegenerationState());
  }

  function generationContextKey() {
    return requestCoordinator.generationContextKey(activeProjectIdRef.current);
  }

  function sectionContextKey() {
    return requestCoordinator.sectionContextKey(activeProjectIdRef.current);
  }

  function heroImageContextKey() {
    return requestCoordinator.heroImageContextKey(activeProjectIdRef.current);
  }

  const getProjectStorage = useCallback(() => {
    if (!projectStorageRef.current) {
      try {
        projectStorageRef.current = createProjectStorage({ storage: window.localStorage });
      } catch {
        throw new ProjectStorageError("UNAVAILABLE");
      }
    }
    return projectStorageRef.current;
  }, []);

  const safeStorageMessage = useCallback((error: unknown) => {
    return error instanceof ProjectStorageError ? error.message : "Project storage is unavailable in this browser.";
  }, []);

  const safeLogoStorageMessage = useCallback((error: unknown) => {
    return error instanceof SiteLogoStorageError ? error.message : "Logo storage could not complete the request. Please try again.";
  }, []);

  const cleanupSavedProjectLogos = useCallback(async (projectId: string, checkpoint = Number.POSITIVE_INFINITY) => {
    const latestSavedLogoId = () => getProjectStorage().load(projectId).siteSettings.branding.logoAssetId;
    await pruneProjectLogos(projectId, latestSavedLogoId);
    releasePendingProjectLogoReservations(projectId, checkpoint);
    await pruneProjectLogos(projectId, latestSavedLogoId);
  }, [getProjectStorage]);

  const scheduleSavedProjectLogoCleanup = useCallback((projectId: string, checkpoint = Number.POSITIVE_INFINITY) => {
    void cleanupSavedProjectLogos(projectId, checkpoint).catch((error) => {
      setProjectStorageError(`The project was saved, but unused logo files could not be cleaned up. ${safeLogoStorageMessage(error)}`);
    });
  }, [cleanupSavedProjectLogos, safeLogoStorageMessage]);

  async function retryDeletedProjectLogoCleanup() {
    const projectId = logoCleanupRetryProjectId;
    if (!projectId) return;
    try {
      await removeAllProjectLogos(projectId);
      setLogoCleanupRetryProjectId(null);
      setProjectStorageError("");
    } catch (error) {
      setProjectStorageError(`Logo cleanup is still incomplete. ${safeLogoStorageMessage(error)}`);
    }
  }

  function scheduleDraftLogoCleanup(projectId: string) {
    void removeAllProjectLogos(projectId).catch((error) => {
      setLogoCleanupRetryProjectId(projectId);
      setProjectStorageError(`Temporary logo files could not be cleaned up. ${safeLogoStorageMessage(error)}`);
    });
  }

  const refreshProjects = useCallback(() => {
    try {
      setProjects(getProjectStorage().list());
      setProjectStorageError("");
      setProjectsUnavailable(false);
      return true;
    } catch (error) {
      setProjectStorageError(safeStorageMessage(error));
      setProjectsUnavailable(true);
      return false;
    }
  }, [getProjectStorage, safeStorageMessage]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const activeLogoAssetId = siteSettings.branding.logoAssetId;
  useEffect(() => {
    if (!activeProjectId) {
      if (!draftLogoOwnerIdRef.current) setSiteLogoAsset(null);
      return;
    }
    if (!activeLogoAssetId) {
      return;
    }
    let cancelled = false;
    void loadProjectLogo(activeProjectId, activeLogoAssetId)
      .then((record) => record ? siteLogoAssetFromStored(record) : null)
      .then((asset) => {
        if (cancelled) return;
        setSiteLogoAsset(asset);
        setLogoUploadState({ loading: false, error: asset ? "" : "The saved logo is unavailable. Text branding will be shown instead." });
      })
      .catch(() => {
        if (cancelled) return;
        setSiteLogoAsset(null);
        setLogoUploadState({ loading: false, error: "The saved logo could not be read. Text branding will be shown instead." });
      });
    return () => { cancelled = true; };
  }, [activeProjectId, activeLogoAssetId]);

  function advanceDirtyRevision() {
    const next = dirtyRevisionRef.current + 1;
    dirtyRevisionRef.current = next;
    setDirtyRevision(next);
  }

  function markDirty() {
    advanceDirtyRevision();
    isDirtyRef.current = true;
    setIsDirty(true);
    setSaveStatus("unsaved");
  }

  function markClean() {
    isDirtyRef.current = false;
    setIsDirty(false);
  }

  function setPendingProjectTransition(transition: ProjectTransition | null) {
    pendingTransitionRef.current = transition;
    setPendingTransition(transition);
  }

  function invalidateSectionResponses() {
    requestCoordinator.pageReplaced(() => setSectionState(createEmptySectionRequestState()));
  }

  function clearActiveProjectToDraft(deletedProjectId?: string) {
    const previousProjectId = activeProjectIdRef.current;
    if (previousProjectId && previousProjectId !== deletedProjectId) {
      releasePendingProjectLogoReservations(previousProjectId);
      scheduleSavedProjectLogoCleanup(previousProjectId);
    }
    const draftLogoOwnerId = draftLogoOwnerIdRef.current;
    draftLogoOwnerIdRef.current = null;
    draftProjectIdRef.current = null;
    if (draftLogoOwnerId) void removeAllProjectLogos(draftLogoOwnerId).catch((error) => {
      setLogoCleanupRetryProjectId(draftLogoOwnerId);
      setProjectStorageError(`Temporary logo files could not be cleaned up. ${safeLogoStorageMessage(error)}`);
    });
    setSiteLogoAsset(null);
    setLogoUploadState({ loading: false, error: "" });
    navigationCoordinator.invalidate();
    pageGenerationCoordinator.invalidateForProjectTransition();
    setPageGenerationState(createEmptyPageGenerationState());
    setPageRegenerationState(createEmptyPageRegenerationState());
    pageDraftsRef.current.clear();
    setPageEditorRevisions({});
    setTemplateValidityRevision((revision) => revision + 1);
    requestCoordinator.projectTransition(
      () => setLoading(false),
      () => setSectionState(createEmptySectionRequestState()),
      () => setHeroImageState({ loading: false, error: "" }),
    );
    advanceDirtyRevision();
    activeProjectIdRef.current = null;
    activeProjectRevisionRef.current = 0;
    setActiveProjectId(null);
    setActiveProjectName("");
    setActiveProjectRevision(0);
    setBrief(EMPTY_BRIEF);
    setPage(null);
    setPages([]);
    selectedPageIdRef.current = "home";
    setSelectedPageId("home");
    setLayout("editorial");
    updateSiteSettings(DEFAULT_SITE_SETTINGS);
    setSiteTemplate(DEFAULT_SITE_TEMPLATE);
    setRestaurantEditorRevision((revision) => revision + 1);
    setTemplateContentValid(true);
    setProjectHeroImage({ projectId: null, image: null });
    markClean();
    setSaveStatus("idle");
    setNotice("");
    setProjectStorageError("");
  }

  function applyProject(project: ProjectRecord) {
    const previousProjectId = activeProjectIdRef.current;
    if (previousProjectId && previousProjectId !== project.id) {
      releasePendingProjectLogoReservations(previousProjectId);
      scheduleSavedProjectLogoCleanup(previousProjectId);
    }
    const draftLogoOwnerId = draftLogoOwnerIdRef.current;
    draftLogoOwnerIdRef.current = null;
    draftProjectIdRef.current = null;
    if (draftLogoOwnerId) void removeAllProjectLogos(draftLogoOwnerId).catch((error) => {
      setLogoCleanupRetryProjectId(draftLogoOwnerId);
      setProjectStorageError(`Temporary logo files could not be cleaned up. ${safeLogoStorageMessage(error)}`);
    });
    setSiteLogoAsset(null);
    setLogoUploadState({ loading: false, error: "" });
    navigationCoordinator.invalidate();
    pageGenerationCoordinator.invalidateForProjectTransition();
    setPageGenerationState(createEmptyPageGenerationState());
    setPageRegenerationState(createEmptyPageRegenerationState());
    pageDraftsRef.current.clear();
    setPageEditorRevisions({});
    setTemplateValidityRevision((revision) => revision + 1);
    requestCoordinator.projectTransition(
      () => setLoading(false),
      () => setSectionState(createEmptySectionRequestState()),
      () => setHeroImageState({ loading: false, error: "" }),
    );
    advanceDirtyRevision();
    activeProjectIdRef.current = project.id;
    activeProjectRevisionRef.current = project.revision;
    setActiveProjectId(project.id);
    setActiveProjectName(project.name);
    setActiveProjectRevision(project.revision);
    setBrief(project.brief);
    setPage(pageFromProject(project));
    setPages(project.pages);
    selectedPageIdRef.current = "home";
    setSelectedPageId("home");
    setLayout(project.layout);
    const savedSettings = SiteSettingsSchema.parse(project.siteSettings);
    const savedTemplate = siteTemplateFromProject(project);
    updateSiteSettings(savedTemplate.id === "restaurant"
      ? initializeRestaurantNavigation(savedSettings, savedTemplate.content)
      : savedTemplate.id === "fashion"
        ? initializeFashionNavigation(savedSettings, savedTemplate.content)
        : savedTemplate.id === "real-estate"
          ? initializeRealEstateNavigation(savedSettings, savedTemplate.content)
          : savedSettings);
    setSiteTemplate(savedTemplate);
    setRestaurantEditorRevision((revision) => revision + 1);
    setTemplateContentValid(true);
    setProjectHeroImage({ projectId: project.id, image: HeroImageAssetSchema.parse(project.heroImage) });
    markClean();
    setSaveStatus("saved");
    setNotice("");
    setProjectStorageError("");
    setProjectManagerOpen(false);
  }

  function selectStudioPage(pageId: string, navigationTicket?: StudioNavigationTicket) {
    if (navigationTicket) {
      if (!navigationCoordinator.isCurrent(navigationTicket, activeProjectIdRef.current, pageId)) return;
    } else {
      navigationCoordinator.invalidate();
    }
    const currentPageId = selectedPageIdRef.current;
    const current = projectPagesRef.current.find((record) => record.id === currentPageId);
    if (!current || !page) return;
    const currentDraftKey = studioPageDraftKey(activeProjectIdRef.current, current.id);
    const targetDraftKey = studioPageDraftKey(activeProjectIdRef.current, pageId);
    pageDraftsRef.current.setDraft(currentDraftKey, page);
    const selection = resolveStudioPageSelection({
      pages: projectPagesRef.current,
      currentPageId,
      targetPageId: pageId,
      currentPage: page,
      currentTemplate: siteTemplate,
      currentTemplateValid: templateContentValid,
      targetDraft: pageDraftsRef.current.getDraft(targetDraftKey),
      targetTemplateValid: pageDraftsRef.current.isTemplateValid(targetDraftKey),
      brief,
      layout,
    });
    if (!selection) return;
    requestCoordinator.pageSelected(
      () => setLoading(false),
      () => setSectionState(createEmptySectionRequestState()),
    );
    setPages(selection.pages);
    selectedPageIdRef.current = pageId;
    setSelectedPageId(pageId);
    setPage(selection.page);
    setSiteTemplate(selection.template);
    setTemplateContentValid(selection.templateValid);
    setNotice("");
    if (navigationTicket?.anchor) scheduleStudioAnchorScroll(navigationTicket);
    else if (navigationTicket) navigationCoordinator.finish(navigationTicket);
  }

  function scheduleStudioAnchorScroll(ticket: StudioNavigationTicket) {
    let attempts = 0;
    const tryScroll = () => window.requestAnimationFrame(() => {
      if (!navigationCoordinator.isCurrent(ticket, activeProjectIdRef.current, selectedPageIdRef.current)) return;
      const root = Array.from(document.querySelectorAll<HTMLElement>("[data-site-preview-page]")).find((candidate) => candidate.dataset.sitePreviewPage === ticket.pageId);
      const target = root && Array.from(root.querySelectorAll<HTMLElement>("[id]")).find((element) => `#${element.id}` === ticket.anchor);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        navigationCoordinator.finish(ticket);
        return;
      }
      if (attempts++ < 5) tryScroll();
      else navigationCoordinator.finish(ticket);
    });
    tryScroll();
  }

  function navigatePreview(pageId: string, anchor?: string) {
    const destinationPage = projectPagesRef.current.find((candidate) => candidate.id === pageId);
    if (!destinationPage) return;
    if (anchor && !siteNavigationDestinationOptions(destinationPage.template, destinationPage.kind).some((option) => option.destination === anchor)) return;
    const ticket = navigationCoordinator.begin(activeProjectIdRef.current, pageId, anchor);
    if (pageId === selectedPageIdRef.current) {
      if (anchor) scheduleStudioAnchorScroll(ticket);
      else navigationCoordinator.finish(ticket);
      return;
    }
    selectStudioPage(pageId, ticket);
  }

  async function performTransition(transition: ProjectTransition): Promise<void> {
    if (transition.type === "new") {
      clearActiveProjectToDraft();
      setProjectManagerOpen(false);
      return;
    }
    if (transition.type === "delete") {
      try {
        const project = getProjectStorage().load(transition.id);
        getProjectStorage().remove(project.id, project.revision);
        refreshProjects();
        if (project.id === activeProjectIdRef.current) clearActiveProjectToDraft(project.id);
        setProjectStorageError("");
        try {
          await removeAllProjectLogos(project.id);
          setLogoCleanupRetryProjectId(null);
        } catch (error) {
          setLogoCleanupRetryProjectId(project.id);
          setProjectStorageError(`The project was deleted, but its logo cleanup is incomplete. ${safeLogoStorageMessage(error)}`);
        }
      } catch (error) {
        setProjectStorageError(safeStorageMessage(error));
      }
      return;
    }
    try {
      applyProject(getProjectStorage().load(transition.id));
      refreshProjects();
    } catch (error) {
      setProjectStorageError(safeStorageMessage(error));
    }
  }

  function requestTransition(transition: ProjectTransition) {
    setProjectManagerOpen(false);
    const request = requestProjectTransition(isDirtyRef.current, transition);
    if (request.kind === "confirm") {
      setPendingProjectTransition(request.transition);
      return;
    }
    void performTransition(request.transition);
  }

  function createAndActivateProject(name: string, snapshot: ReturnType<typeof projectSnapshotFromPages>, heroImageForSave: ReturnType<typeof heroImageForProject>) {
    const requestedId = draftProjectIdRef.current ?? draftLogoOwnerIdRef.current ?? globalThis.crypto.randomUUID();
    draftProjectIdRef.current = requestedId;
    const logoOwnerId = draftLogoOwnerIdRef.current;
    if (logoOwnerId && logoOwnerId !== requestedId) throw new ProjectStorageError("FAILED");
    const logoCheckpoint = logoOwnerId ? getProjectLogoReservationCheckpoint(logoOwnerId) : 0;
    const saved = getProjectStorage().create(name, snapshot, requestedId);
    draftLogoOwnerIdRef.current = null;
    draftProjectIdRef.current = null;
    pageGenerationCoordinator.invalidateForProjectTransition();
    setPageGenerationState(createEmptyPageGenerationState());
    setPageRegenerationState(createEmptyPageRegenerationState());
    requestCoordinator.projectTransition(
      () => setLoading(false),
      () => setSectionState(createEmptySectionRequestState()),
      () => setHeroImageState({ loading: false, error: "" }),
    );
    setProjectHeroImage({ projectId: saved.id, image: heroImageForSave });
    activeProjectIdRef.current = saved.id;
    activeProjectRevisionRef.current = saved.revision;
    setActiveProjectId(saved.id);
    setActiveProjectName(saved.name);
    setActiveProjectRevision(saved.revision);
    scheduleSavedProjectLogoCleanup(saved.id, logoCheckpoint);
    markClean();
    setSaveStatus("saved");
    setProjectStorageError("");
    setProjectsUnavailable(false);
    refreshProjects();
    return true;
  }

  function saveCurrentProject() {
    if (logoUploadState.loading) {
      setProjectStorageError("Wait for the logo upload to finish before saving the project.");
      return false;
    }
    if (!templateContentValid || !allPageDraftsValid()) {
      setSaveStatus("error");
      setProjectStorageError("Correct all page content fields before saving this project. Invalid drafts remain available on their pages.");
      return false;
    }
    if (!page) {
      setProjectStorageError("Generate a website before saving a project.");
      return false;
    }
    try {
      const contrast = validateAppearanceContrast(brief.style, siteSettings.appearance);
      if (!contrast.valid) {
        setSaveStatus("error");
        setProjectStorageError(contrast.issues.join(" "));
        return false;
      }
      const snapshot = projectSnapshotFromPages(brief, currentPagesForSnapshot(), layout, siteSettings, heroImageForProject(projectHeroImage, activeProjectIdRef.current));
      const storage = getProjectStorage();
      const creatingProject = activeProjectIdRef.current === null;
      if (creatingProject) {
        return createAndActivateProject(brief.businessName, snapshot, heroImageForProject(projectHeroImage, null));
      }
      const saved = storage.save(activeProjectIdRef.current!, snapshot, activeProjectRevisionRef.current);
      activeProjectIdRef.current = saved.id;
      activeProjectRevisionRef.current = saved.revision;
      setActiveProjectId(saved.id);
      setActiveProjectName(saved.name);
      setActiveProjectRevision(saved.revision);
      scheduleSavedProjectLogoCleanup(saved.id);
      markClean();
      setSaveStatus("saved");
      setProjectStorageError("");
      setProjectsUnavailable(false);
      refreshProjects();
      return true;
    } catch (error) {
      setSaveStatus("error");
      setProjectStorageError(safeStorageMessage(error));
      return false;
    }
  }

  saveCurrentProjectRef.current = saveCurrentProject;
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current || saveCurrentProjectRef.current()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handlePageHide = () => {
      if (isDirtyRef.current) saveCurrentProjectRef.current();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isDirty]);

  async function continueAfterSave() {
    const transition = pendingTransitionRef.current;
    if (!transition || !(await resolveProjectTransition("save", saveCurrentProject))) return;
    setPendingProjectTransition(null);
    void performTransition(transition);
  }

  function continueAfterDiscard() {
    const transition = pendingTransitionRef.current;
    if (!transition) return;
    void resolveProjectTransition("discard", saveCurrentProject).then((canProceed) => {
      if (!canProceed) return;
      if (pendingTransitionRef.current !== transition) return;
      setPendingProjectTransition(null);
      void performTransition(transition);
    });
  }

  function keepEditing() {
    void resolveProjectTransition("keep", saveCurrentProject);
    setPendingProjectTransition(null);
  }

  function showProjectManager() {
    refreshProjects();
    setProjectManagerOpen(true);
  }

  function renameProject(project: ProjectRecord, name: string) {
    try {
      let expectedRevision = project.revision;
      if (project.id === activeProjectIdRef.current) {
        if (isDirtyRef.current && !saveCurrentProject()) return false;
        expectedRevision = activeProjectRevisionRef.current;
      }
      const updated = getProjectStorage().rename(project.id, name, expectedRevision);
      if (project.id === activeProjectIdRef.current) {
        activeProjectRevisionRef.current = updated.revision;
        setActiveProjectName(updated.name);
        setActiveProjectRevision(updated.revision);
      }
      refreshProjects();
      setProjectStorageError("");
      return true;
    } catch (error) {
      setProjectStorageError(safeStorageMessage(error));
      return false;
    }
  }

  function deleteProject(project: ProjectRecord) {
    if (project.id === activeProjectIdRef.current && isDirtyRef.current) {
      requestTransition({ type: "delete", id: project.id });
      return;
    }
    void performTransition({ type: "delete", id: project.id });
  }

  function confirmNewProject() {
    requestTransition({ type: "new" });
  }

  function confirmOpenProject(id: string) {
    requestTransition({ type: "open", id });
  }

  async function currentSiteLogoForExport(): Promise<SiteLogoAsset | null> {
    const assetId = SiteLogoAssetIdSchema.safeParse(siteSettings.branding.logoAssetId);
    const ownerId = activeProjectIdRef.current ?? draftLogoOwnerIdRef.current;
    if (!assetId.success || !ownerId) return null;
    try {
      const stored = await loadProjectLogo(ownerId, assetId.data);
      if (!stored) {
        setLogoUploadState({ loading: false, error: "The saved logo is unavailable. This export will use text branding." });
        return null;
      }
      return await siteLogoAssetFromStored(stored);
    } catch {
      setLogoUploadState({ loading: false, error: "The saved logo could not be read. This export will use text branding." });
      return null;
    }
  }

  async function downloadWebsite(destination: string) {
    if (!page) return;
    if (!templateContentValid) {
      setProjectStorageError("Correct the template content fields before exporting this website.");
      return;
    }
    const settings = SiteSettingsSchema.parse({
      ...siteSettings,
      ctaDestination: destination,
      ctaTarget: siteCtaTargetFromLegacy(destination),
    });
    const logoForExport = await currentSiteLogoForExport();
    const exported = createWebsiteExport(page, layout, settings, heroImageForProject(projectHeroImage, activeProjectIdRef.current), siteTemplate, {
      currentPageId: selectedPageIdRef.current,
      pageKind: projectPagesRef.current.find((record) => record.id === selectedPageIdRef.current)?.kind ?? "home",
      pages: projectPagesRef.current,
    }, logoForExport);
    const blob = new Blob([exported.html], { type: "text/html;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = exported.filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  async function downloadCompleteWebsite() {
    if (!page || websiteZipState.loading) return;
    setWebsiteZipState({ loading: true, error: "", success: "" });
    try {
      if (!allPageDraftsValid() || !templateContentValid) throw new Error("Correct all page and template drafts before exporting the complete website.");
      const basePages = currentPagesForSnapshot();
      const pagesWithDrafts = basePages.map((record) => {
        const draft = pageDraftsRef.current.getDraft(studioPageDraftKey(activeProjectIdRef.current, record.id));
        if (!draft) return record;
        const content = ProjectPageContentSchema.parse({ headline: draft.headline, description: draft.subheadline, features: draft.features, callToAction: draft.callToAction });
        return ProjectPageSchema.parse({ ...record, content });
      });
      const snapshot = projectSnapshotFromPages(brief, pagesWithDrafts, layout, siteSettings, heroImageForProject(projectHeroImage, activeProjectIdRef.current));
      const logoForExport = await currentSiteLogoForExport();
      const files = createMultiPageWebsiteFiles(snapshot, logoForExport);
      const { createWebsiteZipBlob, downloadWebsiteZip } = await import("@/lib/website-zip");
      const blob = await createWebsiteZipBlob(files);
      downloadWebsiteZip(blob, "weblander-website.zip");
      setWebsiteZipState({ loading: false, error: "", success: "Complete website ZIP is ready." });
    } catch (error) {
      setWebsiteZipState({ loading: false, error: error instanceof Error ? error.message : "The complete website could not be exported.", success: "" });
    }
  }

  useEffect(() => {
    if (!activeProjectId || !isDirty || !page || pendingTransition || logoUploadState.loading || !templateContentValid || !allPageDraftsValid()) return;
    const projectId = activeProjectId;
    const expectedRevision = activeProjectRevision;
    const version = dirtyRevision;
    const timer = window.setTimeout(() => {
      if (pendingTransitionRef.current || activeProjectIdRef.current !== projectId || dirtyRevisionRef.current !== version || activeProjectRevisionRef.current !== expectedRevision) return;
      setSaveStatus("saving");
      try {
        const contrast = validateAppearanceContrast(brief.style, siteSettings.appearance);
        if (!contrast.valid) {
          setSaveStatus("error");
          setProjectStorageError(contrast.issues.join(" "));
          return;
        }
       const snapshot = projectSnapshotFromPages(brief, currentPagesForSnapshot(), layout, siteSettings, heroImageForProject(projectHeroImage, projectId));
        const logoCheckpoint = getProjectLogoReservationCheckpoint(projectId);
        const saved = getProjectStorage().save(projectId, snapshot, expectedRevision);
        scheduleSavedProjectLogoCleanup(projectId, logoCheckpoint);
        if (dirtyRevisionRef.current !== version || activeProjectIdRef.current !== projectId) return;
        activeProjectRevisionRef.current = saved.revision;
        setActiveProjectRevision(saved.revision);
        markClean();
        setSaveStatus("saved");
        setProjectStorageError("");
        setProjectsUnavailable(false);
        refreshProjects();
      } catch (error) {
        if (dirtyRevisionRef.current !== version || activeProjectIdRef.current !== projectId) return;
        setSaveStatus("error");
        setProjectStorageError(safeStorageMessage(error));
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [activeProjectId, activeProjectRevision, allPageDraftsValid, brief, currentPagesForSnapshot, dirtyRevision, getProjectStorage, isDirty, layout, logoUploadState.loading, page, pendingTransition, projectHeroImage, projectPages, refreshProjects, safeStorageMessage, scheduleSavedProjectLogoCleanup, siteSettings, siteTemplate, templateContentValid, templateValidityRevision]);

  function updateBrief<K extends keyof BusinessBrief>(key: K, value: BusinessBrief[K]) {
    invalidatePageGenerationForContextChange();
    requestCoordinator.briefChanged(
      () => setLoading(false),
      () => setSectionState(createEmptySectionRequestState()),
      () => setHeroImageState({ loading: false, error: "" }),
    );
    setBrief((current) => ({ ...current, [key]: value }));
    if (key === "style") {
      const style = VisualStyleSchema.parse(value);
      setPage((current) => current ? { ...current, style } : current);
    }
    markDirty();
  }

  function updateAppearance(appearance: Appearance) {
    const validatedAppearance = AppearanceSchema.parse(appearance);
    updateSiteSettings((current) => ({ ...current, appearance: validatedAppearance }));
    markDirty();
  }

  async function submit(event: FormEvent<HTMLFormElement>, templateId: SiteTemplateId = "generic") {
    event.preventDefault();
    if (selectedPageId !== "home") {
      setNotice("Select Home to generate or replace the home page.");
      return;
    }
    if (!templateContentValid) {
      setNotice("Correct the template content fields before generating another page.");
      return;
    }
    if (loading) return;
    const projectId = activeProjectIdRef.current;
    const requestBrief = brief;
    const requestLayout = layout;
    invalidatePageGenerationForContextChange();
    const identity = requestCoordinator.beginGeneration(projectId);
    setNotice("");
    setLoading(true);
    const isCurrent = () => requestCoordinator.isGenerationCurrent(identity, generationContextKey()) && activeProjectIdRef.current === projectId;
    await requestCoordinator.runGeneration(identity, generationContextKey, async () => {
      const endpoint = templateId === "restaurant" ? "/api/generate-template"
        : templateId === "fashion" ? "/api/generate-fashion"
          : templateId === "real-estate" ? "/api/generate-real-estate"
          : "/api/generate";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateId === "generic" ? requestBrief : { templateId, brief: requestBrief }),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null || !("data" in result)) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "object" && result.error !== null && "message" in result.error && typeof result.error.message === "string"
          ? result.error.message
          : "We couldn’t generate your page right now. Please try again.";
        throw new Error(message);
      }
      if (templateId === "restaurant") {
        const data = result.data;
        if (typeof data !== "object" || data === null || !("page" in data) || !("template" in data)) {
          throw new Error("The generation service returned invalid restaurant content. Please try again.");
        }
        const generatedPage = GeneratedPageSchema.safeParse(data.page);
        const generatedTemplate = RestaurantSiteTemplateSchema.safeParse(data.template);
        if (!generatedPage.success || !generatedTemplate.success) throw new Error("The generation service returned invalid restaurant content. Please try again.");
        return { page: generatedPage.data, template: generatedTemplate.data };
      }
      if (templateId === "fashion") {
        const data = result.data;
        if (typeof data !== "object" || data === null || !("page" in data) || !("template" in data)) {
          throw new Error("The generation service returned invalid fashion content. Please try again.");
        }
        const generatedPage = GeneratedPageSchema.safeParse(data.page);
        const generatedTemplate = FashionSiteTemplateSchema.safeParse(data.template);
        if (!generatedPage.success || !generatedTemplate.success) throw new Error("The generation service returned invalid fashion content. Please try again.");
        return { page: generatedPage.data, template: generatedTemplate.data };
      }
      if (templateId === "real-estate") {
        const data = result.data;
        if (typeof data !== "object" || data === null || !("page" in data) || !("template" in data)) {
          throw new Error("The generation service returned invalid Real Estate content. Please try again.");
        }
        const generatedPage = GeneratedPageSchema.safeParse(data.page);
        const generatedTemplate = RealEstateSiteTemplateSchema.safeParse(data.template);
        if (!generatedPage.success || !generatedTemplate.success) throw new Error("The generation service returned invalid Real Estate content. Please try again.");
        return { page: generatedPage.data, template: generatedTemplate.data };
      }
      const generatedPage = GeneratedPageSchema.safeParse(result.data);
      if (!generatedPage.success) throw new Error("The generation service returned an invalid page. Please try again.");
      return { page: generatedPage.data, template: DEFAULT_SITE_TEMPLATE };
    }, (generated) => {
      if (!isCurrent()) return;
      invalidateSectionResponses();
      const home = ProjectPageSchema.parse({
        id: "home",
        slug: "index",
        title: "Home",
        kind: "home",
        content: {
          headline: generated.page.headline,
          description: generated.page.subheadline,
          features: generated.page.features,
          callToAction: generated.page.callToAction,
        },
        template: generated.template,
      });
      const existingPages = projectPagesRef.current;
      const pagesAfterGeneration = existingPages.some((record) => record.id === "home")
        ? existingPages.map((record) => record.id === "home" ? home : record)
        : [home, ...existingPages];
      setPages(pagesAfterGeneration);
      const homeDraftKey = studioPageDraftKey(activeProjectIdRef.current, "home");
      pageDraftsRef.current.deleteDraft(homeDraftKey);
      pageDraftsRef.current.deleteTemplateValidity(homeDraftKey);
      setTemplateValidityRevision((revision) => revision + 1);
      setPageEditorRevisions((current) => ({ ...current, home: (current.home ?? 0) + 1 }));
      selectedPageIdRef.current = "home";
      setSelectedPageId("home");
      setPage((current) => isCurrent() ? { ...generated.page, layout: requestLayout } : current);
      setSiteTemplate(generated.template);
      setTemplateContentValid(true);
      let generatedSettings = siteSettingsRef.current;
      if (generated.template.id === "restaurant") {
        const restaurantContent = generated.template.content;
        generatedSettings = initializeRestaurantNavigation(generatedSettings, restaurantContent);
      } else if (generated.template.id === "fashion") {
        const fashionContent = generated.template.content;
        generatedSettings = initializeFashionNavigation(generatedSettings, fashionContent);
      } else if (generated.template.id === "real-estate") {
        const realEstateContent = generated.template.content;
        generatedSettings = initializeRealEstateNavigation(generatedSettings, realEstateContent);
      }
      updateSiteSettings(generatedSettings);
      markDirty();
      if (activeProjectIdRef.current === null) {
        try {
          const snapshot = projectSnapshotFromPages(
            requestBrief,
            pagesAfterGeneration,
            requestLayout,
            generatedSettings,
            heroImageForProject(projectHeroImage, null),
          );
          const contrast = validateAppearanceContrast(requestBrief.style, generatedSettings.appearance);
          if (!contrast.valid) {
            setSaveStatus("error");
            setProjectStorageError(contrast.issues.join(" "));
          } else {
            createAndActivateProject(requestBrief.businessName, snapshot, heroImageForProject(projectHeroImage, null));
          }
        } catch (error) {
          setSaveStatus("error");
          setProjectStorageError(safeStorageMessage(error));
        }
      }
      setNotice("Your landing page is ready.");
    }, (error) => {
      if (!isCurrent()) return;
      const safeMessages = [
        "The generation service returned an invalid page. Please try again.",
        "We couldn’t generate your page right now. Please try again.",
        "Check that all fields are filled in and within their allowed lengths.",
        "Generation is not configured on this server.",
        "The request could not be generated. Please revise the business brief and try again.",
        "The generation service returned unusable content. Please try again.",
        "The generation service returned unusable restaurant content. Please try again.",
        "The generation service returned invalid restaurant content. Please try again.",
        "Check the restaurant template and business brief.",
        "We couldn’t generate your restaurant page right now. Please try again.",
        "The generation service returned invalid fashion content. Please try again.",
        "The generation service returned unusable fashion content. Please try again.",
        "Check the fashion template and business brief.",
        "We couldn’t generate your fashion page right now. Please try again.",
        "The generation service returned invalid Real Estate content. Please try again.",
        "The generation service returned unusable Real Estate content. Please try again.",
        "Check the Real Estate template and business brief.",
        "We couldn’t generate your Real Estate page right now. Please try again.",
      ];
      setNotice(error instanceof Error && safeMessages.includes(error.message)
        ? error.message
        : "Couldn’t connect to the generation service. Check your connection and try again.");
    }, () => setLoading(false));
  }

  async function generateAdditionalPage(kind: AddablePageKind) {
    const projectId = activeProjectIdRef.current;
    const ticket = pageGenerationCoordinator.begin(projectId, kind);
    if (!ticket) return;
    const isCurrent = () => pageGenerationCoordinator.isCurrent(ticket, activeProjectIdRef.current);
    setPageGenerationState((current) => ({ ...current, [kind]: { loading: true, error: "" } }));
    try {
      const result = await runStudioPageGeneration({
        kind,
        brief,
        template: siteTemplate,
        ticket,
        coordinator: pageGenerationCoordinator,
        getActiveProjectId: () => activeProjectIdRef.current,
        getPages: () => projectPagesRef.current,
        setPages,
      });
      if (!isCurrent()) return;
      if (result.status === "added") {
        markDirty();
        setNotice(`${pageKindLabel(kind, siteTemplate.id)} page added.`);
      } else if (result.status === "failed") {
        setPageGenerationState((current) => ({ ...current, [kind]: { loading: true, error: result.message ?? "We couldn’t generate this page right now. Please try again." } }));
      }
    } catch (error) {
      if (!isCurrent()) return;
      const safeError = error instanceof Error && [
        "This page type is not available for the current template.",
        "The generation service returned invalid page content. Please try again.",
        "This page already exists or cannot be added to this project.",
      ].includes(error.message) ? error.message : "We couldn’t generate this page right now. Please try again.";
      setPageGenerationState((current) => ({
        ...current,
        [kind]: {
          loading: true,
          error: safeError,
        },
      }));
    } finally {
      const wasCurrent = isCurrent();
      pageGenerationCoordinator.finish(ticket);
      if (wasCurrent) setPageGenerationState((current) => ({ ...current, [kind]: { ...current[kind], loading: false } }));
    }
  }

  async function regenerateStudioPage(pageId: string) {
    if (loading || Object.values(sectionState).some((state) => state.loading)) return;
    const target = projectPagesRef.current.find((record) => record.id === pageId);
    if (!target || target.kind === "legacy") return;
    const draftKey = studioPageDraftKey(activeProjectIdRef.current, target.id);
    const copyDraft = pageDraftsRef.current.getDraft(draftKey);
    if ((copyDraft && !ProjectPageContentSchema.safeParse({ headline: copyDraft.headline, description: copyDraft.subheadline, features: copyDraft.features, callToAction: copyDraft.callToAction }).success)
      || !pageDraftsRef.current.isTemplateValid(draftKey)) {
      setPageRegenerationState((current) => ({ ...current, [pageId]: { loading: false, error: "Correct this page’s invalid edits before regenerating it." } }));
      return;
    }
    const projectId = activeProjectIdRef.current;
    const ticket = pageGenerationCoordinator.begin(projectId, target.kind);
    if (!ticket) return;
    if (pageId === selectedPageId) {
      requestCoordinator.pageReplaced(() => setSectionState(createEmptySectionRequestState()));
    }
    const isCurrent = () => pageGenerationCoordinator.isCurrent(ticket, activeProjectIdRef.current);
    setPageRegenerationState((current) => ({ ...current, [pageId]: { loading: true, error: "" } }));
    try {
      const result = await runStudioPageRegeneration({
        target,
        brief,
        ticket,
        coordinator: pageGenerationCoordinator,
        getActiveProjectId: () => activeProjectIdRef.current,
        getPages: () => projectPagesRef.current,
        setPages,
      });
      if (!isCurrent()) return;
      if (result.status === "regenerated") {
        const updated = projectPagesRef.current.find((record) => record.id === pageId);
        if (!updated) return;
        pageDraftsRef.current.deleteDraft(draftKey);
        pageDraftsRef.current.deleteTemplateValidity(draftKey);
        setTemplateValidityRevision((revision) => revision + 1);
        setPageEditorRevisions((current) => ({ ...current, [pageId]: (current[pageId] ?? 0) + 1 }));
        if (selectedPageIdRef.current === pageId) {
          requestCoordinator.pageReplaced(() => setSectionState(createEmptySectionRequestState()));
          setPage(GeneratedPageSchema.parse({
            ...brief,
            headline: updated.content.headline,
            subheadline: updated.content.description,
            features: updated.content.features,
            callToAction: updated.content.callToAction,
            layout,
          }));
          setSiteTemplate(updated.template);
          setTemplateContentValid(true);
        }
        markDirty();
        setNotice(`${updated.title} page regenerated.`);
      } else if (result.status === "failed") {
        setPageRegenerationState((current) => ({ ...current, [pageId]: { loading: true, error: result.message ?? "We couldn’t regenerate this page right now. Please try again." } }));
      }
    } catch {
      if (isCurrent()) setPageRegenerationState((current) => ({ ...current, [pageId]: { loading: true, error: "We couldn’t regenerate this page right now. Please try again." } }));
    } finally {
      const wasCurrent = isCurrent();
      pageGenerationCoordinator.finish(ticket);
      if (wasCurrent) setPageRegenerationState((current) => ({ ...current, [pageId]: { ...current[pageId], loading: false } }));
    }
  }

  function changeLayout(next: GeneratedPage["layout"]) {
    requestCoordinator.layoutChanged(() => setLoading(false));
    setLayout(next);
    setPage((current) => current ? { ...current, layout: next } : current);
    markDirty();
  }

  function editSiteSettings(update: (current: SiteSettings) => SiteSettings) {
    updateSiteSettings(update);
    markDirty();
  }

  async function uploadSiteLogo(file: File) {
    setLogoUploadState({ loading: true, error: "" });
    const existingDraftOwner = draftLogoOwnerIdRef.current;
    const ownerId = activeProjectIdRef.current ?? existingDraftOwner ?? draftProjectIdRef.current ?? globalThis.crypto.randomUUID();
    const assetId = globalThis.crypto.randomUUID();
    if (!activeProjectIdRef.current && !existingDraftOwner) draftLogoOwnerIdRef.current = ownerId;
    const ownerIsDraft = activeProjectIdRef.current === null;
    let assetStored = false;
    const discardUploadedLogo = async () => {
      let cleanupFailed = false;
      if (assetStored) {
        try { await removeProjectLogo(ownerId, assetId); }
        catch { cleanupFailed = true; }
      }
      completeProjectLogoUpload(ownerId, assetId, false);
      if (cleanupFailed) {
        if (ownerIsDraft) scheduleDraftLogoCleanup(ownerId);
        else scheduleSavedProjectLogoCleanup(ownerId);
      }
    };
    try { reserveProjectLogoUpload(ownerId, assetId); }
    catch (error) {
      setLogoUploadState({ loading: false, error: safeLogoStorageMessage(error) });
      return;
    }
    try {
      const validated = await validateSiteLogoFile(file);
      await storeProjectLogo(ownerId, assetId, validated);
      assetStored = true;
      const ownerIsCurrent = ownerIsDraft
        ? activeProjectIdRef.current === null && draftLogoOwnerIdRef.current === ownerId
        : activeProjectIdRef.current === ownerId;
      if (!ownerIsCurrent) {
        await discardUploadedLogo();
        return;
      }
      const stored = await loadProjectLogo(ownerId, assetId);
      if (!stored) throw new Error("The uploaded logo could not be confirmed in browser storage.");
      const asset = await siteLogoAssetFromStored(stored);
      const stillCurrent = ownerIsDraft
        ? activeProjectIdRef.current === null && draftLogoOwnerIdRef.current === ownerId
        : activeProjectIdRef.current === ownerId;
      if (!stillCurrent) {
        await discardUploadedLogo();
        return;
      }
      setSiteLogoAsset(asset);
      editSiteSettings((current) => ({
        ...current,
        branding: { ...current.branding, logoAssetId: assetId },
      }));
      completeProjectLogoUpload(ownerId, assetId, true);
      setLogoUploadState({ loading: false, error: "" });
    } catch (error) {
      await discardUploadedLogo();
      setLogoUploadState({
        loading: false,
        error: error instanceof Error && [
          "Choose a non-empty PNG, JPEG, or WebP logo.",
          "Logo files must be 2 MB or smaller.",
          "The selected logo file is invalid or too large.",
          "Choose a valid PNG, JPEG, or WebP logo.",
          "This logo image could not be opened. Choose another image file.",
          "This logo image has invalid dimensions.",
          "Logo preview is unavailable in this browser.",
        ].includes(error.message)
          ? error.message
          : error instanceof SiteLogoStorageError ? error.message : "The logo could not be saved in this browser. Check available storage and try again.",
      });
      if (!existingDraftOwner && ownerIsDraft && draftLogoOwnerIdRef.current === ownerId) {
        draftLogoOwnerIdRef.current = null;
        try { await removeAllProjectLogos(ownerId); }
        catch { setLogoUploadState({ loading: false, error: "The upload failed and temporary logo cleanup could not finish." }); }
      }
    }
  }

  function removeSiteLogo() {
    const ownerId = activeProjectIdRef.current ?? draftLogoOwnerIdRef.current;
    setSiteLogoAsset(null);
    setLogoUploadState({ loading: false, error: "" });
    editSiteSettings((current) => ({ ...current, branding: { ...current.branding, logoAssetId: null } }));
    if (!activeProjectIdRef.current && ownerId) {
      draftLogoOwnerIdRef.current = null;
      scheduleDraftLogoCleanup(ownerId);
    }
  }

  function changeLogoDisplayMode(mode: SiteLogoDisplayMode) {
    editSiteSettings((current) => ({ ...current, branding: { ...current.branding, logoDisplayMode: mode } }));
  }

  function editNavigation(index: number, field: "label", value: string) {
    editSiteSettings((current) => ({
      ...current,
      navigation: current.navigation.map((entry, entryIndex) => entryIndex === index
        ? { ...entry, [field]: value }
        : entry) as SiteSettings["navigation"],
    }));
  }

  function editNavigationTarget(index: number, target: SiteNavigationTarget) {
    editSiteSettings((current) => ({
      ...current,
      navigation: current.navigation.map((entry, entryIndex) => entryIndex === index
        ? siteNavigationEntryWithTarget(entry, target)
        : entry) as SiteSettings["navigation"],
    }));
  }

  function editCtaDestination(value: string) {
    const parsed = SiteDestinationSchema.safeParse(value);
    editSiteSettings((current) => ({
      ...current,
      ctaDestination: value,
      ctaTarget: parsed.success ? siteCtaTargetFromLegacy(parsed.data) : current.ctaTarget,
    }));
  }

  function editCtaTarget(target: SiteCtaTarget) {
    editSiteSettings((current) => ({ ...current, ctaDestination: siteCtaTargetLegacyProjection(target), ctaTarget: target }));
  }

  function setTemplatePageContent(pageId: string, template: SiteTemplate | null) {
    const key = studioPageDraftKey(activeProjectIdRef.current, pageId);
    const record = projectPagesRef.current.find((candidate) => candidate.id === pageId);
    pageDraftsRef.current.setTemplateValid(key, template !== null);
    setTemplateValidityRevision((revision) => revision + 1);
    if (pageId === selectedPageId) setTemplateContentValid(template !== null);
    if (record && template && template.id === record.template.id) {
      const updatedPages = updateProjectPage(projectPagesRef.current, pageId, (current) => ({ ...current, template }));
      if (updatedPages) {
        setPages(updatedPages);
        if (pageId === selectedPageId) setSiteTemplate(updatedPages.find((candidate) => candidate.id === pageId)!.template);
      }
    }
    if (record && record.kind !== "legacy") {
      pageGenerationCoordinator.invalidatePage(activeProjectIdRef.current, record.kind);
      setPageRegenerationState((current) => ({ ...current, [pageId]: { loading: false, error: "" } }));
    }
    markDirty();
  }

  function editRestaurantContent(pageId: string, content: RestaurantContent | null) {
    const revisionKey = templateSectionKey(activeProjectIdRef.current, pageId, "menuHighlights");
    templateSectionRevisionsRef.current.set(revisionKey, (templateSectionRevisionsRef.current.get(revisionKey) ?? 0) + 1);
    const record = projectPagesRef.current.find((candidate) => candidate.id === pageId);
    if (record?.template.id === "restaurant") setTemplatePageContent(pageId, content ? { id: "restaurant", content } : null);
  }

  function editFashionContent(pageId: string, content: FashionContent | null) {
    const revisionKey = templateSectionKey(activeProjectIdRef.current, pageId, "collectionHighlights");
    templateSectionRevisionsRef.current.set(revisionKey, (templateSectionRevisionsRef.current.get(revisionKey) ?? 0) + 1);
    const record = projectPagesRef.current.find((candidate) => candidate.id === pageId);
    if (record?.template.id === "fashion") setTemplatePageContent(pageId, content ? { id: "fashion", content } : null);
  }

  function editRealEstateContent(pageId: string, content: RealEstateContent | null) {
    const revisionKey = templateSectionKey(activeProjectIdRef.current, pageId, "featuredProperties");
    templateSectionRevisionsRef.current.set(revisionKey, (templateSectionRevisionsRef.current.get(revisionKey) ?? 0) + 1);
    const record = projectPagesRef.current.find((candidate) => candidate.id === pageId);
    if (record?.template.id === "real-estate") setTemplatePageContent(pageId, content ? { id: "real-estate", content } : null);
  }

  function editGeneratedSection(section: EditableSection, value: string, featureIndex?: number) {
    requestCoordinator.contentEdited(section, () => setLoading(false));
    if (!page) return;
    let updated: GeneratedPage;
    if (section === "headline") updated = { ...page, headline: value };
    else if (section === "description") updated = { ...page, subheadline: value };
    else if (section === "callToAction") updated = { ...page, callToAction: value };
    else if (featureIndex !== undefined) updated = { ...page, features: page.features.map((feature, index) => index === featureIndex ? value : feature) };
    else return;
    setPage(updated);
    const key = studioPageDraftKey(activeProjectIdRef.current, selectedPageId);
    pageDraftsRef.current.setDraft(key, updated);
    const parsedContent = ProjectPageContentSchema.safeParse({ headline: updated.headline, description: updated.subheadline, features: updated.features, callToAction: updated.callToAction });
    const record = projectPagesRef.current.find((candidate) => candidate.id === selectedPageId);
    if (parsedContent.success && record) {
      const updatedPages = updateProjectPage(projectPagesRef.current, selectedPageId, (current) => ({ ...current, content: parsedContent.data }));
      if (updatedPages) setPages(updatedPages);
    }
    if (record && record.kind !== "legacy") {
      pageGenerationCoordinator.invalidatePage(activeProjectIdRef.current, record.kind);
      setPageRegenerationState((current) => ({ ...current, [record.id]: { loading: false, error: "" } }));
    }
    markDirty();
    setSectionState((current) => ({ ...current, [section]: { ...current[section], error: "" } }));
  }

  async function regenerateSection(section: EditableSection) {
    const pageId = selectedPageIdRef.current;
    if (loading || pageGenerationState[pageId as keyof PageGenerationUiState]?.loading || pageRegenerationState[pageId as keyof PageRegenerationUiState]?.loading || !page) return;
    const projectId = activeProjectIdRef.current;
    const requestBrief = brief;
    const currentRecord = projectPagesRef.current.find((candidate) => candidate.id === pageId);
    const pageRecord = {
      id: currentRecord?.id ?? "home",
      slug: currentRecord?.slug ?? "index",
      title: currentRecord?.title ?? "Home",
      kind: currentRecord?.kind ?? "home",
      template: currentRecord?.template ?? siteTemplate,
    };
    const ticket = requestCoordinator.beginSection(section, projectId);
    if (!ticket) return;
    const isCurrent = () => requestCoordinator.isSectionCurrent(ticket, sectionContextKey()) && activeProjectIdRef.current === projectId;
    setSectionState((current) => ({ ...current, [section]: { loading: true, error: "" } }));
    await requestCoordinator.runSection(ticket, sectionContextKey, async () => {
      const response = await fetch("/api/regenerate-page-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, brief: requestBrief, page: pageRecord, section }),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null || !("data" in result)) {
        const code = typeof result === "object" && result !== null && "error" in result && typeof result.error === "object" && result.error !== null && "code" in result.error && typeof result.error.code === "string"
          ? result.error.code
          : "";
        const message = code === "GENERATION_NOT_CONFIGURED" ? "AI generation is not configured on this server."
          : code === "GENERATION_REFUSED" ? "The request could not be generated. Revise the brief and try again."
          : code === "INVALID_GENERATION" ? "The generation service returned invalid content. Please try again."
          : "We couldn’t regenerate this section. Please try again.";
        throw new Error(message);
      }
      const parsedSection = PageRegenerationSectionSchema.safeParse(section);
      if (!parsedSection.success) throw new Error("This section cannot be regenerated.");
      const validated = PageSectionContentSchemas[parsedSection.data].safeParse(result.data);
      if (!validated.success) throw new Error("The generation service returned an invalid section. Please try again.");
      return validated.data;
    }, (validatedSection) => {
      if (!isCurrent()) return;
      markDirty();
      setPage((current) => current && isCurrent() ? mergeGeneratedSectionIfUnchanged(
        current,
        section,
        validatedSection,
        ticket.revision,
        requestCoordinator.currentSectionRevision(section),
      ) : current);
    }, (error) => {
      if (!isCurrent()) return;
      const safeMessage = error instanceof Error && [
        "We couldn’t regenerate this section. Please try again.",
        "AI generation is not configured on this server.",
        "The request could not be generated. Revise the brief and try again.",
        "The generation service returned invalid content. Please try again.",
        "The generation service returned an invalid section. Please try again.",
      ].includes(error.message) ? error.message : "We couldn’t regenerate this section. Please try again.";
      setSectionState((current) => ({ ...current, [section]: { loading: true, error: safeMessage } }));
    }, () => setSectionState((current) => ({ ...current, [section]: { ...current[section], loading: false } })));
  }

  async function regenerateTemplateSection(section: TemplateRegenerationSection) {
    const pageId = selectedPageIdRef.current;
    const projectId = activeProjectIdRef.current;
    const key = templateSectionKey(projectId, pageId, section);
    if (loading || templateSectionInFlightRef.current.has(key)) return;
    const record = projectPagesRef.current.find((candidate) => candidate.id === pageId);
    if (!record || (section === "menuHighlights" && record.template.id !== "restaurant")
      || (section === "collectionHighlights" && record.template.id !== "fashion")
      || (section === "featuredProperties" && record.template.id !== "real-estate")) return;
    const revision = templateSectionRevisionsRef.current.get(key) ?? 0;
    templateSectionInFlightRef.current.add(key);
    setTemplateSectionState(projectId, pageId, section, { loading: true, error: "" });
    try {
      const response = await fetch("/api/regenerate-page-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, brief, page: { id: record.id, slug: record.slug, title: record.title, kind: record.kind, template: record.template }, section }),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null || !("data" in result)) {
        const code = typeof result === "object" && result !== null && "error" in result && typeof result.error === "object" && result.error !== null && "code" in result.error && typeof result.error.code === "string" ? result.error.code : "";
        throw new Error(code === "GENERATION_NOT_CONFIGURED" ? "AI generation is not configured on this server."
          : code === "GENERATION_REFUSED" ? "The request could not be generated. Revise the brief and try again."
          : code === "INVALID_GENERATION" ? "The generation service returned invalid content. Please try again."
          : "We couldn’t regenerate this section. Please try again.");
      }
      const parsedSection = PageRegenerationSectionSchema.safeParse(section);
      if (!parsedSection.success) throw new Error("This section cannot be regenerated.");
      const validated = PageSectionContentSchemas[parsedSection.data].safeParse(result.data);
      if (!validated.success) throw new Error("The generation service returned an invalid section. Please try again.");
      const currentRecord = projectPagesRef.current.find((candidate) => candidate.id === pageId);
      const isCurrent = activeProjectIdRef.current === projectId
        && (templateSectionRevisionsRef.current.get(key) ?? 0) === revision
        && currentRecord?.template.id === record.template.id;
      if (!isCurrent || !currentRecord) return;
      const mergedTemplate = mergeTemplateSectionIfUnchanged(currentRecord.template, section, validated.data, revision, templateSectionRevisionsRef.current.get(key) ?? 0);
      if (mergedTemplate === currentRecord.template) return;
      setTemplatePageContent(pageId, mergedTemplate);
      setPageEditorRevisions((current) => ({ ...current, [pageId]: (current[pageId] ?? 0) + 1 }));
      setTemplateSectionState(projectId, pageId, section, { loading: true, error: "" });
    } catch (error) {
      const safeMessages = [
        "We couldn’t regenerate this section. Please try again.",
        "AI generation is not configured on this server.",
        "The request could not be generated. Revise the brief and try again.",
        "The generation service returned invalid content. Please try again.",
        "The generation service returned an invalid section. Please try again.",
      ];
      const message = error instanceof Error && safeMessages.includes(error.message) ? error.message : "We couldn’t regenerate this section. Please try again.";
      setTemplateSectionState(projectId, pageId, section, { loading: true, error: message });
    } finally {
      templateSectionInFlightRef.current.delete(key);
      setTemplateSectionStates((current) => ({ ...current, [key]: { ...current[key], loading: false } }));
    }
  }

  async function generateHeroImage() {
    if (!page) return;
    const projectId = activeProjectIdRef.current;
    const requestBrief = brief;
    const identity = requestCoordinator.beginHeroImage(projectId);
    if (!identity) return;
    const isCurrent = () => requestCoordinator.isHeroImageCurrent(identity, heroImageContextKey()) && activeProjectIdRef.current === projectId;
    setHeroImageState({ loading: true, error: "" });
    await requestCoordinator.runHeroImage(identity, heroImageContextKey, async () => {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: requestBrief }),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null || !("data" in result)) {
        const code = typeof result === "object" && result !== null && "error" in result && typeof result.error === "object" && result.error !== null && "code" in result.error && typeof result.error.code === "string"
          ? result.error.code
          : "";
        throw new Error(code === "IMAGE_GENERATION_NOT_CONFIGURED"
          ? "Image generation is not configured on this server."
          : code === "INVALID_IMAGE_GENERATION"
            ? "The image service returned invalid content. Please try again."
            : "We couldn’t generate a hero image. Please try again.");
      }
      const parsed = HeroImageAssetSchema.safeParse(result.data);
      if (!parsed.success) throw new Error("The image service returned invalid content. Please try again.");
      return parsed.data;
    }, (image) => {
      if (!isCurrent()) return;
      setProjectHeroImage({ projectId, image });
      markDirty();
    }, (error) => {
      if (!isCurrent()) return;
      const message = error instanceof Error && [
        "Image generation is not configured on this server.",
        "The image service returned invalid content. Please try again.",
      ].includes(error.message) ? error.message : "We couldn’t generate a hero image. Please try again.";
      setHeroImageState({ loading: true, error: message });
    }, () => setHeroImageState((current) => ({ ...current, loading: false })));
  }

  function removeHeroImage() {
    requestCoordinator.invalidateHeroImage();
    setProjectHeroImage({ projectId: activeProjectIdRef.current, image: null });
    setHeroImageState({ loading: false, error: "" });
    markDirty();
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <a className="brand" href="#workspace" aria-label="WebLander AI home"><span className="brand-mark">W</span><span>WebLander AI</span></a>
        <div className="workspace-label">WORKSPACE</div>
        <a className="nav-item active" href="#workspace"><span className="nav-icon">✳</span> Website studio</a>
        <button className="nav-item muted projects-nav" type="button" onClick={showProjectManager} aria-haspopup="dialog" aria-expanded={projectManagerOpen}><span className="nav-icon">▤</span> My projects</button>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-spark">✦</span><strong>Made for big ideas.</strong><p>Your next great website starts with a clear brief.</p><a href="#brief">Start creating <span>↗</span></a></div><div className="profile"><div className="avatar">N</div><div><strong>New workspace</strong><span>Free plan</span></div><span className="profile-menu">···</span></div></div>
      </aside>

      <section className="main-area" id="workspace">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Website studio</strong></div><div className="top-actions"><span className="prototype-pill"><i /> AI generation</span><button className="help-button" type="button" aria-label="Help">?</button></div></header>
        <div className="workspace-content">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR CREATIVE STUDIO</div><h1>Let’s make something <em>remarkable.</em></h1><p>Tell us about your business. We’ll turn your big idea into a page worth landing on.</p></div><div className="step-badge"><span>01</span><span className="step-line"/><span>02</span><span className="step-line"/><span>03</span></div></div>
          <div className="project-toolbar">
            <div><strong>{activeProjectName || "Untitled website"}</strong><span className={`save-indicator ${isDirty ? "unsaved" : ""}`} role="status" aria-live="polite">{saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Not saved" : isDirty ? activeProjectId ? "Unsaved changes" : "Unsaved draft" : activeProjectId ? "Saved" : "Not saved yet"}</span></div>
            <div className="project-toolbar-actions"><button type="button" onClick={() => setExportDialogOpen(true)} disabled={!page || !templateContentValid || logoUploadState.loading}>Export current page</button><button type="button" onClick={downloadCompleteWebsite} disabled={!page || websiteZipState.loading || !templateContentValid || logoUploadState.loading} aria-busy={websiteZipState.loading}>{websiteZipState.loading ? "Preparing website ZIP…" : "Export complete website"}</button><button type="button" onClick={saveCurrentProject} disabled={!page || saveStatus === "saving" || logoUploadState.loading}>{saveStatus === "error" ? "Retry Save" : "Save Project"}</button><button type="button" onClick={showProjectManager}>My Projects</button><button type="button" onClick={confirmNewProject}>New Project</button></div>
          </div>
          {websiteZipState.error && <p role="alert" className="project-storage-error">{websiteZipState.error}</p>}
          {websiteZipState.success && <p role="status" aria-live="polite">{websiteZipState.success}</p>}
          {logoCleanupRetryProjectId && <button type="button" onClick={() => { void retryDeletedProjectLogoCleanup(); }}>Retry logo cleanup</button>}
          {page && projectPages.length > 0 && <PageManagement
            pages={projectPages}
            activePageId={selectedPageId}
            templateId={siteTemplate.id}
            generationState={pageGenerationState}
            regenerationState={pageRegenerationState}
            canRegenerate={!loading && !Object.values(sectionState).some((state) => state.loading)}
            onSelectPage={selectStudioPage}
            onGeneratePage={generateAdditionalPage}
            onRegeneratePage={regenerateStudioPage}
          />}
          {projectStorageError && <p className="project-storage-error page-storage-error" role="alert">{projectStorageError}</p>}
          <div className="prototype-note"><span className="note-icon">✦</span><span><strong>AI-powered page concepts.</strong> Your brief is used to create landing-page copy. Review generated content before publishing.</span><button type="button" aria-label="Dismiss generation note" onClick={(e) => e.currentTarget.parentElement?.remove()}>×</button></div>
          <div className="studio-grid" id="brief">
            <BriefForm brief={brief} onChange={updateBrief} onSubmit={submit} loading={loading} />
      <WebsitePreview page={page} pageEditable={Boolean(page)} pages={projectPages} selectedPageId={selectedPageId} allowSectionRegeneration={Boolean(page) && !loading && !pageGenerationState[selectedPageId as keyof PageGenerationUiState]?.loading && !pageRegenerationState[selectedPageId as keyof PageRegenerationUiState]?.loading} layout={layout} style={brief.style} appearance={siteSettings.appearance} onAppearanceChange={updateAppearance} siteSettings={siteSettings} onSiteSettingChange={editNavigation} onSiteNavigationTargetChange={editNavigationTarget} onCtaDestinationChange={editCtaDestination} onCtaTargetChange={editCtaTarget} onPreviewNavigate={navigatePreview} onLayoutChange={changeLayout} loading={loading} sectionState={sectionState} onEdit={editGeneratedSection} onRegenerate={regenerateSection} templateSectionState={{
        menuHighlights: { ...(templateSectionStates[templateSectionKey(activeProjectId, selectedPageId, "menuHighlights")] ?? { loading: false, error: "" }), disabled: !page || loading || Boolean(pageGenerationState[selectedPageId as keyof PageGenerationUiState]?.loading) || Boolean(pageRegenerationState[selectedPageId as keyof PageRegenerationUiState]?.loading) },
        collectionHighlights: { ...(templateSectionStates[templateSectionKey(activeProjectId, selectedPageId, "collectionHighlights")] ?? { loading: false, error: "" }), disabled: !page || loading || Boolean(pageGenerationState[selectedPageId as keyof PageGenerationUiState]?.loading) || Boolean(pageRegenerationState[selectedPageId as keyof PageRegenerationUiState]?.loading) },
        featuredProperties: { ...(templateSectionStates[templateSectionKey(activeProjectId, selectedPageId, "featuredProperties")] ?? { loading: false, error: "" }), disabled: !page || loading || Boolean(pageGenerationState[selectedPageId as keyof PageGenerationUiState]?.loading) || Boolean(pageRegenerationState[selectedPageId as keyof PageRegenerationUiState]?.loading) },
      }} onRegenerateTemplateSection={regenerateTemplateSection} heroImage={heroImage} heroImageState={heroImageState} onGenerateHeroImage={generateHeroImage} onRemoveHeroImage={removeHeroImage} logoAsset={siteLogoAsset} logoUploadState={logoUploadState} onLogoUpload={(file) => { void uploadSiteLogo(file); }} onLogoRemove={removeSiteLogo} onLogoDisplayModeChange={changeLogoDisplayMode} template={siteTemplate} activeProjectId={activeProjectId} restaurantEditorRevision={restaurantEditorRevision} pageEditorRevisions={pageEditorRevisions} onRestaurantContentChange={editRestaurantContent} onFashionContentChange={editFashionContent} onRealEstateContentChange={editRealEstateContent} />
          </div>
          {notice && <p className={`generation-notice ${notice.includes("ready") ? "success" : ""}`} role="status" aria-live="polite">{notice}</p>}
          <footer className="page-footer"><span>© 2025 WebLander AI</span><span>Built for the next big thing <b>✦</b></span><a href="#brief">Feedback <span>↗</span></a></footer>
        </div>
      </section>
      <ProjectManager
        open={projectManagerOpen}
        projects={projects}
        activeProjectId={activeProjectId}
        storageError={projectStorageError}
        projectsUnavailable={projectsUnavailable}
        hasUnsavedChanges={isDirty && activeProjectId !== null}
        onClose={() => setProjectManagerOpen(false)}
        onRetry={refreshProjects}
        onNewProject={confirmNewProject}
        onOpenProject={confirmOpenProject}
        onRenameProject={renameProject}
        onDeleteProject={deleteProject}
      />
      <UnsavedChangesDialog
        open={pendingTransition !== null}
        canSave={page !== null}
        error={projectStorageError}
        onSaveAndContinue={continueAfterSave}
        onDiscardAndContinue={continueAfterDiscard}
        onKeepEditing={keepEditing}
      />
      <ExportDialog open={exportDialogOpen} initialDestination={siteSettings.ctaDestination} onClose={() => setExportDialogOpen(false)} onExport={(destination) => { downloadWebsite(destination); editCtaDestination(destination); }} />
    </main>
  );
}
