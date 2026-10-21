import type { FileView } from "../types";
import { api, ApiFail } from "./api";

export type ItemStatus = "queued" | "uploading" | "finalizing" | "done" | "error" | "canceled";

export type UploadItem = {
  uid: string;
  file: File;
  name: string;
  status: ItemStatus;
  sent: number;
  error: string | null;
  result: FileView | null;
};

export type UploadSnapshot = {
  items: UploadItem[];
  totalBytes: number;
  sentBytes: number;
  /** Débit lissé en octets/s. */
  speed: number;
  /** Secondes restantes estimées, null tant qu'on ne sait pas. */
  eta: number | null;
  running: boolean;
  doneCount: number;
  errorCount: number;
};

const CONCURRENCY = 3;
const MAX_RETRIES = 6;

let uidSeq = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Empreinte SHA-256 calculée par morceaux (fichiers de plusieurs Go sans saturer la mémoire). */
async function sha256Of(file: File, signal: AbortSignal): Promise<string | null> {
  try {
    const { createSHA256 } = await import("hash-wasm");
    const h = await createSHA256();
    h.init();
    const step = 8 * 1024 * 1024;
    for (let o = 0; o < file.size; o += step) {
      if (signal.aborted) return null;
      h.update(new Uint8Array(await file.slice(o, o + step).arrayBuffer()));
    }
    return h.digest("hex");
  } catch {
    return null;
  }
}

