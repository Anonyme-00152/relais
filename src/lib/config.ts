/** Réglages partagés client + serveur. Rien de secret ici. */

export const site = {
  name: "Relais",
  tagline: "Envoyez lourd. Partagez léger.",
  description:
    "Relais héberge vos fichiers et les transmet par simple lien : envoi sans compte, mot de passe, expiration, analyse du type réel et inspection des archives avant téléchargement.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://relais-fichiers.vercel.app",
} as const;

/** Hôte affiché dans les exemples (sans protocole). */
export const siteHost = new URL(site.url).host;

export const EXPIRY_OPTIONS = [
  { id: "1h", label: "1 heure", ms: 60 * 60 * 1000 },
  { id: "1d", label: "24 heures", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "7 jours", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "30d", label: "30 jours", ms: 30 * 24 * 60 * 60 * 1000 },
] as const;

export type ExpiryId = (typeof EXPIRY_OPTIONS)[number]["id"];
export const DEFAULT_EXPIRY: ExpiryId = "7d";

export function expiryMs(id: string): number | null {
  return EXPIRY_OPTIONS.find((o) => o.id === id)?.ms ?? null;
}

export const LIMITS = {
  /** Nombre maximal de fichiers dans un dépôt. */
  maxFiles: 500,
  titleMax: 80,
  messageMax: 600,
  passwordMin: 4,
  passwordMax: 128,
  nameMax: 240,
  /** Signalements distincts avant suspension automatique. */
  reportsToSuspend: 3,
  /** Taille des morceaux pour l'envoi local reprenable. */
  chunkSize: 8 * 1024 * 1024,
} as const;

export type Driver = "local" | "blob";

export type PublicConfig = {
  driver: Driver;
  maxFileSize: number;
  maxFolderSize: number;
  /** Taille maximale d'un envoi API en une seule requête. */
  maxDirectUpload: number;
  expiry: { id: string; label: string }[];
  chunkSize: number;
};
