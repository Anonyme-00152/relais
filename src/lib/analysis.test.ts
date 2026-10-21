import { makeZip } from "client-zip";
import { describe, expect, it } from "vitest";
import { categoryOf, nameRisk, previewKind, sanitizeName } from "./filetypes";
import { formatBytes, formatDuration, middleEllipsis } from "./format";
import { mismatch, sniff } from "./sniff";
import { inspectZip } from "./zipinspect";

const bytes = (...b: (number | string)[]) =>
  new Uint8Array(b.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe("format", () => {
  it("formate les tailles en base 1024, à la française", () => {
    expect(formatBytes(0)).toBe("0 o");
    expect(formatBytes(1536)).toBe("1,5 Ko");
    expect(formatBytes(5 * 1024 ** 3)).toBe("5 Go");
    expect(formatBytes(250 * 1024 ** 2)).toBe("250 Mo");
  });
  it("formate les durées", () => {
    expect(formatDuration(42)).toBe("42 s");
    expect(formatDuration(75)).toBe("1 min 15 s");
    expect(formatDuration(3600 * 26)).toBe("1 j 2 h");
  });
  it("garde l'extension visible quand le nom est tronqué", () => {
    const s = middleEllipsis("un-nom-de-fichier-vraiment-beaucoup-trop-long-pour-la-liste.tar.gz", 30);
    expect(s.length).toBeLessThanOrEqual(30);
    expect(s.endsWith(".gz")).toBe(true);
  });
});

describe("filetypes", () => {
  it("classe par extension puis par type MIME", () => {
    expect(categoryOf("photo.JPG")).toBe("image");
    expect(categoryOf("setup.exe")).toBe("executable");
    expect(categoryOf("sans-extension", "video/mp4")).toBe("video");
  });
  it("repère les exécutables et les doubles extensions", () => {
    const r = nameRisk("facture.pdf.exe");
    expect(r.level).toBe("high");
    expect(r.reasons.join(" ")).toMatch(/Double extension/);
  });
  it("repère l'inversion de texte unicode (RLO)", () => {
    expect(nameRisk("photo‮gpj.exe").level).toBe("high");
  });
  it("signale les macros sans les classer à haut risque", () => {
    expect(nameRisk("budget.xlsm").level).toBe("caution");
    expect(nameRisk("rapport.pdf").level).toBe("none");
  });
  it("nettoie les noms dangereux", () => {
    expect(sanitizeName("../../etc/passwd")).toBe("_.._etc_passwd");
    expect(sanitizeName("a\u0000b.txt")).toBe("ab.txt");
    expect(sanitizeName("   ")).toBe("fichier");
  });
  it("n'autorise l'aperçu que pour les formats sûrs", () => {
    expect(previewKind("a.png", "")).toBe("image");
    expect(previewKind("index.html", "")).toBe("text");
    expect(previewKind("setup.exe", "")).toBeNull();
  });
});

describe("sniff", () => {
  it("reconnaît les signatures binaires", () => {
    expect(sniff(bytes("MZ", 0x90, 0)).format).toBe("pe");
    expect(sniff(bytes(0x7f, "ELF")).format).toBe("elf");
    expect(sniff(bytes("%PDF-1.7")).format).toBe("pdf");
    expect(sniff(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a)).format).toBe("png");
    expect(sniff(bytes("PK", 3, 4)).format).toBe("zip");
    expect(sniff(bytes("bonjour")).format).toBeNull();
  });
  it("démasque un exécutable déguisé en image", () => {
    const msg = mismatch("vacances.jpg", sniff(bytes("MZ", 0x90, 0)));
    expect(msg).toMatch(/exécutable Windows/);
  });
  it("accepte les conteneurs légitimes", () => {
    expect(mismatch("rapport.docx", sniff(bytes("PK", 3, 4)))).toBeNull();
    expect(mismatch("setup.exe", sniff(bytes("MZ")))).toBeNull();
    expect(mismatch("film.mov", sniff(bytes(0, 0, 0, 0x20, "ftypqt  ")))).toBeNull();
  });
  it("signale une extension incohérente", () => {
    expect(mismatch("photo.png", sniff(bytes("%PDF-1.4")))).toMatch(/ne correspond pas/);
  });
});

describe("zipinspect", () => {
  async function zip(entries: { name: string; input: string }[]) {
    const buf = new Uint8Array(await new Response(makeZip(entries.map((e) => ({ ...e, lastModified: new Date(0) })))).arrayBuffer());
    return { size: buf.length, read: async (o: number, l: number) => buf.slice(o, o + l) };
  }

  it("liste le contenu et repère exécutables et chemins piégés", async () => {
    const z = await zip([
      { name: "lisez-moi.txt", input: "bonjour" },
      { name: "outils/setup.exe", input: "MZ..." },
      { name: "../../evil.sh", input: "#!/bin/sh" },
      { name: "data.zip", input: "x" },
    ]);
    const r = await inspectZip(z.size, z.read);
    expect(r).not.toBeNull();
    expect(r!.entries).toBe(4);
    expect(r!.list.map((e) => e.name)).toContain("outils/setup.exe");
    expect(r!.risky.some((x) => x.name === "outils/setup.exe")).toBe(true);
    expect(r!.risky.some((x) => /zip slip/.test(x.reason))).toBe(true);
    expect(r!.nestedArchives).toBe(1);
    expect(r!.encrypted).toBe(false);
  });

  it("renvoie null pour un fichier qui n'est pas un zip", async () => {
    const buf = new TextEncoder().encode("ceci n'est pas une archive".repeat(10));
    expect(await inspectZip(buf.length, async (o, l) => buf.slice(o, o + l))).toBeNull();
  });
});
