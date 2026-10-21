/** Classement des fichiers par famille + évaluation du risque à l'ouverture. */

export type Category = "image" | "video" | "audio" | "document" | "archive" | "code" | "executable" | "data" | "other";

const EXT: Record<Category, string[]> = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp", "ico", "heic", "heif", "tif", "tiff", "psd", "raw"],
  video: ["mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv", "mpeg", "mpg", "3gp"],
  audio: ["mp3", "wav", "flac", "ogg", "oga", "m4a", "aac", "opus", "wma", "aiff"],
  document: ["pdf", "doc", "docx", "odt", "rtf", "txt", "md", "xls", "xlsx", "ods", "csv", "ppt", "pptx", "odp", "epub", "pages", "key", "numbers"],
  archive: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst", "cab"],
  code: ["js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java", "kt", "c", "h", "cpp", "hpp", "cs", "php", "html", "htm", "css", "scss", "json", "yml", "yaml", "toml", "xml", "ini", "env", "sql", "sh", "lua", "swift", "dart", "vue", "svelte"],
  executable: ["exe", "msi", "bat", "cmd", "com", "scr", "pif", "ps1", "psm1", "vbs", "vbe", "wsf", "wsh", "hta", "jar", "apk", "app", "dmg", "pkg", "deb", "rpm", "appimage", "run", "lnk", "reg", "cpl", "msix", "appx", "iso", "img", "dll", "sys", "xll", "gadget"],
  data: ["sqlite", "db", "parquet", "bak", "dat", "bin", "log", "ndjson", "geojson", "gpx", "kml", "obj", "fbx", "glb", "gltf", "stl", "blend", "ttf", "otf", "woff", "woff2"],
  other: [],
};

const byExt = new Map<string, Category>();
for (const [cat, list] of Object.entries(EXT) as [Category, string[]][]) for (const e of list) byExt.set(e, cat);

export function extOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(i + 1).toLowerCase() : "";
}

export function categoryOf(name: string, mime = ""): Category {
  const fromExt = byExt.get(extOf(name));
  if (fromExt) return fromExt;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("text/")) return "document";
  return "other";
}

export const CATEGORY_LABEL: Record<Category, string> = {
  image: "Image",
  video: "Vidéo",
  audio: "Audio",
  document: "Document",
  archive: "Archive",
  code: "Code",
  executable: "Exécutable",
  data: "Données",
  other: "Fichier",
};

/** Extensions dont l'ouverture exécute du code sur la machine. */
const SCRIPTY = new Set(["js", "jse", "vbs", "vbe", "wsf", "wsh", "hta", "ps1", "psm1", "bat", "cmd", "sh", "scr", "pif", "com", "lnk", "reg", "cpl", "jar", "xll", "gadget", "msi", "exe", "dll", "apk", "dmg", "pkg", "appimage", "run", "msix", "appx", "iso", "img"]);
/** Documents Office pouvant contenir des macros. */
const MACRO = new Set(["docm", "xlsm", "pptm", "dotm", "xltm", "xlam", "ppam"]);
/** Extensions de leurre fréquemment placées avant une vraie extension exécutable. */
const DECOY = new Set(["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png", "gif", "mp4", "mp3", "txt", "zip", "rar"]);

export type RiskLevel = "none" | "caution" | "high";
export type Risk = { level: RiskLevel; reasons: string[] };

/**
 * Risque estimé d'après le nom seul (les octets sont analysés côté serveur
 * par `sniff`). Volontairement conservateur : un fichier sans risque apparent
 * n'est jamais présenté comme « sûr ».
 */
export function nameRisk(name: string): Risk {
  const reasons: string[] = [];
  const base = (name.split(/[\\/]/).pop() ?? name).toLowerCase();
  const parts = base.split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1] : "";
  let level: RiskLevel = "none";

  if (/[‪-‮⁦-⁩]/.test(name)) {
    reasons.push("Le nom contient un caractère invisible d'inversion de texte, une technique utilisée pour maquiller l'extension.");
    level = "high";
  }
  if (SCRIPTY.has(ext)) {
    reasons.push(`Un fichier .${ext} lance un programme ou un script à l'ouverture.`);
    level = "high";
  }
  if (parts.length > 2 && SCRIPTY.has(ext) && DECOY.has(parts[parts.length - 2])) {
    reasons.push(`Double extension « .${parts[parts.length - 2]}.${ext} » : le fichier imite un ${parts[parts.length - 2].toUpperCase()} mais reste un exécutable.`);
  }
  if (/\s{4,}\.[a-z0-9]+$/.test(base)) {
    reasons.push("De nombreux espaces précèdent l'extension, ce qui peut la cacher dans l'explorateur.");
    level = "high";
  }
  if (MACRO.has(ext)) {
    reasons.push(`Les fichiers .${ext} peuvent contenir des macros. N'activez pas le contenu si vous ne connaissez pas l'expéditeur.`);
    if (level === "none") level = "caution";
  }
  if (level === "none" && (ext === "svg" || ext === "html" || ext === "htm")) {
    reasons.push("Ouvert dans un navigateur, ce fichier peut contenir du script.");
    level = "caution";
  }
  return { level, reasons };
}

export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["none", "caution", "high"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

/** Types pouvant être affichés dans le navigateur sans risque pour le site. */
export function previewKind(name: string, mime: string): "image" | "video" | "audio" | "pdf" | "text" | null {
  const ext = extOf(name);
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (byExt.get(ext) === "code" || ["txt", "md", "csv", "log", "ndjson", "geojson"].includes(ext) || mime.startsWith("text/")) return "text";
  return null;
}

/** Type MIME servi pour l'aperçu en ligne (le texte est toujours servi en text/plain). */
export function inlineMime(name: string, mime: string): string {
  const kind = previewKind(name, mime);
  const ext = extOf(name);
  if (kind === "text") return "text/plain; charset=utf-8";
  if (kind === "pdf") return "application/pdf";
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif",
    bmp: "image/bmp", ico: "image/x-icon", svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    m4v: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4",
    aac: "audio/aac", flac: "audio/flac", opus: "audio/opus",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Nettoie un nom fourni par le client : pas de chemin, pas de caractères de contrôle. */
export function sanitizeName(raw: string, max = 240): string {
  let n = raw.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]+/g, "_").trim();
  n = n.replace(/^\.+/, "");
  if (!n) n = "fichier";
  if (n.length > max) {
    const ext = extOf(n);
    n = ext && ext.length < 12 ? `${n.slice(0, max - ext.length - 1)}.${ext}` : n.slice(0, max);
  }
  return n;
}
