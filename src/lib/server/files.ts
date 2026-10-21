import "server-only";
import { LIMITS } from "../config";
import { sanitizeName } from "../filetypes";
import type { FileRecord } from "../types";
import { analyzeFile, publicConfig, requireFolder, requireOwner, updateFolder } from "./folders";
import { HttpError } from "./http";
import { getStore, objectKey } from "./store";
import { publicId } from "./crypto";

export const FILE_ID = /^[A-Za-z0-9]{10}$/;

/** Prépare l'envoi d'un fichier : vérifie quotas et droits, attribue un identifiant. */
export async function initFile(req: Request, folderId: string, input: { name?: unknown; size?: unknown }) {
  const { rec } = await requireFolder(folderId);
  requireOwner(rec, req);
  const cfg = publicConfig();
  const name = sanitizeName(typeof input.name === "string" ? input.name : "", LIMITS.nameMax);
  const size = Number(input.size);
  if (!Number.isFinite(size) || size < 0) throw new HttpError(400, "bad_size", "Taille de fichier invalide.");
  if (size > cfg.maxFileSize) throw new HttpError(413, "file_too_large", "Ce fichier dépasse la taille maximale autorisée.");
  if (rec.files.length >= LIMITS.maxFiles) throw new HttpError(413, "too_many_files", `Un dépôt contient au plus ${LIMITS.maxFiles} fichiers.`);
  const used = rec.files.reduce((s, f) => s + f.size, 0);
  if (used + size > cfg.maxFolderSize) throw new HttpError(413, "folder_full", "Le dépôt dépasserait sa taille maximale.");
  const fileId = publicId(10);
  return { fileId, name, key: objectKey(folderId, fileId, name), driver: cfg.driver, chunkSize: cfg.chunkSize };
}

/** Enregistre un fichier entièrement reçu dans le dépôt, après analyse. */
export async function completeFile(
  req: Request,
  folderId: string,
  fileId: string,
  input: { name?: unknown; mime?: unknown; sha256?: unknown },
): Promise<FileRecord> {
  if (!FILE_ID.test(fileId)) throw new HttpError(400, "bad_file", "Identifiant de fichier invalide.");
  const { rec } = await requireFolder(folderId);
  requireOwner(rec, req);
  const existing = rec.files.find((f) => f.id === fileId);
  if (existing) return existing;

  const store = await getStore();
  const name = sanitizeName(typeof input.name === "string" ? input.name : "", LIMITS.nameMax);
  const key = objectKey(folderId, fileId, name);
  await store.finalizeObject(key);
  const size = await store.objectSize(key);
  if (size === null) throw new HttpError(409, "missing_upload", "Le fichier n'a pas été reçu entièrement. Relancez l'envoi.");

  const cfg = publicConfig();
  const used = rec.files.reduce((s, f) => s + f.size, 0);
  if (size > cfg.maxFileSize || used + size > cfg.maxFolderSize) {
    await store.deleteObjects([key]);
    throw new HttpError(413, "folder_full", "Le dépôt dépasserait sa taille maximale.");
  }

  const file = await analyzeFile({
    id: fileId,
    key,
    name,
    mime: typeof input.mime === "string" ? input.mime.slice(0, 120) : "",
    size,
    sha256: typeof input.sha256 === "string" ? input.sha256.toLowerCase() : null,
  });

  await updateFolder(folderId, (r) => {
    if (r.files.some((f) => f.id === fileId)) return false;
    r.files.push(file);
  });
  return file;
}
