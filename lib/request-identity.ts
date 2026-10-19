export type RequestIdentity = {
  id: number;
  context: string;
};

export type RequestIdentityGuard = ReturnType<typeof createRequestIdentityGuard>;

/** Tracks one active request and invalidates it when its UI context changes. */
export function createRequestIdentityGuard() {
  let sequence = 0;
  let activeId: number | null = null;

  return {
    begin(context: string): RequestIdentity {
      const id = ++sequence;
      activeId = id;
      return { id, context };
    },
    invalidate() {
      sequence += 1;
      activeId = null;
    },
    isCurrent(identity: RequestIdentity, context: string) {
      return activeId === identity.id && identity.context === context;
    },
  };
}

/** Settles async work only while the request still belongs to the active context. */
export async function settleRequestWithIdentity<T>(
  request: () => Promise<T>,
  guard: RequestIdentityGuard,
  identity: RequestIdentity,
  getContext: () => string,
  onSuccess: (value: T) => void,
  onFailure: (error: unknown) => void,
) {
  let value: T;
  try {
    value = await request();
  } catch (error) {
    if (guard.isCurrent(identity, getContext())) onFailure(error);
    return;
  }
  if (guard.isCurrent(identity, getContext())) onSuccess(value);
}
