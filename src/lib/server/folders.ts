import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { DEFAULT_EXPIRY, expiryMs, LIMITS, type PublicConfig, EXPIRY_OPTIONS } from "../config";
import { categoryOf, extOf, maxRisk, nameRisk, type RiskLevel } from "../filetypes";
import { mismatch, sniff } from "../sniff";
import type { FileRecord, FolderRecord, FolderView } from "../types";
import { inspectZip } from "../zipinspect";
import { hashPassword, hmac, publicId, safeEqual, secretToken, sha256, verifyPassword } from "./crypto";
import { HttpError, rateLimit, clientIp } from "./http";
import { currentDriver, getStore } from "./store";

const GB = 1024 ** 3;

export function publicConfig(): PublicConfig {
  const driver = currentDriver();
  const env = (k: string, d: number) => Number(process.env[k]) || d;
  return {
    driver,
    maxFileSize: env("RELAIS_MAX_FILE", driver === "blob" ? 5 * GB : 20 * GB),
    maxFolderSize: env("RELAIS_MAX_FOLDER", driver === "blob" ? 10 * GB : 50 * GB),
    maxDirectUpload: driver === "blob" ? 4 * 1024 * 1024 : env("RELAIS_MAX_FILE", 20 * GB),
    expiry: EXPIRY_OPTIONS.map(({ id, label }) => ({ id, label })),
    chunkSize: LIMITS.chunkSize,
  };
}

/* ---------- Création, lecture, mise à jour ---------- */

export async function createFolder(input: { title?: string; message?: string; password?: string; expiresIn?: string }) {
  const store = await getStore();
  const ms = expiryMs(input.expiresIn ?? DEFAULT_EXPIRY);
  if (!ms) throw new HttpError(400, "bad_expiry", "Durée de conservation invalide.");
  const password = input.password ?? "";
  if (password && (password.length < LIMITS.passwordMin || password.length > LIMITS.passwordMax)) {
    throw new HttpError(400, "bad_password", `Le mot de passe doit faire entre ${LIMITS.passwordMin} et ${LIMITS.passwordMax} caractères.`);
  }
  const ownerToken = secretToken();
  const now = Date.now();
  for (let attempt = 0; attempt < 5; attempt++) {
    const rec: FolderRecord = {
      v: 1,
      id: publicId(8),
      createdAt: now,
      expiresAt: now + ms,
      title: (input.title ?? "").slice(0, LIMITS.titleMax),
      message: (input.message ?? "").slice(0, LIMITS.messageMax),
      passwordHash: password ? await hashPassword(password) : null,
      ownerHash: sha256(ownerToken),
      files: [],
      views: 0,
      reports: [],
      suspended: false,
    };
    if (await store.writeFolder(rec, null)) return { rec, ownerToken };
  }
  throw new HttpError(503, "busy", "Impossible de créer le dépôt, réessayez.");
}

/** Lit un dépôt ; un dépôt expiré est purgé à la volée et traité comme absent. */
export async function loadFolder(id: string): Promise<{ rec: FolderRecord; etag: string } | null> {
  if (!/^[A-Za-z0-9]{4,32}$/.test(id)) return null;
  const store = await getStore();
  const got = await store.readFolder(id);
  if (!got) return null;
  if (got.rec.expiresAt <= Date.now()) {
    await purgeFolder(got.rec).catch(() => {});
    return null;
  }
  return got;
}

export async function requireFolder(id: string) {
  const got = await loadFolder(id);
  if (!got) throw new HttpError(404, "not_found", "Ce lien n'existe pas ou a expiré.");
  return got;
}

/** Lecture-modification-écriture avec reprise en cas de conflit. */
export async function updateFolder(id: string, fn: (rec: FolderRecord) => void | false): Promise<FolderRecord> {
  const store = await getStore();
  for (let attempt = 0; attempt < 6; attempt++) {
    const { rec, etag } = await requireFolder(id);
    if (fn(rec) === false) return rec;
    if (await store.writeFolder(rec, etag)) return rec;
    await new Promise((r) => setTimeout(r, 40 * (attempt + 1) + Math.random() * 60));
  }
  throw new HttpError(409, "conflict", "Le dépôt est modifié en ce moment, réessayez.");
}

export async function purgeFolder(rec: FolderRecord) {
  const store = await getStore();
  await store.deleteObjects(rec.files.map((f) => f.key)).catch(() => {});
  await store.deleteFolder(rec.id);
}

/* ---------- Droits ---------- */

export function ownerTokenFrom(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return req.headers.get("x-owner-token");
}

export function isOwner(rec: FolderRecord, req: Request): boolean {
  const t = ownerTokenFrom(req);
  return !!t && safeEqual(sha256(t), rec.ownerHash);
}

export function requireOwner(rec: FolderRecord, req: Request) {
  if (!isOwner(rec, req)) throw new HttpError(403, "forbidden", "Clé de gestion invalide pour ce dépôt.");
}

export const accessCookie = (id: string) => `rl_${id}`;
const accessValue = (rec: FolderRecord) => hmac(`access:${rec.id}:${rec.passwordHash}`).slice(0, 32);

