import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FolderRecord } from "../types";
import { contentDisposition, parseRange, SANDBOX_HEADERS, type ServeOptions, type Store } from "./store";

/**
 * Pilote disque : développement et auto-hébergement (VPS, Docker).
 * Aucune limite de taille par requête, envoi reprenable par morceaux.
 */
export function createLocalStore(): Store {
  const root = path.resolve(process.env.RELAIS_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".data"));
  const metaDir = path.join(root, "meta");
  const objDir = path.join(root, "objects");

  const metaPath = (id: string) => {
    if (!/^[A-Za-z0-9]{4,32}$/.test(id)) throw new Error("id invalide");
    return path.join(metaDir, `${id}.json`);
  };
  const objPath = (key: string) => {
    const p = path.resolve(objDir, key);
    if (!p.startsWith(objDir + path.sep)) throw new Error("clé invalide");
    return p;
  };

  // Verrou par dépôt : les écritures conditionnelles se font sous ce verrou.
  const locks = new Map<string, Promise<unknown>>();
  async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const chain = prev.then(() => next);
    locks.set(id, chain);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (locks.get(id) === chain) locks.delete(id);
    }
  }

  async function readMeta(id: string) {
    try {
      let raw = "";
      for (let i = 0; ; i++) {
        try {
          raw = await readFile(metaPath(id), "utf8");
          break;
        } catch (e) {
          const code = (e as NodeJS.ErrnoException).code;
          if (i >= 5 || (code !== "EPERM" && code !== "EBUSY")) throw e;
          await new Promise((r) => setTimeout(r, 10 * (i + 1)));
        }
      }
      const rec = JSON.parse(raw) as FolderRecord & { _rev?: number };
      const etag = String(rec._rev ?? 0);
      delete rec._rev;
      return { rec: rec as FolderRecord, etag };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  return {
    driver: "local",

    readFolder: readMeta,

    writeFolder(rec, etag) {
      return withLock(rec.id, async () => {
        const cur = await readMeta(rec.id);
        if ((cur?.etag ?? null) !== etag) return false;
        await mkdir(metaDir, { recursive: true });
        const rev = (etag ? Number(etag) : 0) + 1;
        const tmp = `${metaPath(rec.id)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
        await writeFile(tmp, JSON.stringify({ ...rec, _rev: rev }));
        // Sous Windows, remplacer un fichier en cours de lecture échoue (EPERM/EBUSY) : on réessaie.
        for (let i = 0; ; i++) {
          try {
            await rename(tmp, metaPath(rec.id));
            break;
          } catch (e) {
            const code = (e as NodeJS.ErrnoException).code;
            if (i >= 8 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) {
              await rm(tmp, { force: true });
              throw e;
            }
            await new Promise((r) => setTimeout(r, 15 * (i + 1)));
          }
        }
        return true;
      });
    },

    async deleteFolder(id) {
      await rm(metaPath(id), { force: true });
      await rm(path.join(objDir, "files", id), { recursive: true, force: true });
    },

    async listFolderIds() {
      try {
        return (await readdir(metaDir)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
      } catch {
        return [];
      }
    },

    async objectSize(key) {
      try {
        return (await stat(objPath(key))).size;
      } catch {
        return null;
      }
    },

    async readRange(key, offset, length) {
      const fh = await open(objPath(key), "r");
      try {
        const buf = Buffer.alloc(length);
        const { bytesRead } = await fh.read(buf, 0, length, offset);
        return new Uint8Array(buf.buffer, buf.byteOffset, bytesRead);
      } finally {
        await fh.close();
      }
    },

    async readStream(key) {
      try {
        await stat(objPath(key));
      } catch {
        return null;
      }
      return Readable.toWeb(createReadStream(objPath(key))) as ReadableStream<Uint8Array>;
    },

    async deleteObjects(keys) {
      await Promise.all(
        keys.map(async (k) => {
          await rm(objPath(k), { force: true });
          await rm(`${objPath(k)}.part`, { force: true });
          await rm(path.dirname(objPath(k)), { recursive: true, force: true }).catch(() => {});
        }),
      );
    },

    async serve(key, opts: ServeOptions) {
      const file = objPath(key);
      const range = parseRange(opts.range, opts.size);
      const headers: Record<string, string> = {
        ...SANDBOX_HEADERS,
        "Content-Type": opts.mime,
        "Content-Disposition": contentDisposition(opts.filename, opts.inline),
        "Accept-Ranges": "bytes",
      };
      // Le lecteur PDF intégré de Chromium refuse les documents servis avec « CSP sandbox ».
      if (opts.mime === "application/pdf") delete headers["Content-Security-Policy"];
      if (range === "invalid") {
        return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${opts.size}` } });
      }
      const start = range?.start ?? 0;
      const end = range?.end ?? opts.size - 1;
      const body =
        opts.size === 0 ? null : (Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>);
      headers["Content-Length"] = String(opts.size === 0 ? 0 : end - start + 1);
      if (range) headers["Content-Range"] = `bytes ${start}-${end}/${opts.size}`;
      return new Response(body, { status: range ? 206 : 200, headers });
    },

    async writeChunk(key, offset, body) {
      const part = `${objPath(key)}.part`;
      await mkdir(path.dirname(part), { recursive: true });
      let current = 0;
      try {
        current = (await stat(part)).size;
      } catch {}
      if (offset !== current) {
        // Le client reprendra à la bonne position.
        const err = new Error("offset") as Error & { current: number };
        err.current = current;
        throw err;
      }
      await pipeline(Readable.fromWeb(body as never), createWriteStream(part, { flags: "a" }));
      return (await stat(part)).size;
    },

    async partSize(key) {
      try {
        return (await stat(`${objPath(key)}.part`)).size;
      } catch {
        return 0;
      }
    },

    async finalizeObject(key) {
      const part = `${objPath(key)}.part`;
      try {
        await rename(part, objPath(key));
      } catch (e) {
        // Fichier vide : aucun morceau reçu.
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
          await mkdir(path.dirname(objPath(key)), { recursive: true });
          await writeFile(objPath(key), "", { flag: "a" });
        } else throw e;
      }
    },
  };
}