/** PUT d'un morceau avec progression (fetch n'expose pas la progression d'envoi). */
function putChunk(url: string, owner: string, body: Blob, signal: AbortSignal, onProgress: (n: number) => void) {
  return new Promise<{ status: number; data: Record<string, unknown> }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("authorization", `Bearer ${owner}`);
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => reject(new ApiFail(0, "network", "Connexion interrompue."));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

export class UploadSession {
  private items: UploadItem[] = [];
  private controllers = new Map<string, AbortController>();
  private listeners = new Set<() => void>();
  private snapshot: UploadSnapshot;
  private samples: { t: number; b: number }[] = [];
  private speed = 0;
  private active = 0;
  private emitQueued = false;

  constructor(
    public folderId: string,
    public owner: string,
    private onFileDone?: (f: FileView) => void,
  ) {
    this.snapshot = this.compute();
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;

  add(files: File[]) {
    for (const file of files) {
      this.items.push({ uid: `u${++uidSeq}`, file, name: file.name, status: "queued", sent: 0, error: null, result: null });
    }
    this.emit();
    this.pump();
  }

  cancel(uid: string) {
    const it = this.items.find((i) => i.uid === uid);
    if (!it || it.status === "done") return;
    this.controllers.get(uid)?.abort();
    it.status = "canceled";
    this.emit();
    this.pump();
  }

  cancelAll() {
    for (const it of this.items) if (it.status === "queued" || it.status === "uploading") this.cancel(it.uid);
  }

  retry(uid: string) {
    const it = this.items.find((i) => i.uid === uid);
    if (!it || (it.status !== "error" && it.status !== "canceled")) return;
    it.status = "queued";
    it.error = null;
    it.sent = 0;
    this.emit();
    this.pump();
  }

  private pump() {
    while (this.active < CONCURRENCY) {
      const next = this.items.find((i) => i.status === "queued");
      if (!next) break;
      this.active++;
      next.status = "uploading";
      this.run(next).finally(() => {
        this.active--;
        this.emit();
        this.pump();
      });
    }
    this.emit();
  }

  private async run(it: UploadItem) {
    const ctrl = new AbortController();
    this.controllers.set(it.uid, ctrl);
    try {
      const init = await api.initFile(this.folderId, this.owner, it.file.name, it.file.size);
      it.name = init.name;
      const hashP = sha256Of(it.file, ctrl.signal);

      if (init.driver === "blob" && init.pathname) {
        const { upload } = await import("@vercel/blob/client");
        await upload(init.pathname, it.file, {
          access: "private",
          handleUploadUrl: "/api/v1/blob",
          clientPayload: JSON.stringify({ folderId: this.folderId, ownerToken: this.owner }),
          multipart: it.file.size > 32 * 1024 * 1024,
          abortSignal: ctrl.signal,
          contentType: it.file.type || "application/octet-stream",
          onUploadProgress: ({ loaded }) => this.progress(it, loaded),
        });
      } else {
        await this.chunked(it, init.chunkUrl, init.chunkSize, ctrl.signal);
      }

      it.status = "finalizing";
      this.emit();
      const sha256 = await hashP;
      const rec = await api.complete(init.completeUrl, this.owner, { name: it.name, mime: it.file.type, sha256 }, ctrl.signal);
      this.progress(it, it.file.size);
      it.status = "done";
      it.result = rec;
      this.onFileDone?.(rec);
    } catch (e) {
      if (ctrl.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) {
        it.status = "canceled";
      } else {
        it.status = "error";
        it.error = e instanceof Error ? e.message : "Échec de l'envoi.";
      }
    } finally {
      this.controllers.delete(it.uid);
    }
  }

  /** Envoi par morceaux reprenable : en cas de coupure, on repart de l'octet confirmé par le serveur. */
  private async chunked(it: UploadItem, chunkUrl: string, chunkSize: number, signal: AbortSignal) {
    const size = it.file.size;
    let offset = 0;
    let failures = 0;
    if (size === 0) {
      const r = await putChunk(`${chunkUrl}&offset=0`, this.owner, new Blob([]), signal, () => {});
      if (r.status >= 400) throw new ApiFail(r.status, String(r.data.code), String(r.data.error ?? "Échec de l'envoi."));
      return;
    }
    while (offset < size) {
      const end = Math.min(offset + chunkSize, size);
      const base = offset;
      try {
        const r = await putChunk(`${chunkUrl}&offset=${offset}`, this.owner, it.file.slice(offset, end), signal, (n) =>
          this.progress(it, base + n),
        );
        if (r.status === 409 && typeof r.data.received === "number") {
          offset = r.data.received;
          this.progress(it, offset);
          continue;
        }
        if (r.status >= 400 && r.status < 500) {
          throw new ApiFail(r.status, String(r.data.code), String(r.data.error ?? "Envoi refusé."));
        }
        if (r.status >= 500) throw new ApiFail(r.status, "server", "Erreur serveur.");
        offset = Number(r.data.received ?? end);
        failures = 0;
        this.progress(it, offset);
      } catch (e) {
        if (signal.aborted) throw e;
        if (e instanceof ApiFail && e.status >= 400 && e.status < 500) throw e;
        if (++failures > MAX_RETRIES) throw new Error("Connexion instable : envoi interrompu. Réessayez.");
        await sleep(Math.min(15_000, 600 * 2 ** failures));
        // Le serveur indique où reprendre.
        offset = await api.received(chunkUrl, this.owner).then((r) => r.received).catch(() => offset);
        this.progress(it, offset);
      }
    }
  }

  private progress(it: UploadItem, sent: number) {
    it.sent = Math.min(sent, it.file.size);
    if (!this.emitQueued) {
      this.emitQueued = true;
      requestAnimationFrame(() => {
        this.emitQueued = false;
        this.emit();
      });
    }
  }

  private compute(): UploadSnapshot {
    const live = this.items.filter((i) => i.status !== "canceled");
    const totalBytes = live.reduce((s, i) => s + i.file.size, 0);
    const sentBytes = live.reduce((s, i) => s + (i.status === "done" ? i.file.size : i.sent), 0);
    const now = performance.now();
    this.samples.push({ t: now, b: sentBytes });
    while (this.samples.length > 2 && now - this.samples[0].t > 4000) this.samples.shift();
    const first = this.samples[0];
    const running = this.items.some((i) => i.status === "queued" || i.status === "uploading" || i.status === "finalizing");
    if (running && now - first.t > 300) {
      const inst = Math.max(0, ((sentBytes - first.b) / (now - first.t)) * 1000);
      this.speed = this.speed ? this.speed * 0.6 + inst * 0.4 : inst;
    }
    if (!running) this.speed = 0;
    return {
      items: this.items.map((i) => ({ ...i })),
      totalBytes,
      sentBytes,
      speed: this.speed,
      eta: running && this.speed > 1 ? (totalBytes - sentBytes) / this.speed : null,
      running,
      doneCount: this.items.filter((i) => i.status === "done").length,
      errorCount: this.items.filter((i) => i.status === "error").length,
    };
  }

  private emit() {
    this.snapshot = this.compute();
    for (const l of this.listeners) l();
  }
}

/** Parcourt récursivement les dossiers déposés (API webkitGetAsEntry). */
export async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
  if (!entries.length) return [...dt.files];
  const out: File[] = [];
  async function walk(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      out.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e);
      }
    }
  }
  for (const e of entries) await walk(e);
  return out;
}
