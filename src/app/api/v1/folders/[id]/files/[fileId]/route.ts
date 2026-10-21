import { inlineMime, previewKind } from "@/lib/filetypes";
import { isOwner, requireAccess, requireFolder, requireOwner, updateFolder } from "@/lib/server/folders";
import { HttpError, json, route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/**
 * Téléchargement (`?inline=1` pour l'aperçu). Les droits sont vérifiés à
 * chaque requête ; le contenu est servi dans un bac à sable (CSP sandbox).
 */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { id, fileId } = await params;
  const { rec } = await requireFolder(id);
  await requireAccess(rec, req);
  const file = rec.files.find((f) => f.id === fileId);
  if (!file) throw new HttpError(404, "not_found", "Fichier introuvable.");

  const url = new URL(req.url);
  const inline = url.searchParams.get("inline") === "1" && previewKind(file.name, file.mime) !== null;
  const range = req.headers.get("range");
  const store = await getStore();

  const firstByte = !range || /^bytes=0-/.test(range);
  if (req.method === "GET" && !inline && firstByte && !isOwner(rec, req) && url.searchParams.get("zip") !== "1") {
    void updateFolder(id, (r) => {
      const f = r.files.find((x) => x.id === fileId);
      if (f) f.downloads++;
    }).catch(() => {});
  }

  return store.serve(file.key, {
    mime: inline ? inlineMime(file.name, file.mime) : "application/octet-stream",
    filename: file.name,
    inline,
    size: file.size,
    range,
  });
});

export const HEAD = GET;

/** Retire un fichier du dépôt (propriétaire). */
export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const { id, fileId } = await params;
  const { rec } = await requireFolder(id);
  requireOwner(rec, req);
  const file = rec.files.find((f) => f.id === fileId);
  if (!file) throw new HttpError(404, "not_found", "Fichier introuvable.");
  await updateFolder(id, (r) => {
    r.files = r.files.filter((f) => f.id !== fileId);
  });
  await (await getStore()).deleteObjects([file.key]);
  return json({ ok: true });
});