export async function setAccessCookie(rec: FolderRecord) {
  (await cookies()).set(accessCookie(rec.id), accessValue(rec), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
}

/** Vrai si le visiteur peut lire le contenu (dépôt ouvert, propriétaire, cookie ou en-tête mot de passe). */
export async function hasAccess(rec: FolderRecord, req: Request): Promise<boolean> {
  if (!rec.passwordHash) return true;
  if (isOwner(rec, req)) return true;
  const c = (await cookies()).get(accessCookie(rec.id))?.value;
  if (c && safeEqual(c, accessValue(rec))) return true;
  const header = req.headers.get("x-relais-password");
  if (header) {
    rateLimit(`pw:${rec.id}:${clientIp(req)}`, 10, 60_000);
    return verifyPassword(header, rec.passwordHash);
  }
  return false;
}

export async function requireAccess(rec: FolderRecord, req: Request) {
  if (rec.suspended && !isOwner(rec, req)) {
    throw new HttpError(451, "suspended", "Ce dépôt a été suspendu après plusieurs signalements.");
  }
  if (!(await hasAccess(rec, req))) throw new HttpError(401, "locked", "Ce dépôt est protégé par un mot de passe.");
}

/* ---------- Projection publique ---------- */

export function toView(rec: FolderRecord, opts: { owner: boolean; unlocked: boolean }): FolderView {
  const visible = opts.unlocked && (!rec.suspended || opts.owner);
  return {
    id: rec.id,
    createdAt: rec.createdAt,
    expiresAt: rec.expiresAt,
    title: rec.title,
    message: visible ? rec.message : "",
    protected: !!rec.passwordHash,
    unlocked: visible,
    isOwner: opts.owner,
    suspended: rec.suspended,
    fileCount: rec.files.length,
    totalSize: rec.files.reduce((s, f) => s + f.size, 0),
    files: visible ? rec.files.map(({ key: _key, ...f }) => f) : [],
    views: rec.views,
    downloads: rec.files.reduce((s, f) => s + f.downloads, 0),
    ...(opts.owner ? { reports: rec.reports.length } : {}),
  };
}

/* ---------- Analyse d'un fichier reçu ---------- */

/**
 * Inspecte un fichier fraîchement envoyé : type réel (octets), nom piégé,
 * contenu d'archive, empreinte SHA-256. Ne lit jamais le fichier entier,
 * sauf pour vérifier l'empreinte en stockage local.
 */
export async function analyzeFile(input: {
  id: string;
  key: string;
  name: string;
  mime: string;
  size: number;
  sha256: string | null;
}): Promise<FileRecord> {
  const store = await getStore();
  const head = await store.readRange(input.key, 0, Math.min(input.size, 64 * 1024));
  const detected = sniff(head);
  const warnings: string[] = [];
  const nr = nameRisk(input.name);
  let risk: RiskLevel = nr.level;
  warnings.push(...nr.reasons);

  const mm = mismatch(input.name, detected);
  if (mm) {
    warnings.unshift(mm);
    risk = maxRisk(risk, detected.executable ? "high" : "caution");
  }
  if (detected.executable && categoryOf(input.name) === "executable" && !warnings.length) {
    warnings.push(`Programme exécutable (${detected.label}).`);
  }
  if (detected.executable) risk = maxRisk(risk, "high");

  let archive = null;
  const ext = extOf(input.name);
  if (detected.format === "zip" && !["docx", "xlsx", "pptx", "odt", "ods", "odp", "epub"].includes(ext)) {
    archive = await inspectZip(input.size, (o, l) => store.readRange(input.key, o, l)).catch(() => null);
    if (archive) {
      if (archive.risky.length) {
        risk = maxRisk(risk, "high");
        warnings.push(
          `L'archive contient ${archive.risky.length > 1 ? `${archive.risky.length} éléments exécutables ou piégés` : "un élément exécutable ou piégé"} (${archive.risky
            .slice(0, 3)
            .map((r) => r.name.split("/").pop())
            .join(", ")}${archive.risky.length > 3 ? "…" : ""}).`,
        );
      }
      if (archive.encrypted) {
        risk = maxRisk(risk, "caution");
        warnings.push("Archive chiffrée : son contenu ne peut être vérifié par aucun antivirus avant extraction.");
      }
      if (archive.bomb) {
        risk = maxRisk(risk, "high");
        warnings.push("Taux de compression anormal : l'extraction pourrait saturer le disque (« bombe zip »).");
      }
    }
  } else if (["rar", "7z"].includes(detected.format ?? "")) {
    warnings.push("Le contenu des archives RAR et 7z n'est pas inspecté : vérifiez-le avant d'ouvrir quoi que ce soit.");
    risk = maxRisk(risk, "caution");
  }

  // Empreinte : recalculée par le serveur en local, déclarée par le navigateur sinon.
  let digest = input.sha256 && /^[a-f0-9]{64}$/.test(input.sha256) ? input.sha256 : null;
  let verified = false;
  if (store.driver === "local") {
    const stream = await store.readStream(input.key);
    if (stream) {
      const h = createHash("sha256");
      const reader = stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        h.update(value);
      }
      const real = h.digest("hex");
      if (digest && digest !== real) warnings.push("L'empreinte calculée par le navigateur ne correspondait pas : le fichier a été altéré pendant l'envoi.");
      digest = real;
      verified = true;
    }
  }

  return {
    id: input.id,
    name: input.name,
    size: input.size,
    mime: input.mime || "application/octet-stream",
    key: input.key,
    createdAt: Date.now(),
    downloads: 0,
    sha256: digest,
    hashVerified: verified,
    detected: detected.format ? { format: detected.format, label: detected.label! } : null,
    warnings,
    risk,
    archive,
  };
}

export { publicId };
