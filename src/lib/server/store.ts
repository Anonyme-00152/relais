import "server-only";
import type { Driver } from "../config";
import type { FolderRecord } from "../types";

export type ServeOptions = {
  mime: string;
  filename: string;
  inline: boolean;
  size: number;
  range: string | null;
};

/** Contrat commun aux deux pilotes de stockage (disque local, Vercel Blob privé). */
export interface Store {
  driver: Driver;
  readFolder(id: string): Promise<{ rec: FolderRecord; etag: string } | null>;
  /** Écriture conditionnelle : false si quelqu'un a modifié le dépôt entre-temps. */
  writeFolder(rec: FolderRecord, etag: string | null): Promise<boolean>;
  deleteFolder(id: string): Promise<void>;
  listFolderIds(): Promise<string[]>;

  objectSize(key: string): Promise<number | null>;
  readRange(key: string, offset: number, length: number): Promise<Uint8Array>;
  /** Lit l'objet en flux (calcul d'empreinte côté serveur). */
  readStream(key: string): Promise<ReadableStream<Uint8Array> | null>;
  deleteObjects(keys: string[]): Promise<void>;
  serve(key: string, opts: ServeOptions): Promise<Response>;

  /** Envoi par morceaux (pilote local) ou direct (petits fichiers, pilote blob). */
  writeChunk(key: string, offset: number, body: ReadableStream<Uint8Array>, length: number | null): Promise<number>;
  finalizeObject(key: string): Promise<void>;
  /** Octets déjà reçus pour un envoi en cours (pilote local). */
  partSize?(key: string): Promise<number>;
}

let instance: Promise<Store> | null = null;

export function getStore(): Promise<Store> {
  if (!instance) {
    instance = process.env.BLOB_READ_WRITE_TOKEN
      ? import("./store-blob").then((m) => m.createBlobStore())
      : import("./store-local").then((m) => m.createLocalStore());
  }
  return instance;
}

export function currentDriver(): Driver {
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

/** Clé de stockage d'un fichier : jamais dérivée telle quelle du nom fourni. */
export function objectKey(folderId: string, fileId: string, name: string): string {
  const slug =
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 80) || "fichier";
  return `files/${folderId}/${fileId}/${slug}`;
}

export function contentDisposition(filename: string, inline: boolean): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** En-têtes appliqués à tout contenu servi : aucun script ne peut s'exécuter dans notre origine. */
export const SANDBOX_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; object-src 'self'",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Cache-Control": "private, no-store",
};

export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    const n = Number(m[2]);
    if (!n) return "invalid";
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}
