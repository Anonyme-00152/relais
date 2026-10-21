import { categoryOf, nameRisk } from "./filetypes";

/**
 * Lecture du répertoire central d'une archive ZIP sans la décompresser :
 * seuls la fin du fichier et l'index sont lus (quelques Ko, même pour une
 * archive de plusieurs Go). Gère ZIP64.
 */

export type Reader = (offset: number, length: number) => Promise<Uint8Array>;

export type ZipEntry = { name: string; size: number; dir: boolean };

export type ZipReport = {
  entries: number;
  totalSize: number;
  compressedSize: number;
  encrypted: boolean;
  /** Entrées dont l'ouverture exécuterait du code, ou au nom piégé. */
  risky: { name: string; reason: string }[];
  nestedArchives: number;
  /** Ratio de compression anormal : possible « bombe zip ». */
  bomb: boolean;
  list: ZipEntry[];
  truncated: boolean;
};

const LIST_MAX = 300;
const CD_MAX = 16 * 1024 * 1024;

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u64 = (b: Uint8Array, o: number) => u32(b, o) + u32(b, o + 4) * 2 ** 32;

const utf8 = new TextDecoder("utf-8", { fatal: false });
const latin1 = new TextDecoder("latin1");

export async function inspectZip(size: number, read: Reader): Promise<ZipReport | null> {
  if (size < 22) return null;
  const tailLen = Math.min(size, 65535 + 22 + 20);
  const tailStart = size - tailLen;
  const tail = await read(tailStart, tailLen);

  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  let total = u16(tail, eocd + 10);
  let cdSize = u32(tail, eocd + 12);
  let cdOffset = u32(tail, eocd + 16);

  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const loc = eocd - 20;
    if (loc >= 0 && u32(tail, loc) === 0x07064b50) {
      const z64Off = u64(tail, loc + 8);
      const z64 = await read(z64Off, 56);
      if (u32(z64, 0) === 0x06064b50) {
        total = u64(z64, 32);
        cdSize = u64(z64, 40);
        cdOffset = u64(z64, 48);
      }
    }
  }
  if (cdOffset + cdSize > size) return null;

  const cd = await read(cdOffset, Math.min(cdSize, CD_MAX));
  const report: ZipReport = {
    entries: 0,
    totalSize: 0,
    compressedSize: 0,
    encrypted: false,
    risky: [],
    nestedArchives: 0,
    bomb: false,
    list: [],
    truncated: cdSize > CD_MAX,
  };

  let p = 0;
  while (p + 46 <= cd.length && u32(cd, p) === 0x02014b50) {
    const flags = u16(cd, p + 8);
    let comp = u32(cd, p + 20);
    let raw = u32(cd, p + 24);
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    if (p + 46 + nameLen > cd.length) break;
    const nameBytes = cd.subarray(p + 46, p + 46 + nameLen);
    const name = (flags & 0x800 ? utf8 : latin1).decode(nameBytes);

    // Tailles ZIP64 dans le champ « extra » 0x0001.
    if (raw === 0xffffffff || comp === 0xffffffff) {
      let e = p + 46 + nameLen;
      const end = e + extraLen;
      while (e + 4 <= end && e + 4 <= cd.length) {
        const id = u16(cd, e);
        const len = u16(cd, e + 2);
        if (id === 0x0001) {
          let q = e + 4;
          if (raw === 0xffffffff) { raw = u64(cd, q); q += 8; }
          if (comp === 0xffffffff) { comp = u64(cd, q); }
          break;
        }
        e += 4 + len;
      }
    }

    const dir = name.endsWith("/");
    report.entries++;
    report.totalSize += raw;
    report.compressedSize += comp;
    if (flags & 0x1) report.encrypted = true;
    if (!dir) {
      const risk = nameRisk(name);
      if (risk.level === "high" && report.risky.length < 50) report.risky.push({ name, reason: risk.reasons[0] });
      if (categoryOf(name) === "archive") report.nestedArchives++;
      if (/(^|\/)\.\.(\/|$)/.test(name) || name.startsWith("/")) {
        report.risky.push({ name, reason: "Chemin hors de l'archive (« zip slip ») : peut écraser des fichiers à l'extraction." });
      }
    }
    if (report.list.length < LIST_MAX) report.list.push({ name, size: raw, dir });
    p += 46 + nameLen + extraLen + commentLen;
  }

  if (report.entries < total) report.truncated = true;
  report.bomb = report.totalSize > 1024 ** 3 && report.compressedSize > 0 && report.totalSize / report.compressedSize > 100;
  return report;
}
