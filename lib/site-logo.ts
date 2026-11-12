import { z } from "zod";

export const MAX_SITE_LOGO_BYTES = 2 * 1024 * 1024;
export const SiteLogoMimeTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);
export const SiteLogoAssetIdSchema = z.string().uuid();

export type SiteLogoMimeType = z.infer<typeof SiteLogoMimeTypeSchema>;
export type SiteLogoAsset = {
  assetId: string;
  mimeType: SiteLogoMimeType;
  dataUrl: string;
  bytes: Uint8Array;
};

export function siteLogoAssetDataUrl(mimeType: SiteLogoMimeType, bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export function isValidSiteLogoAsset(value: unknown): value is SiteLogoAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<SiteLogoAsset>;
  const mimeType = SiteLogoMimeTypeSchema.safeParse(asset.mimeType);
  if (!SiteLogoAssetIdSchema.safeParse(asset.assetId).success || !mimeType.success
    || !(asset.bytes instanceof Uint8Array) || asset.bytes.length === 0 || asset.bytes.length > MAX_SITE_LOGO_BYTES
    || siteLogoMimeTypeFromBytes(asset.bytes) !== mimeType.data || typeof asset.dataUrl !== "string") return false;
  return asset.dataUrl === siteLogoAssetDataUrl(mimeType.data, asset.bytes);
}

export type ValidatedSiteLogoFile = {
  blob: Blob;
  mimeType: SiteLogoMimeType;
  width: number;
  height: number;
};

export function siteLogoMimeTypeFromBytes(bytes: Uint8Array): SiteLogoMimeType | undefined {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return undefined;
}

async function decodeImage(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    try { return { width: bitmap.width, height: bitmap.height }; }
    finally { bitmap.close(); }
  }
  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") throw new Error("Logo preview is unavailable in this browser.");
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally { URL.revokeObjectURL(url); }
}

export async function validateSiteLogoFile(
  file: Pick<File, "size" | "type" | "arrayBuffer">,
  decoder: (blob: Blob) => Promise<{ width: number; height: number }> = decodeImage,
): Promise<ValidatedSiteLogoFile> {
  if (file.size === 0) throw new Error("Choose a non-empty PNG, JPEG, or WebP logo.");
  if (file.size > MAX_SITE_LOGO_BYTES) throw new Error("Logo files must be 2 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_SITE_LOGO_BYTES) throw new Error("The selected logo file is invalid or too large.");
  const mimeType = siteLogoMimeTypeFromBytes(bytes);
  if (!mimeType || (file.type && file.type !== mimeType)) throw new Error("Choose a valid PNG, JPEG, or WebP logo.");
  const blob = new Blob([bytes], { type: mimeType });
  let dimensions: { width: number; height: number };
  try { dimensions = await decoder(blob); }
  catch { throw new Error("This logo image could not be opened. Choose another image file."); }
  if (!Number.isInteger(dimensions.width) || !Number.isInteger(dimensions.height) || dimensions.width < 1 || dimensions.height < 1) {
    throw new Error("This logo image has invalid dimensions.");
  }
  return { blob, mimeType, ...dimensions };
}

export type StoredProjectLogo = ValidatedSiteLogoFile & { projectId: string; assetId: string };

const DATABASE_NAME = "weblander-ai-browser-assets";
const DATABASE_VERSION = 1;
const LOGO_STORE = "project-logos";

export type SiteLogoStorageErrorCode = "UNAVAILABLE" | "DENIED" | "QUOTA" | "FAILED" | "INTERRUPTED" | "DELETING";

const LOGO_STORAGE_MESSAGES: Record<SiteLogoStorageErrorCode, string> = {
  UNAVAILABLE: "Logo storage is unavailable in this browser.",
  DENIED: "The browser denied access to logo storage.",
  QUOTA: "There is not enough browser storage space to save this logo.",
  FAILED: "Logo storage could not complete the request. Please try again.",
  INTERRUPTED: "Logo storage was interrupted. Please try again.",
  DELETING: "This project is being deleted and cannot accept another logo.",
};

export class SiteLogoStorageError extends Error {
  constructor(public readonly code: SiteLogoStorageErrorCode) {
    super(LOGO_STORAGE_MESSAGES[code]);
    this.name = "SiteLogoStorageError";
  }
}

function safeStorageError(error?: unknown): SiteLogoStorageError {
  if (error instanceof SiteLogoStorageError) return error;
  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return new SiteLogoStorageError("QUOTA");
  if (name === "SecurityError" || name === "NotAllowedError") return new SiteLogoStorageError("DENIED");
  if (name === "AbortError") return new SiteLogoStorageError("INTERRUPTED");
  return new SiteLogoStorageError("FAILED");
}

function openLogoDatabase(getFactory: () => IDBFactory | undefined): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    try {
      const factory = getFactory();
      if (!factory) { reject(new SiteLogoStorageError("UNAVAILABLE")); return; }
      const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        try {
          const database = request.result;
          if (!database.objectStoreNames.contains(LOGO_STORE)) database.createObjectStore(LOGO_STORE, { keyPath: ["projectId", "assetId"] });
        } catch (error) {
          if (!settled) { settled = true; reject(safeStorageError(error)); }
          try { request.transaction?.abort(); } catch { /* The opening transaction may already be closed. */ }
        }
      };
      request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        settled = true;
        resolve(request.result);
      };
      request.onerror = () => { if (!settled) { settled = true; reject(safeStorageError(request.error)); } };
      request.onblocked = () => { if (!settled) { settled = true; reject(new SiteLogoStorageError("INTERRUPTED")); } };
    } catch (error) {
      if (!settled) { settled = true; reject(safeStorageError(error)); }
    }
  });
}

