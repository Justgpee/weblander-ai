import { describe, expect, it, vi } from "vitest";
import { requestProjectTransition, resolveProjectTransition, type ProjectTransition } from "@/lib/project-transition";

describe("project transitions with unsaved changes", () => {
  const newProject: ProjectTransition = { type: "new" };
  const anotherProject: ProjectTransition = { type: "open", id: "another-project" };
  const deleteCurrentProject: ProjectTransition = { type: "delete", id: "current-project" };

  it("requires confirmation before New Project and retains the current content until a choice", () => {
    const activeProject = { id: "current-project", headline: "My unsaved headline" };
    const request = requestProjectTransition(true, newProject);
    expect(request).toEqual({ kind: "confirm", transition: newProject });
    expect(activeProject).toEqual({ id: "current-project", headline: "My unsaved headline" });
  });

  it("uses the same confirmation guard when opening another project", () => {
    expect(requestProjectTransition(true, anotherProject)).toEqual({ kind: "confirm", transition: anotherProject });
  });

  it("uses the same confirmation guard before deleting the active dirty project", () => {
    expect(requestProjectTransition(true, deleteCurrentProject)).toEqual({ kind: "confirm", transition: deleteCurrentProject });
  });

  it("keeps the active project and edits when the user chooses Keep Editing", async () => {
    const activeProject = { id: "current-project", headline: "Edited headline" };
    const save = vi.fn(() => true);
    expect(await resolveProjectTransition("keep", save)).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(activeProject).toEqual({ id: "current-project", headline: "Edited headline" });
  });

  it("proceeds after explicit discard without saving abandoned edits", async () => {
    const save = vi.fn(() => true);
    expect(await resolveProjectTransition("discard", save)).toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(requestProjectTransition(false, newProject)).toEqual({ kind: "proceed", transition: newProject });
  });

  it("waits for Save to succeed before allowing the requested transition", async () => {
    let saved = false;
    const save = vi.fn(async () => {
      await Promise.resolve();
      saved = true;
      return true;
    });
    const canProceed = await resolveProjectTransition("save", save);
    expect(save).toHaveBeenCalledOnce();
    expect(saved).toBe(true);
    expect(canProceed).toBe(true);
  });

  it("does not proceed when saving fails or rejects", async () => {
    const failedSave = vi.fn(() => false);
    expect(await resolveProjectTransition("save", failedSave)).toBe(false);
    const rejectedSave = vi.fn(async () => { throw new Error("storage internals"); });
    expect(await resolveProjectTransition("save", rejectedSave)).toBe(false);
  });

  it("does not falsely prompt after a saved project is loaded cleanly", () => {
    expect(requestProjectTransition(false, newProject)).toEqual({ kind: "proceed", transition: newProject });
  });
});
