import { describe, expect, it } from "vitest";
import { createSiteLogoStorage, SiteLogoStorageError, type ValidatedSiteLogoFile } from "@/lib/site-logo";
import { createFakeIndexedDB } from "@/tests/fake-indexeddb";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const projectOne = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectTwo = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function validFile(byte = 1): ValidatedSiteLogoFile {
  return { blob: new Blob([Uint8Array.from([byte])], { type: "image/png" }), mimeType: "image/png", width: 40, height: 40 };
}

async function store(storage: ReturnType<typeof createSiteLogoStorage>, projectId: string, assetId: string, byte = 1) {
  await storage.storeProjectLogo(projectId, assetId, validFile(byte));
}

describe("project-scoped IndexedDB logo lifecycle", () => {
  it("turns missing and denied IndexedDB access into safe promise rejections", async () => {
    const unavailable = createSiteLogoStorage(() => undefined);
    await expect(unavailable.loadProjectLogo(projectOne, firstId)).rejects.toMatchObject({ code: "UNAVAILABLE" });
    const denied = createSiteLogoStorage(() => { throw new DOMException("private browser detail", "SecurityError"); });
    await expect(denied.loadProjectLogo(projectOne, firstId)).rejects.toMatchObject({ code: "DENIED" });
    await expect(denied.loadProjectLogo(projectOne, firstId)).rejects.toThrow("browser denied access");
  });

  it("normalizes synchronous open, asynchronous open and transaction failures", async () => {
    const synchronous = createFakeIndexedDB({ openThrow: { name: "SecurityError" } });
    await expect(createSiteLogoStorage(() => synchronous.factory).loadProjectLogo(projectOne, firstId)).rejects.toBeInstanceOf(SiteLogoStorageError);
    const asynchronous = createFakeIndexedDB({ openFailure: { name: "UnknownError" } });
    await expect(createSiteLogoStorage(() => asynchronous.factory).loadProjectLogo(projectOne, firstId)).rejects.toMatchObject({ code: "FAILED" });
    const transaction = createFakeIndexedDB({ transactionThrow: { name: "SecurityError" } });
    await expect(createSiteLogoStorage(() => transaction.factory).loadProjectLogo(projectOne, firstId)).rejects.toMatchObject({ code: "DENIED" });
  });

  it("saves, loads, replaces, removes and isolates project records", async () => {
    const fake = createFakeIndexedDB();
    const storage = createSiteLogoStorage(() => fake.factory);
    await store(storage, projectOne, firstId, 1);
    await store(storage, projectOne, secondId, 2);
    await store(storage, projectTwo, firstId, 3);
    expect((await storage.loadProjectLogo(projectOne, firstId))?.blob.size).toBe(1);
    expect(await storage.loadProjectLogo(projectOne, "33333333-3333-4333-8333-333333333333")).toBeNull();
    expect((await storage.loadProjectLogo(projectTwo, firstId))?.blob.size).toBe(1);
    await storage.removeProjectLogo(projectOne, firstId);
    expect(await storage.loadProjectLogo(projectOne, firstId)).toBeNull();
    expect(await storage.loadProjectLogo(projectTwo, firstId)).not.toBeNull();
  });

  it("protects a replacement during stale autosave cleanup, then removes only superseded assets", async () => {
    const fake = createFakeIndexedDB();
    const storage = createSiteLogoStorage(() => fake.factory);
    await store(storage, projectOne, firstId, 1);
    storage.reserveProjectLogoUpload(projectOne, secondId);
    await store(storage, projectOne, secondId, 2);

    // An old autosave snapshot still points at firstId while the replacement is uploading.
    await storage.pruneProjectLogos(projectOne, firstId);
    storage.releasePendingProjectLogoReservations(projectOne, 0);
    await storage.pruneProjectLogos(projectOne, firstId);
    expect(await storage.loadProjectLogo(projectOne, secondId)).not.toBeNull();

    storage.completeProjectLogoUpload(projectOne, secondId, true);
    let persistedReference = secondId;
    const committedCheckpoint = storage.getProjectLogoReservationCheckpoint(projectOne);
    await storage.pruneProjectLogos(projectOne, () => persistedReference);
    storage.releasePendingProjectLogoReservations(projectOne, committedCheckpoint);
    await storage.pruneProjectLogos(projectOne, () => persistedReference);
    expect(await storage.loadProjectLogo(projectOne, firstId)).toBeNull();
    expect(await storage.loadProjectLogo(projectOne, secondId)).not.toBeNull();

    persistedReference = firstId;
    await storage.pruneProjectLogos(projectOne, () => persistedReference);
    expect(await storage.loadProjectLogo(projectOne, secondId)).toBeNull();
  });

  it("keeps rapid replacements pinned until the newest reference is saved", async () => {
    const fake = createFakeIndexedDB();
    const storage = createSiteLogoStorage(() => fake.factory);
    for (const assetId of [firstId, secondId]) {
      storage.reserveProjectLogoUpload(projectOne, assetId);
      await store(storage, projectOne, assetId);
      storage.completeProjectLogoUpload(projectOne, assetId, true);
    }
    await storage.pruneProjectLogos(projectOne, null);
    expect(await storage.loadProjectLogo(projectOne, firstId)).not.toBeNull();
    expect(await storage.loadProjectLogo(projectOne, secondId)).not.toBeNull();
    storage.releasePendingProjectLogoReservations(projectOne);
    await storage.pruneProjectLogos(projectOne, secondId);
    expect(await storage.loadProjectLogo(projectOne, firstId)).toBeNull();
    expect(await storage.loadProjectLogo(projectOne, secondId)).not.toBeNull();
  });

  it("waits for an active upload before idempotent project-scoped deletion", async () => {
    const fake = createFakeIndexedDB();
    const storage = createSiteLogoStorage(() => fake.factory);
    storage.reserveProjectLogoUpload(projectOne, firstId);
    await store(storage, projectOne, firstId);
    await store(storage, projectTwo, firstId, 2);
    let finished = false;
    const deletion = storage.removeAllProjectLogos(projectOne).then(() => { finished = true; });
    await Promise.resolve();
    expect(finished).toBe(false);
    storage.completeProjectLogoUpload(projectOne, firstId, false);
    await deletion;
    await storage.removeAllProjectLogos(projectOne);
    expect(await storage.loadProjectLogo(projectOne, firstId)).toBeNull();
    expect(await storage.loadProjectLogo(projectTwo, firstId)).not.toBeNull();
    expect(() => storage.reserveProjectLogoUpload(projectOne, secondId)).toThrow(SiteLogoStorageError);
  });

  it("reports quota and aborted transaction failures with safe codes", async () => {
    const quota = createFakeIndexedDB({ requestFailure: { name: "QuotaExceededError" } });
    await expect(store(createSiteLogoStorage(() => quota.factory), projectOne, firstId)).rejects.toMatchObject({ code: "QUOTA" });
    const aborted = createFakeIndexedDB({ requestFailure: { name: "AbortError" } });
    await expect(store(createSiteLogoStorage(() => aborted.factory), projectOne, firstId)).rejects.toMatchObject({ code: "INTERRUPTED" });
  });
});
