"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ProjectRecord } from "@/lib/projects";

type ProjectManagerProps = {
  open: boolean;
  projects: ProjectRecord[];
  activeProjectId: string | null;
  storageError: string;
  projectsUnavailable: boolean;
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onRetry: () => void;
  onNewProject: () => void;
  onOpenProject: (id: string) => void;
  onRenameProject: (project: ProjectRecord, name: string) => boolean;
  onDeleteProject: (project: ProjectRecord) => void;
};

export function ProjectManager({
  open, projects, activeProjectId, storageError, projectsUnavailable, hasUnsavedChanges, onClose, onRetry, onNewProject, onOpenProject, onRenameProject, onDeleteProject,
}: ProjectManagerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    dialog?.focus();
  }, [open]);

  if (!open) return null;

  function submitRename(event: FormEvent<HTMLFormElement>, project: ProjectRecord) {
    event.preventDefault();
    if (onRenameProject(project, name)) setRenamingId(null);
  }

  return (
    <div className="project-overlay">
      <dialog ref={dialogRef} className="project-dialog" aria-labelledby="project-dialog-title" aria-modal="true" tabIndex={-1} onCancel={(event) => { event.preventDefault(); onClose(); }}>
        <header className="project-dialog-header">
          <div><div className="section-kicker">YOUR WORKSPACE</div><h2 id="project-dialog-title">My Projects</h2><p>Saved websites stay in this browser.</p></div>
          <button type="button" className="project-close" aria-label="Close projects" onClick={onClose}>×</button>
        </header>
        <div className="project-dialog-actions"><button className="generate-button" type="button" onClick={onNewProject}>New Project <span>＋</span></button></div>
        {storageError && <p className="project-storage-error" role="alert">{storageError}</p>}
        {projectsUnavailable ? <div className="project-empty"><strong>Saved projects could not be loaded.</strong><span>Stored data has not been changed. Check storage access or try again.</span><button type="button" onClick={onRetry}>Try again</button></div> : projects.length === 0 ? <div className="project-empty"><strong>No saved projects yet.</strong><span>Generate a website, then save it to find it here.</span></div> : <ul className="project-list">
          {projects.map((project) => <li key={project.id} className={project.id === activeProjectId ? "active" : ""}>
            {renamingId === project.id ? <form className="project-rename-form" onSubmit={(event) => submitRename(event, project)}>
              <label htmlFor={`project-name-${project.id}`}>Project name</label>
              <input id={`project-name-${project.id}`} autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
              <button type="submit" aria-label={`Save name for ${project.name}`}>Save name</button>
              <button type="button" onClick={() => setRenamingId(null)}>Cancel</button>
            </form> : <>
              <button className="project-open" type="button" onClick={() => onOpenProject(project.id)} aria-current={project.id === activeProjectId ? "page" : undefined}>
                <strong>{project.name}</strong><span>{project.brief.businessName} · {project.layout} layout</span>
                <time dateTime={project.updatedAt}>Updated {new Date(project.updatedAt).toLocaleString()}</time>
              </button>
              <div className="project-row-actions">
                <button type="button" onClick={() => { setName(project.name); setRenamingId(project.id); }}>Rename</button>
                <button type="button" className="danger" onClick={() => {
                  const warning = project.id === activeProjectId && hasUnsavedChanges
                    ? `Delete “${project.name}”? This also discards its unsaved changes and cannot be undone.`
                    : `Delete “${project.name}”? This cannot be undone.`;
                  if (window.confirm(warning)) onDeleteProject(project);
                }}>Delete</button>
              </div>
            </>}
          </li>)}
        </ul>}
        <footer className="project-dialog-footer"><span>{projects.length} {projects.length === 1 ? "project" : "projects"}</span><button type="button" onClick={onClose}>Done</button></footer>
      </dialog>
    </div>
  );
}
