import type { RiskLevel } from "./filetypes";
import type { ZipReport } from "./zipinspect";

export type FileRecord = {
  id: string;
  name: string;
  size: number;
  mime: string;
  /** Chemin dans le stockage (jamais exposé au public). */
  key: string;
  createdAt: number;
  downloads: number;
  sha256: string | null;
  /** true si l'empreinte a été recalculée par le serveur. */
  hashVerified: boolean;
  detected: { format: string; label: string } | null;
  warnings: string[];
  risk: RiskLevel;
  archive: ZipReport | null;
};

export type FolderRecord = {
  v: 1;
  id: string;
  createdAt: number;
  expiresAt: number;
  title: string;
  message: string;
  passwordHash: string | null;
  ownerHash: string;
  files: FileRecord[];
  views: number;
  reports: { by: string; reason: string; at: number }[];
  suspended: boolean;
};

export type FileView = Omit<FileRecord, "key">;

export type FolderView = {
  id: string;
  createdAt: number;
  expiresAt: number;
  title: string;
  message: string;
  protected: boolean;
  /** false tant qu'un dépôt protégé n'est pas déverrouillé. */
  unlocked: boolean;
  isOwner: boolean;
  suspended: boolean;
  fileCount: number;
  totalSize: number;
  files: FileView[];
  views: number;
  downloads: number;
  reports?: number;
};

export type ApiError = { error: string; code: string };
