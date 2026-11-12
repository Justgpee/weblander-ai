import { Zip, ZipDeflate, ZipPassThrough } from "fflate";
import type { WebsiteArchiveFile } from "@/lib/website-export";

const encoder = new TextEncoder();

/** Build a streaming ZIP so binary assets are not expanded into base64 again. */
export function createWebsiteZipBlob(files: readonly WebsiteArchiveFile[]): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const zip = new Zip((error, data, final) => {
      if (error) {
        zip.terminate();
        reject(error);
        return;
      }
      chunks.push(data);
      if (final) resolve(new Blob(chunks.map((chunk) => chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer), { type: "application/zip" }));
    });
    try {
      for (const file of files) {
        const stream = file.compression === "store"
          ? new ZipPassThrough(file.path)
          : new ZipDeflate(file.path, { level: 6 });
        zip.add(stream);
        stream.push(typeof file.data === "string" ? encoder.encode(file.data) : file.data, true);
      }
      zip.end();
    } catch (error) {
      zip.terminate();
      reject(error);
    }
  });
}

type DownloadAnchor = { href: string; download: string; hidden: boolean; click(): void; remove(): void };
export type WebsiteDownloadPlatform = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): DownloadAnchor;
  append(anchor: DownloadAnchor): void;
  setTimeout(callback: () => void, delay: number): unknown;
};

export function downloadWebsiteZip(blob: Blob, filename: string, platform: WebsiteDownloadPlatform = {
  createObjectURL: (value) => URL.createObjectURL(value),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  createAnchor: () => document.createElement("a"),
  append: (anchor) => document.body.append(anchor as HTMLAnchorElement),
  setTimeout: (callback, delay) => window.setTimeout(callback, delay),
}) {
  const objectUrl = platform.createObjectURL(blob);
  const anchor = platform.createAnchor();
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.hidden = true;
  platform.append(anchor);
  anchor.click();
  anchor.remove();
  platform.setTimeout(() => platform.revokeObjectURL(objectUrl), 1000);
}
