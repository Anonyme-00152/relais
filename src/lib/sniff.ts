import { categoryOf, extOf, type Category } from "./filetypes";

/**
 * Détection du type réel d'un fichier à partir de ses premiers octets
 * (« magic numbers »), indépendamment du nom choisi par l'expéditeur.
 */
export type Sniffed = {
  /** Identifiant court du format détecté, ou null s'il n'est pas reconnu. */
  format: string | null;
  label: string | null;
  category: Category | null;
  executable: boolean;
};

type Sig = { format: string; label: string; category: Category; executable?: boolean; test: (b: Uint8Array) => boolean };

const at = (b: Uint8Array, off: number, bytes: number[]) => bytes.every((v, i) => b[off + i] === v);
const ascii = (b: Uint8Array, off: number, s: string) => at(b, off, [...s].map((c) => c.charCodeAt(0)));

const SIGS: Sig[] = [
  { format: "pe", label: "exécutable Windows (PE)", category: "executable", executable: true, test: (b) => ascii(b, 0, "MZ") },
  { format: "elf", label: "exécutable Linux (ELF)", category: "executable", executable: true, test: (b) => at(b, 0, [0x7f, 0x45, 0x4c, 0x46]) },
  {
    format: "macho",
    label: "exécutable macOS (Mach-O)",
    category: "executable",
    executable: true,
    test: (b) => at(b, 0, [0xcf, 0xfa, 0xed, 0xfe]) || at(b, 0, [0xce, 0xfa, 0xed, 0xfe]) || at(b, 0, [0xca, 0xfe, 0xba, 0xbe]),
  },
  { format: "lnk", label: "raccourci Windows (LNK)", category: "executable", executable: true, test: (b) => at(b, 0, [0x4c, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00]) },
  { format: "msi", label: "document composé OLE (MSI, DOC, XLS)", category: "document", test: (b) => at(b, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) },
  { format: "shebang", label: "script exécutable", category: "code", executable: true, test: (b) => ascii(b, 0, "#!") },
  { format: "pdf", label: "PDF", category: "document", test: (b) => ascii(b, 0, "%PDF-") },
  { format: "png", label: "image PNG", category: "image", test: (b) => at(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { format: "jpeg", label: "image JPEG", category: "image", test: (b) => at(b, 0, [0xff, 0xd8, 0xff]) },
  { format: "gif", label: "image GIF", category: "image", test: (b) => ascii(b, 0, "GIF87a") || ascii(b, 0, "GIF89a") },
  { format: "webp", label: "image WebP", category: "image", test: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP") },
  { format: "wav", label: "audio WAV", category: "audio", test: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE") },
  { format: "avi", label: "vidéo AVI", category: "video", test: (b) => ascii(b, 0, "RIFF") && ascii(b, 8, "AVI ") },
  { format: "avif", label: "image AVIF", category: "image", test: (b) => ascii(b, 4, "ftypavif") || ascii(b, 4, "ftypavis") },
  { format: "heic", label: "image HEIC", category: "image", test: (b) => ascii(b, 4, "ftypheic") || ascii(b, 4, "ftypmif1") },
  { format: "mp4", label: "vidéo MP4/MOV", category: "video", test: (b) => ascii(b, 4, "ftyp") },
  { format: "mkv", label: "vidéo Matroska/WebM", category: "video", test: (b) => at(b, 0, [0x1a, 0x45, 0xdf, 0xa3]) },
  { format: "mp3", label: "audio MP3", category: "audio", test: (b) => ascii(b, 0, "ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { format: "flac", label: "audio FLAC", category: "audio", test: (b) => ascii(b, 0, "fLaC") },
  { format: "ogg", label: "audio/vidéo Ogg", category: "audio", test: (b) => ascii(b, 0, "OggS") },
  { format: "zip", label: "archive ZIP", category: "archive", test: (b) => at(b, 0, [0x50, 0x4b, 0x03, 0x04]) || at(b, 0, [0x50, 0x4b, 0x05, 0x06]) },
  { format: "rar", label: "archive RAR", category: "archive", test: (b) => ascii(b, 0, "Rar!\u001a\u0007") },
  { format: "7z", label: "archive 7z", category: "archive", test: (b) => at(b, 0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) },
  { format: "gzip", label: "archive gzip", category: "archive", test: (b) => at(b, 0, [0x1f, 0x8b]) },
  { format: "xz", label: "archive xz", category: "archive", test: (b) => at(b, 0, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) },
  { format: "bz2", label: "archive bzip2", category: "archive", test: (b) => ascii(b, 0, "BZh") },
  { format: "iso", label: "image disque ISO", category: "executable", test: (b) => b.length > 0x8006 && ascii(b, 0x8001, "CD001") },
  { format: "sqlite", label: "base SQLite", category: "data", test: (b) => ascii(b, 0, "SQLite format 3") },
];

export function sniff(head: Uint8Array): Sniffed {
  for (const s of SIGS) {
    if (s.test(head)) return { format: s.format, label: s.label, category: s.category, executable: !!s.executable };
  }
  return { format: null, label: null, category: null, executable: false };
}

/** Formats « conteneurs » dont l'extension réelle varie (docx = zip, etc.). */
const ZIP_BASED = new Set(["docx", "xlsx", "pptx", "odt", "ods", "odp", "epub", "jar", "apk", "zip", "pages", "key", "numbers", "xpi", "vsix", "ipa", "appx", "msix", "kmz", "3mf", "sketch", "whl", "nupkg", "docm", "xlsm", "pptm"]);
const OLE_BASED = new Set(["doc", "xls", "ppt", "msi", "msg", "pub", "vsd"]);

/**
 * Compare le type annoncé par l'extension et le type réel détecté.
 * Retourne un message lisible si le fichier se fait passer pour autre chose.
 */
export function mismatch(name: string, s: Sniffed): string | null {
  if (!s.format) return null;
  const ext = extOf(name);
  const claimed = categoryOf(name);

  if (s.executable) {
    if (claimed === "executable" || claimed === "code") return null;
    if (s.format === "shebang" && (claimed === "document" || claimed === "data" || claimed === "other")) return null;
    return `Ce fichier se présente comme ${ext ? `un .${ext}` : "un fichier sans extension"} mais contient en réalité un ${s.label}.`;
  }
  if (s.format === "zip" && ZIP_BASED.has(ext)) return null;
  if (s.format === "msi" && OLE_BASED.has(ext)) return null;
  if (s.format === "mp4" && ["mp4", "m4v", "mov", "m4a", "3gp", "heic", "avif"].includes(ext)) return null;
  if (s.format === "ogg" && ["ogg", "oga", "ogv", "opus"].includes(ext)) return null;
  if (s.format === "mkv" && ["mkv", "webm"].includes(ext)) return null;
  if (s.format === "gzip" && ["gz", "tgz"].includes(ext)) return null;
  if (s.format === "iso" && ["iso", "img"].includes(ext)) return null;
  if (claimed === "other" || claimed === "data") return null;
  if (s.category && s.category !== claimed && claimed !== "code") {
    return `L'extension .${ext} ne correspond pas au contenu détecté (${s.label}).`;
  }
  return null;
}
