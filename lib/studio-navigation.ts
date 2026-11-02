export type StudioNavigationTicket = {
  sequence: number;
  projectId: string | null;
  pageId: string;
  anchor?: string;
};

/** Identifies delayed cross-page scroll work so a newer navigation or project
 * transition can make any older animation callback harmless. */
export function createStudioNavigationCoordinator() {
  let sequence = 0;
  let current: StudioNavigationTicket | null = null;

  return {
    begin(projectId: string | null, pageId: string, anchor?: string): StudioNavigationTicket {
      const ticket = { sequence: ++sequence, projectId, pageId, anchor };
      current = ticket;
      return ticket;
    },
    invalidate() {
      sequence += 1;
      current = null;
    },
    isCurrent(ticket: StudioNavigationTicket, projectId: string | null, pageId: string) {
      return current === ticket
        && ticket.sequence === sequence
        && ticket.projectId === projectId
        && ticket.pageId === pageId;
    },
    finish(ticket: StudioNavigationTicket) {
      if (current !== ticket) return false;
      current = null;
      sequence += 1;
      return true;
    },
  };
}
