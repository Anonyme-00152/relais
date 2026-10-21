import type { PublicConfig } from "../config";
import type { FileView, FolderView } from "../types";

export class ApiFail extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit & { owner?: string | null } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.owner) headers.set("authorization", `Bearer ${init.owner}`);
  if (init.body && typeof init.body === "string") headers.set("content-type", "application/json");
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiFail(0, "network", "Connexion impossible. Vérifiez votre réseau.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiFail(res.status, String(data.code ?? "error"), String(data.error ?? `Erreur ${res.status}`), data);
  return data as T;
}

let configPromise: Promise<PublicConfig> | null = null;
export const getConfig = () => (configPromise ??= call<PublicConfig>("/api/v1/config"));

export type Created = { folder: FolderView; ownerToken: string; url: string; manageUrl: string };

export const api = {
  create: (body: { title?: string; message?: string; password?: string; expiresIn?: string }) =>
    call<Created>("/api/v1/folders", { method: "POST", body: JSON.stringify(body) }),
  folder: (id: string, owner?: string | null, countView = false) =>
    call<FolderView>(`/api/v1/folders/${id}${countView ? "?view=1" : ""}`, { owner }),
  unlock: (id: string, password: string) =>
    call<FolderView>(`/api/v1/folders/${id}/unlock`, { method: "POST", body: JSON.stringify({ password }) }),
  update: (id: string, owner: string, body: { title?: string; message?: string; password?: string | null; expiresIn?: string }) =>
    call<FolderView>(`/api/v1/folders/${id}`, { method: "PATCH", owner, body: JSON.stringify(body) }),
  remove: (id: string, owner: string) => call<{ ok: true }>(`/api/v1/folders/${id}`, { method: "DELETE", owner }),
  removeFile: (id: string, fileId: string, owner: string) =>
    call<{ ok: true }>(`/api/v1/folders/${id}/files/${fileId}`, { method: "DELETE", owner }),
  report: (id: string, reason: string, details: string) =>
    call<{ ok: true; suspended: boolean }>(`/api/v1/folders/${id}/report`, { method: "POST", body: JSON.stringify({ reason, details }) }),
  initFile: (id: string, owner: string, name: string, size: number) =>
    call<{ fileId: string; name: string; driver: "local" | "blob"; chunkSize: number; pathname?: string; chunkUrl: string; completeUrl: string }>(
      `/api/v1/folders/${id}/files`,
      { method: "POST", owner, body: JSON.stringify({ name, size }) },
    ),
  complete: (url: string, owner: string, body: { name: string; mime: string; sha256: string | null }, signal?: AbortSignal) =>
    call<FileView>(url, { method: "POST", owner, body: JSON.stringify(body), signal }),
  received: (chunkUrl: string, owner: string) => call<{ received: number }>(chunkUrl, { owner }),
};

export const fileUrl = (folderId: string, fileId: string, inline = false) =>
  `/api/v1/folders/${folderId}/files/${fileId}${inline ? "?inline=1" : ""}`;
