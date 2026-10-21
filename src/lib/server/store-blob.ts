import "server-only";
import { BlobPreconditionFailedError, del, get, issueSignedToken, list, presignUrl, put } from "@vercel/blob";
import type { FolderRecord } from "../types";
import { contentDisposition, SANDBOX_HEADERS, type ServeOptions, type Store } from "./store";

/**
 * Pilote Vercel Blob (magasin privé) : les fichiers ne sont jamais publics.
 * Les téléchargements passent par une URL pré-signée valable quelques minutes,
 * émise seulement après vérification des droits (mot de passe, expiration).
 */
export function createBlobStore(): Store {
  const meta = (id: string) => `meta/${id}.json`;

  async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
    const chunks: Uint8Array[] = [];
    let len = 0;
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      len += value.length;
    }
    const out = new Uint8Array(len);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }

  return {
    driver: "blob",

    async readFolder(id) {
      const res = await get(meta(id), { access: "private", useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      const text = new TextDecoder().decode(await readAll(res.stream));
      return { rec: JSON.parse(text) as FolderRecord, etag: res.blob.etag };
    },

    async writeFolder(rec, etag) {
      try {
        await put(meta(rec.id), JSON.stringify(rec), {
          access: "private",
          addRandomSuffix: false,
          contentType: "application/json",
          cacheControlMaxAge: 60,
          ...(etag ? { ifMatch: etag, allowOverwrite: true } : { allowOverwrite: false }),
        });
        return true;
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError) return false;
        if (!etag && e instanceof Error && /already exists/i.test(e.message)) return false;
        throw e;
      }
    },

    async deleteFolder(id) {
      const keys: string[] = [meta(id)];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: `files/${id}/`, cursor });
        keys.push(...page.blobs.map((b) => b.pathname));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      await del(keys);
    },

    async listFolderIds() {
      const ids: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: "meta/", cursor });
        ids.push(...page.blobs.map((b) => b.pathname.slice(5, -5)));
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return ids;
    },

    async objectSize(key) {
      const res = await get(key, { access: "private", headers: { Range: "bytes=0-0" } });
      if (!res || !res.stream) return null;
      await res.stream.cancel();
      const cr = res.headers.get("content-range");
      const total = cr ? Number(cr.split("/")[1]) : res.blob.size;
      return Number.isFinite(total) ? total : null;
    },

    async readRange(key, offset, length) {
      if (length <= 0) return new Uint8Array();
      const res = await get(key, { access: "private", headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
      if (!res || !res.stream) return new Uint8Array();
      return readAll(res.stream);
    },

    async readStream(key) {
      const res = await get(key, { access: "private" });
      return res?.stream ?? null;
    },

    async deleteObjects(keys) {
      if (keys.length) await del(keys);
    },

    async serve(key, opts: ServeOptions) {
      // 1) URL pré-signée courte : le CDN sert le fichier (reprise, plages, débit).
      try {
        const validUntil = Date.now() + 10 * 60 * 1000;
        const token = await issueSignedToken({ pathname: key, operations: ["get"], validUntil });
        const { presignedUrl } = await presignUrl(token, { operation: "get", pathname: key, access: "private", validUntil });
        const url = new URL(presignedUrl);
        if (!opts.inline) url.searchParams.set("download", "1");
        return new Response(null, { status: 302, headers: { Location: url.toString(), "Cache-Control": "private, no-store" } });
      } catch {
        // 2) Repli : relais du flux par la fonction.
        const res = await get(key, { access: "private", headers: opts.range ? { Range: opts.range } : undefined });
        if (!res || !res.stream) return new Response("Introuvable", { status: 404 });
        const headers: Record<string, string> = {
          ...SANDBOX_HEADERS,
          "Content-Type": opts.mime,
          "Content-Disposition": contentDisposition(opts.filename, opts.inline),
          "Accept-Ranges": "bytes",
        };
        const cr = res.headers.get("content-range");
        const cl = res.headers.get("content-length");
        if (cr) headers["Content-Range"] = cr;
        if (cl) headers["Content-Length"] = cl;
        return new Response(res.stream, { status: cr ? 206 : 200, headers });
      }
    },

    async writeChunk(key, offset, body) {
      if (offset !== 0) {
        const err = new Error("offset") as Error & { current: number };
        err.current = 0;
        throw err;
      }
      const res = await put(key, body, { access: "private", addRandomSuffix: false, allowOverwrite: true });
      void res;
      return (await this.objectSize(key)) ?? 0;
    },

    async finalizeObject() {},
  };
}
