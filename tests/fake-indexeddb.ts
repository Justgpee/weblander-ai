type FakeRequest<T = unknown> = {
  result: T;
  error: DOMException | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded: (() => void) | null;
};

type FakeFailure = { name: string; message?: string };
type FakeOptions = {
  openThrow?: FakeFailure;
  openFailure?: FakeFailure;
  transactionThrow?: FakeFailure;
  requestFailure?: FakeFailure;
};

function domError(failure: FakeFailure) {
  return new DOMException(failure.message ?? "fake browser failure", failure.name);
}

function makeRequest<T = unknown>(): FakeRequest<T> {
  return { result: undefined as T, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
}

class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  error: DOMException | null = null;
  private pending = 0;
  private ended = false;

  constructor(private readonly rows: Map<string, unknown>, private readonly options: FakeOptions) {}

  private queue(operation: () => void, request: FakeRequest) {
    this.pending += 1;
    queueMicrotask(() => {
      if (this.ended) return;
      if (this.options.requestFailure) {
        const error = domError(this.options.requestFailure);
        request.error = error;
        this.error = error;
        request.onerror?.();
        this.onerror?.();
        this.ended = true;
        this.onabort?.();
        return;
      }
      try {
        operation();
        request.onsuccess?.();
      } catch (error) {
        const failure = error instanceof DOMException ? error : new DOMException("fake operation failure", "UnknownError");
        request.error = failure;
        this.error = failure;
        request.onerror?.();
        this.onerror?.();
        this.ended = true;
        this.onabort?.();
        return;
      }
      this.pending -= 1;
      this.maybeComplete();
    });
  }

  private maybeComplete() {
    if (this.ended || this.pending !== 0) return;
    queueMicrotask(() => {
      if (this.ended || this.pending !== 0) return;
      this.ended = true;
      this.oncomplete?.();
    });
  }

  objectStore() {
    return {
      put: (value: { projectId: string; assetId: string }) => {
        const request = makeRequest();
        this.queue(() => { this.rows.set(JSON.stringify([value.projectId, value.assetId]), structuredClone(value)); }, request);
        return request;
      },
      get: (key: IDBValidKey) => {
        const request = makeRequest<unknown>();
        this.queue(() => { request.result = structuredClone(this.rows.get(JSON.stringify(key)) ?? undefined); }, request);
        return request;
      },
      delete: (key: IDBValidKey) => {
        const request = makeRequest();
        this.queue(() => { this.rows.delete(JSON.stringify(key)); }, request);
        return request;
      },
      openCursor: () => {
        const request = makeRequest<FakeCursor | null>();
        const entries = [...this.rows.entries()];
        let index = 0;
        const emit = () => {
          if (index >= entries.length) { request.result = null; request.onsuccess?.(); return; }
          const [key, value] = entries[index]!;
          request.result = new FakeCursor(key, structuredClone(value), () => this.rows.delete(key), () => {
            index += 1;
            this.pending += 1;
            queueMicrotask(() => {
              this.pending -= 1;
              emit();
              this.maybeComplete();
            });
          }, this);
          request.onsuccess?.();
        };
        this.pending += 1;
        queueMicrotask(() => {
          this.pending -= 1;
          emit();
          this.maybeComplete();
        });
        return request;
      },
    };
  }

  abort() {
    if (this.ended) throw new DOMException("transaction closed", "InvalidStateError");
    this.ended = true;
    this.error = new DOMException("transaction aborted", "AbortError");
    this.onabort?.();
  }

  enqueueDelete(key: string, request: FakeRequest) {
    this.queue(() => { this.rows.delete(key); }, request);
  }
}

class FakeCursor {
  constructor(
    readonly key: IDBValidKey,
    readonly value: unknown,
    private readonly deleteRow: () => void,
    private readonly nextRow: () => void,
    private readonly transaction: FakeTransaction,
  ) {}
  delete() {
    const request = makeRequest();
    this.transaction.enqueueDelete(String(this.key), request);
    this.deleteRow();
    return request;
  }
  continue() { this.nextRow(); }
}

export function createFakeIndexedDB(options: FakeOptions = {}) {
  const rows = new Map<string, unknown>();
  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => ({}),
    close: () => {},
    transaction: () => {
      if (options.transactionThrow) throw domError(options.transactionThrow);
      const transaction = new FakeTransaction(rows, options);
      return transaction as unknown as IDBTransaction & { objectStore: () => unknown };
    },
  };
  const factory = {
    open: () => {
      if (options.openThrow) throw domError(options.openThrow);
      const request = makeRequest<typeof database>();
      queueMicrotask(() => {
        if (options.openFailure) {
          request.error = domError(options.openFailure);
          request.onerror?.();
          return;
        }
        request.result = database;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
  return { factory: factory as unknown as IDBFactory, rows };
}
