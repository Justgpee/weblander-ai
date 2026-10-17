"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { EMPTY_BRIEF, EditableSectionSchema, GeneratedPageSchema, SectionContentSchemas, type BusinessBrief, type EditableSection, type GeneratedPage } from "@/lib/generation";
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
  pageFromProject,
  projectSnapshotFromPage,
  type ProjectRecord,
  type ProjectStorage,
} from "@/lib/projects";
import { createWebsiteExport } from "@/lib/website-export";

type SectionState = Record<EditableSection, { loading: boolean; error: string }>;
const EMPTY_SECTION_STATE: SectionState = {
  headline: { loading: false, error: "" }, description: { loading: false, error: "" },
  features: { loading: false, error: "" }, callToAction: { loading: false, error: "" },
};

export default function Home() {
  const [brief, setBrief] = useState<BusinessBrief>(EMPTY_BRIEF);
  const [page, setPage] = useState<GeneratedPage | null>(null);
  const [layout, setLayout] = useState<GeneratedPage["layout"]>("editorial");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [sectionState, setSectionState] = useState<SectionState>(EMPTY_SECTION_STATE);
  const inFlightSections = useRef(new Set<EditableSection>());
  const sectionEditRevisions = useRef<Record<EditableSection, number>>({ headline: 0, description: 0, features: 0, callToAction: 0 });
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
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
  const activeProjectIdRef = useRef<string | null>(null);
  const activeProjectRevisionRef = useRef(0);
  const dirtyRevisionRef = useRef(0);
  const isDirtyRef = useRef(false);

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
    for (const section of Object.keys(sectionEditRevisions.current) as EditableSection[]) {
      sectionEditRevisions.current[section] += 1;
    }
  }

  function clearActiveProjectToDraft() {
    invalidateSectionResponses();
    advanceDirtyRevision();
    activeProjectIdRef.current = null;
    activeProjectRevisionRef.current = 0;
    setActiveProjectId(null);
    setActiveProjectName("");
    setActiveProjectRevision(0);
    setBrief(EMPTY_BRIEF);
    setPage(null);
    setLayout("editorial");
    markClean();
    setSaveStatus("idle");
    setNotice("");
    setProjectStorageError("");
  }

  function applyProject(project: ProjectRecord) {
    invalidateSectionResponses();
    advanceDirtyRevision();
    activeProjectIdRef.current = project.id;
    activeProjectRevisionRef.current = project.revision;
    setActiveProjectId(project.id);
    setActiveProjectName(project.name);
    setActiveProjectRevision(project.revision);
    setBrief(project.brief);
    setPage(pageFromProject(project));
    setLayout(project.layout);
    markClean();
    setSaveStatus("saved");
    setNotice("");
    setProjectStorageError("");
    setProjectManagerOpen(false);
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
    if (!page) {
      setProjectStorageError("Generate a website before saving a project.");
      return false;
    }
    try {
      const snapshot = projectSnapshotFromPage(brief, page, layout);
      const storage = getProjectStorage();
      const saved = activeProjectIdRef.current
        ? storage.save(activeProjectIdRef.current, snapshot, activeProjectRevisionRef.current)
        : storage.create(brief.businessName, snapshot);
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
    const exported = createWebsiteExport(page, layout, destination);
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
    if (!activeProjectId || !isDirty || !page || pendingTransition) return;
    const projectId = activeProjectId;
    const expectedRevision = activeProjectRevision;
    const version = dirtyRevision;
    const timer = window.setTimeout(() => {
      if (pendingTransitionRef.current || activeProjectIdRef.current !== projectId || dirtyRevisionRef.current !== version || activeProjectRevisionRef.current !== expectedRevision) return;
      setSaveStatus("saving");
      try {
        const snapshot = projectSnapshotFromPage(brief, page, layout);
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
  }, [activeProjectId, activeProjectRevision, brief, dirtyRevision, getProjectStorage, isDirty, layout, page, pendingTransition, refreshProjects, safeStorageMessage]);

  function updateBrief<K extends keyof BusinessBrief>(key: K, value: BusinessBrief[K]) {
    setBrief((current) => ({ ...current, [key]: value }));
    markDirty();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setNotice("");
    setLoading(true);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null || !("data" in result)) {
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "object" && result.error !== null && "message" in result.error && typeof result.error.message === "string"
          ? result.error.message
          : "We couldn’t generate your page right now. Please try again.";
        setNotice(message);
        return;
      }
      const generatedPage = GeneratedPageSchema.safeParse(result.data);
      if (!generatedPage.success) {
        setNotice("The generation service returned an invalid page. Please try again.");
        return;
      }
      for (const section of Object.keys(sectionEditRevisions.current) as EditableSection[]) {
        sectionEditRevisions.current[section] += 1;
      }
      setPage({ ...generatedPage.data, layout });
      markDirty();
      setNotice("Your landing page is ready.");
    } catch {
      setNotice("Couldn’t connect to the generation service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function changeLayout(next: GeneratedPage["layout"]) {
    setLayout(next);
    setPage((current) => current ? { ...current, layout: next } : current);
    markDirty();
  }

  function editGeneratedSection(section: EditableSection, value: string, featureIndex?: number) {
    sectionEditRevisions.current[section] += 1;
    setPage((current) => {
      if (!current) return current;
      if (section === "headline") return { ...current, headline: value };
      if (section === "description") return { ...current, subheadline: value };
      if (section === "callToAction") return { ...current, callToAction: value };
      if (featureIndex === undefined) return current;
      return { ...current, features: current.features.map((feature, index) => index === featureIndex ? value : feature) };
    });
    markDirty();
    setSectionState((current) => ({ ...current, [section]: { ...current[section], error: "" } }));
  }

  async function regenerateSection(section: EditableSection) {
    if (inFlightSections.current.has(section)) return;
    inFlightSections.current.add(section);
    const requestedRevision = sectionEditRevisions.current[section];
    setSectionState((current) => ({ ...current, [section]: { loading: true, error: "" } }));
    try {
      const response = await fetch("/api/regenerate-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief, section }),
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
      if (sectionEditRevisions.current[section] === requestedRevision) {
        markDirty();
        setPage((current) => current ? mergeGeneratedSectionIfUnchanged(
          current,
          section,
          validated.data,
          requestedRevision,
          sectionEditRevisions.current[section],
        ) : current);
      }
    } catch (error) {
      const safeMessage = error instanceof Error && [
        "AI generation is not configured on this server.",
        "The request could not be generated. Revise the brief and try again.",
        "The generation service returned invalid content. Please try again.",
        "The generation service returned an invalid section. Please try again.",
      ].includes(error.message) ? error.message : "We couldn’t regenerate this section. Please try again.";
      setSectionState((current) => ({ ...current, [section]: { loading: true, error: safeMessage } }));
    } finally {
      inFlightSections.current.delete(section);
      setSectionState((current) => ({ ...current, [section]: { ...current[section], loading: false } }));
    }
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
            <div className="project-toolbar-actions"><button type="button" onClick={() => setExportDialogOpen(true)} disabled={!page}>Export HTML</button><button type="button" onClick={saveCurrentProject} disabled={!page || saveStatus === "saving"}>Save Project</button><button type="button" onClick={showProjectManager}>My Projects</button><button type="button" onClick={confirmNewProject}>New Project</button></div>
          </div>
          {projectStorageError && <p className="project-storage-error page-storage-error" role="alert">{projectStorageError}</p>}
          <div className="prototype-note"><span className="note-icon">✦</span><span><strong>AI-powered page concepts.</strong> Your brief is used to create landing-page copy. Review generated content before publishing.</span><button type="button" aria-label="Dismiss generation note" onClick={(e) => e.currentTarget.parentElement?.remove()}>×</button></div>
          <div className="studio-grid" id="brief">
            <BriefForm brief={brief} onChange={updateBrief} onSubmit={submit} loading={loading} />
            <WebsitePreview page={page} layout={layout} onLayoutChange={changeLayout} loading={loading} sectionState={sectionState} onEdit={editGeneratedSection} onRegenerate={regenerateSection} />
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
      <ExportDialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} onExport={downloadWebsite} />
    </main>
  );
}