export function createSiteLogoStorage(getFactory: () => IDBFactory | undefined = () => typeof globalThis.indexedDB === "undefined" ? undefined : globalThis.indexedDB) {
  type UploadReservation = { state: "uploading" | "pending-save"; sequence: number };
  const reservations = new Map<string, Map<string, UploadReservation>>();
  const reservationSequences = new Map<string, number>();
  const deletingProjects = new Set<string>();
  const uploadWaiters = new Map<string, Array<() => void>>();

  const notifyUploadWaiters = (projectId: string) => {
    const projectReservations = reservations.get(projectId);
    if ([...(projectReservations?.values() ?? [])].some(({ state }) => state === "uploading")) return;
    uploadWaiters.get(projectId)?.splice(0).forEach((resolve) => resolve());
  };

  const withLogoStore = <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void, transaction: IDBTransaction) => void): Promise<T> =>
    openLogoDatabase(getFactory).then((database) => new Promise<T>((resolve, reject) => {
      let transaction: IDBTransaction;
      let value: T;
      let hasValue = false;
      let settled = false;
      const closeDatabase = () => { try { database.close(); } catch { /* Closing is best effort after a settled transaction. */ } };
      const finishError = (error: unknown) => {
        if (settled) return;
        settled = true;
        closeDatabase();
        reject(safeStorageError(error));
      };
      try { transaction = database.transaction(LOGO_STORE, mode); }
      catch (error) { finishError(error); return; }
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        closeDatabase();
        if (hasValue) resolve(value);
        else reject(new SiteLogoStorageError("FAILED"));
      };
      transaction.onerror = () => finishError(transaction.error);
      transaction.onabort = () => finishError(transaction.error ?? new SiteLogoStorageError("INTERRUPTED"));
      try {
        operation(transaction.objectStore(LOGO_STORE), (result) => { value = result; hasValue = true; }, finishError, transaction);
      } catch (error) {
        try { transaction.abort(); } catch { /* The transaction may already be closed. */ }
        finishError(error);
      }
    })).catch((error: unknown) => { throw safeStorageError(error); });

  const reserveProjectLogoUpload = (projectId: string, assetId: string) => {
    if (deletingProjects.has(projectId)) throw new SiteLogoStorageError("DELETING");
    const projectReservations = reservations.get(projectId) ?? new Map<string, UploadReservation>();
    const sequence = (reservationSequences.get(projectId) ?? 0) + 1;
    reservationSequences.set(projectId, sequence);
    projectReservations.set(assetId, { state: "uploading", sequence });
    reservations.set(projectId, projectReservations);
  };

  const getProjectLogoReservationCheckpoint = (projectId: string) => reservationSequences.get(projectId) ?? 0;

  const completeProjectLogoUpload = (projectId: string, assetId: string, savedForLater: boolean) => {
    const projectReservations = reservations.get(projectId);
    if (!projectReservations?.has(assetId)) return;
    if (savedForLater) projectReservations.set(assetId, { ...projectReservations.get(assetId)!, state: "pending-save" });
    else projectReservations.delete(assetId);
    if (projectReservations.size === 0) {
      reservations.delete(projectId);
    }
    notifyUploadWaiters(projectId);
  };

  const releasePendingProjectLogoReservations = (projectId: string, throughSequence = Number.POSITIVE_INFINITY) => {
    const projectReservations = reservations.get(projectId);
    if (!projectReservations) return;
    for (const [assetId, reservation] of projectReservations) {
      if (reservation.state === "pending-save" && reservation.sequence <= throughSequence) projectReservations.delete(assetId);
    }
    if (projectReservations.size === 0) {
      reservations.delete(projectId);
    }
    notifyUploadWaiters(projectId);
  };

  const pruneProjectLogos = async (projectId: string, keepAssetId: string | null | (() => string | null)) => {
    await withLogoStore<void>("readwrite", (store, resolve, reject, transaction) => {
      const request = store.openCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        try {
          const cursor = request.result;
          if (!cursor) { resolve(); return; }
          const record = cursor.value as StoredProjectLogo;
          const latestKeepId = typeof keepAssetId === "function" ? keepAssetId() : keepAssetId;
          const protectedAssets = reservations.get(projectId);
          if (record.projectId === projectId && record.assetId !== latestKeepId && !protectedAssets?.has(record.assetId)) cursor.delete();
          cursor.continue();
        } catch (error) {
          reject(error);
          try { transaction.abort(); } catch { /* It may already be closed. */ }
        }
      };
    });
  };

  const removeAllProjectLogos = async (projectId: string) => {
    deletingProjects.add(projectId);
    if ([...(reservations.get(projectId)?.values() ?? [])].some(({ state }) => state === "uploading")) {
      await new Promise<void>((resolve) => {
        const waiters = uploadWaiters.get(projectId) ?? [];
        waiters.push(resolve);
        uploadWaiters.set(projectId, waiters);
        notifyUploadWaiters(projectId);
      });
    }
    reservations.delete(projectId);
    await pruneProjectLogos(projectId, null);
  };

  return {
    storeProjectLogo: async (projectId: string, assetId: string, file: ValidatedSiteLogoFile) => {
      await withLogoStore<void>("readwrite", (store, resolve, reject) => {
        const request = store.put({ ...file, projectId, assetId } satisfies StoredProjectLogo);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
    loadProjectLogo: (projectId: string, assetId: string) => withLogoStore<StoredProjectLogo | null>("readonly", (store, resolve, reject) => {
      const request = store.get([projectId, assetId]);
      request.onsuccess = () => resolve((request.result as StoredProjectLogo | undefined) ?? null);
      request.onerror = () => reject(request.error);
    }),
    removeProjectLogo: async (projectId: string, assetId: string) => {
      await withLogoStore<void>("readwrite", (store, resolve, reject) => {
        const request = store.delete([projectId, assetId]);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
    pruneProjectLogos,
    removeAllProjectLogos,
    reserveProjectLogoUpload,
    completeProjectLogoUpload,
    releasePendingProjectLogoReservations,
    getProjectLogoReservationCheckpoint,
  };
}

const browserLogoStorage = createSiteLogoStorage();
export const storeProjectLogo = browserLogoStorage.storeProjectLogo;
export const loadProjectLogo = browserLogoStorage.loadProjectLogo;
export const removeProjectLogo = browserLogoStorage.removeProjectLogo;
export const pruneProjectLogos = browserLogoStorage.pruneProjectLogos;
export const removeAllProjectLogos = browserLogoStorage.removeAllProjectLogos;
export const reserveProjectLogoUpload = browserLogoStorage.reserveProjectLogoUpload;
export const completeProjectLogoUpload = browserLogoStorage.completeProjectLogoUpload;
export const releasePendingProjectLogoReservations = browserLogoStorage.releasePendingProjectLogoReservations;
export const getProjectLogoReservationCheckpoint = browserLogoStorage.getProjectLogoReservationCheckpoint;

export async function siteLogoAssetFromStored(record: StoredProjectLogo): Promise<SiteLogoAsset> {
  const validated = await validateSiteLogoFile(record.blob, decodeImage);
  const bytes = new Uint8Array(await validated.blob.arrayBuffer());
  return {
    assetId: record.assetId,
    mimeType: validated.mimeType,
    bytes,
    dataUrl: siteLogoAssetDataUrl(validated.mimeType, bytes),
  };
}
