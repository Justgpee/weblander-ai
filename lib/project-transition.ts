export type ProjectTransition = { type: "new" } | { type: "open"; id: string } | { type: "delete"; id: string };

export type TransitionRequest =
  | { kind: "confirm"; transition: ProjectTransition }
  | { kind: "proceed"; transition: ProjectTransition };

export function requestProjectTransition(isDirty: boolean, transition: ProjectTransition): TransitionRequest {
  return isDirty ? { kind: "confirm", transition } : { kind: "proceed", transition };
}

export async function resolveProjectTransition(
  choice: "save" | "discard" | "keep",
  save: () => boolean | Promise<boolean>,
): Promise<boolean> {
  if (choice === "keep") return false;
  if (choice === "discard") return true;
  try {
    return await save();
  } catch {
    return false;
  }
}
