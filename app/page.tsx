"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { EMPTY_BRIEF, EditableSectionSchema, GeneratedPageSchema, SectionContentSchemas, VisualStyleSchema, type BusinessBrief, type EditableSection, type GeneratedPage } from "@/lib/generation";
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
import { createWebsiteExport } from "@/lib/website-export";
import { AppearanceSchema, DEFAULT_SITE_SETTINGS, SiteSettingsSchema, validateAppearanceContrast, type Appearance, type SiteNavigationTarget, type SiteSettings } from "@/lib/site-settings";
import { siteNavigationDestinationOptions, siteNavigationEntryWithTarget } from "@/lib/site-navigation-options";
import { createEmptySectionRequestState, type SectionRequestState } from "@/lib/section-request-state";
import { createStudioRequestCoordinator } from "@/lib/studio-request-coordinator";
import { createPageGenerationCoordinator, pageKindLabel, updateProjectPage, type AddablePageKind } from "@/lib/studio-pages";
import { resolveStudioPageSelection } from "@/lib/studio-page-selection";
import { runStudioPageGeneration, runStudioPageRegeneration } from "@/lib/studio-page-generation";
import { createStudioPageDraftStore, studioPageDraftKey } from "@/lib/studio-page-drafts";
import { createStudioNavigationCoordinator, type StudioNavigationTicket } from "@/lib/studio-navigation";
import { PageManagement, type PageGenerationUiState, type PageRegenerationUiState } from "@/components/page-management";
import { HeroImageAssetSchema } from "@/lib/site-image";
import { heroImageForProject, type ProjectHeroImageState } from "@/lib/project-hero-image";
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
  const [heroImageState, setHeroImageState] = useState({ loading: false, error: "" });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [sectionState, setSectionState] = useState<SectionRequestState>(createEmptySectionRequestState);
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
  const [projectsUnavailable, setProjectsUnavailable] = useState(false);
  const [projectManagerOpen, setProjectManagerOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<ProjectTransition | null>(null);
  const pendingTransitionRef = useRef<ProjectTransition | null>(null);
  const projectStorageRef = useRef<ProjectStorage | null>(null);
  const projectPagesRef = useRef<ProjectPage[]>([]);
  const pageDraftsRef = useRef(createStudioPageDraftStore<GeneratedPage>());
  const activeProjectIdRef = useRef<string | null>(null);
  const selectedPageIdRef = useRef("home");
  const activeProjectRevisionRef = useRef(0);
  const dirtyRevisionRef = useRef(0);
  const isDirtyRef = useRef(false);

  function setPages(pages: ProjectPage[]) {
    projectPagesRef.current = pages;
    setProjectPages(pages);
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

  function clearActiveProjectToDraft() {
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
    setSiteSettings(DEFAULT_SITE_SETTINGS);
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
    setSiteSettings(savedTemplate.id === "restaurant"
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

  function performTransition(transition: ProjectTransition) {
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
        if (project.id === activeProjectIdRef.current) clearActiveProjectToDraft();
        setProjectStorageError("");
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
    performTransition(request.transition);
  }

  function saveCurrentProject() {
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
      const saved = activeProjectIdRef.current
        ? storage.save(activeProjectIdRef.current, snapshot, activeProjectRevisionRef.current)
        : storage.create(brief.businessName, snapshot);
      if (creatingProject) {
        pageGenerationCoordinator.invalidateForProjectTransition();
        setPageGenerationState(createEmptyPageGenerationState());
        setPageRegenerationState(createEmptyPageRegenerationState());
        requestCoordinator.projectTransition(
          () => setLoading(false),
          () => setSectionState(createEmptySectionRequestState()),
          () => setHeroImageState({ loading: false, error: "" }),
        );
        setProjectHeroImage({ projectId: saved.id, image: heroImageForProject(projectHeroImage, null) });
      }
      activeProjectIdRef.current = saved.id;
      activeProjectRevisionRef.current = saved.revision;
      setActiveProjectId(saved.id);
      setActiveProjectName(saved.name);
      setActiveProjectRevision(saved.revision);
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

  async function continueAfterSave() {
    const transition = pendingTransitionRef.current;
    if (!transition || !(await resolveProjectTransition("save", saveCurrentProject))) return;
    setPendingProjectTransition(null);
    performTransition(transition);
  }

  function continueAfterDiscard() {
    const transition = pendingTransitionRef.current;
    if (!transition) return;
    void resolveProjectTransition("discard", saveCurrentProject).then((canProceed) => {
      if (!canProceed) return;
      if (pendingTransitionRef.current !== transition) return;
      setPendingProjectTransition(null);
      performTransition(transition);
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
    performTransition({ type: "delete", id: project.id });
  }

  function confirmNewProject() {
    requestTransition({ type: "new" });
  }

  function confirmOpenProject(id: string) {
    requestTransition({ type: "open", id });
  }

  function downloadWebsite(destination: string) {
    if (!page) return;
    if (!templateContentValid) {
      setProjectStorageError("Correct the template content fields before exporting this website.");
      return;
    }
    const settings = SiteSettingsSchema.parse({ ...siteSettings, ctaDestination: destination });
    const exported = createWebsiteExport(page, layout, settings, heroImageForProject(projectHeroImage, activeProjectIdRef.current), siteTemplate, {
      currentPageId: selectedPageIdRef.current,
      pageKind: projectPagesRef.current.find((record) => record.id === selectedPageIdRef.current)?.kind ?? "home",
      pages: projectPagesRef.current,
    });
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

  useEffect(() => {
    if (!activeProjectId || !isDirty || !page || pendingTransition || !templateContentValid || !allPageDraftsValid()) return;
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
        const saved = getProjectStorage().save(projectId, snapshot, expectedRevision);
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
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeProjectId, activeProjectRevision, allPageDraftsValid, brief, currentPagesForSnapshot, dirtyRevision, getProjectStorage, isDirty, layout, page, pendingTransition, projectHeroImage, projectPages, refreshProjects, safeStorageMessage, siteSettings, siteTemplate, templateContentValid, templateValidityRevision]);

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
    setSiteSettings((current) => ({ ...current, appearance: validatedAppearance }));
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
      setPages(existingPages.some((record) => record.id === "home")
        ? existingPages.map((record) => record.id === "home" ? home : record)
        : [home, ...existingPages]);
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
      if (generated.template.id === "restaurant") {
        const restaurantContent = generated.template.content;
        setSiteSettings((current) => initializeRestaurantNavigation(current, restaurantContent));
      } else if (generated.template.id === "fashion") {
        const fashionContent = generated.template.content;
        setSiteSettings((current) => initializeFashionNavigation(current, fashionContent));
      } else if (generated.template.id === "real-estate") {
        const realEstateContent = generated.template.content;
        setSiteSettings((current) => initializeRealEstateNavigation(current, realEstateContent));
      }
      markDirty();
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
    setSiteSettings((current) => update(current));
    markDirty();
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
    editSiteSettings((current) => ({ ...current, ctaDestination: value }));
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
    const record = projectPagesRef.current.find((candidate) => candidate.id === pageId);
    if (record?.template.id === "restaurant") setTemplatePageContent(pageId, content ? { id: "restaurant", content } : null);
  }

  function editFashionContent(pageId: string, content: FashionContent | null) {
    const record = projectPagesRef.current.find((candidate) => candidate.id === pageId);
    if (record?.template.id === "fashion") setTemplatePageContent(pageId, content ? { id: "fashion", content } : null);
  }

  function editRealEstateContent(pageId: string, content: RealEstateContent | null) {
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
    if (loading || pageGenerationState.home.loading || pageRegenerationState.home?.loading) return;
    const projectId = activeProjectIdRef.current;
    const requestBrief = brief;
    const ticket = requestCoordinator.beginSection(section, projectId);
    if (!ticket) return;
    const isCurrent = () => requestCoordinator.isSectionCurrent(ticket, sectionContextKey()) && activeProjectIdRef.current === projectId;
    setSectionState((current) => ({ ...current, [section]: { loading: true, error: "" } }));
    await requestCoordinator.runSection(ticket, sectionContextKey, async () => {
      const response = await fetch("/api/regenerate-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: requestBrief, section }),
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
      const parsedSection = EditableSectionSchema.safeParse(section);
      if (!parsedSection.success) throw new Error("This section cannot be regenerated.");
      const validated = SectionContentSchemas[parsedSection.data].safeParse(result.data);
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
            <div className="project-toolbar-actions"><button type="button" onClick={() => setExportDialogOpen(true)} disabled={!page || !templateContentValid}>Export HTML</button><button type="button" onClick={saveCurrentProject} disabled={!page || saveStatus === "saving"}>Save Project</button><button type="button" onClick={showProjectManager}>My Projects</button><button type="button" onClick={confirmNewProject}>New Project</button></div>
          </div>
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
      <WebsitePreview page={page} pageEditable={Boolean(page)} pages={projectPages} selectedPageId={selectedPageId} allowSectionRegeneration={selectedPageId === "home" && !loading && !pageRegenerationState.home.loading} layout={layout} style={brief.style} appearance={siteSettings.appearance} onAppearanceChange={updateAppearance} siteSettings={siteSettings} onSiteSettingChange={editNavigation} onSiteNavigationTargetChange={editNavigationTarget} onCtaDestinationChange={editCtaDestination} onPreviewNavigate={navigatePreview} onLayoutChange={changeLayout} loading={loading} sectionState={sectionState} onEdit={editGeneratedSection} onRegenerate={regenerateSection} heroImage={heroImage} heroImageState={heroImageState} onGenerateHeroImage={generateHeroImage} onRemoveHeroImage={removeHeroImage} template={siteTemplate} activeProjectId={activeProjectId} restaurantEditorRevision={restaurantEditorRevision} pageEditorRevisions={pageEditorRevisions} onRestaurantContentChange={editRestaurantContent} onFashionContentChange={editFashionContent} onRealEstateContentChange={editRealEstateContent} />
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
