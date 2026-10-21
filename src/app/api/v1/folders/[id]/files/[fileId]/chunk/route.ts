import { LIMITS } from "@/lib/config";
import { sanitizeName } from "@/lib/filetypes";
import { FILE_ID } from "@/lib/server/files";
import { publicConfig, requireFolder, requireOwner } from "@/lib/server/folders";
import { HttpError, json, route } from "@/lib/server/http";
import { getStore, objectKey } from "@/lib/server/store";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

async function target(req: Request, ctx: Ctx) {
  const { id, fileId } = await ctx.params;
  if (!FILE_ID.test(fileId)) throw new HttpError(400, "bad_file", "Identifiant de fichier invalide.");
  const { rec } = await requireFolder(id);
  requireOwner(rec, req);
  const name = sanitizeName(new URL(req.url).searchParams.get("name") ?? "", LIMITS.nameMax);
  return objectKey(id, fileId, name);
}

/** Étape 2 : ajoute un morceau à la position `offset` (reprise possible après coupure). */
export const PUT = route(async (req: Request, ctx: Ctx) => {
  const key = await target(req, ctx);
  const offset = Number(new URL(req.url).searchParams.get("offset") ?? 0);
  if (!Number.isInteger(offset) || offset < 0) throw new HttpError(400, "bad_offset", "Position invalide.");
  const len = Number(req.headers.get("content-length") ?? NaN);
  if (offset + (Number.isFinite(len) ? len : 0) > publicConfig().maxFileSize) {
    throw new HttpError(413, "file_too_large", "Ce fichier dépasse la taille maximale autorisée.");
  }
  if (!req.body) throw new HttpError(400, "empty", "Corps de requête vide.");
  const store = await getStore();
  try {
    const received = await store.writeChunk(key, offset, req.body, Number.isFinite(len) ? len : null);
    return json({ received });
  } catch (e) {
    if (e instanceof Error && e.message === "offset") {
      const current = (e as Error & { current: number }).current;
      throw new HttpError(409, "offset_mismatch", "Position inattendue, reprenez à l'octet indiqué.", { received: current });
    }
    throw e;
  }
});

/** Octets déjà reçus pour ce fichier (reprise d'un envoi interrompu). */
export const GET = route(async (req: Request, ctx: Ctx) => {
  const key = await target(req, ctx);
  const store = await getStore();
  return json({ received: (await store.partSize?.(key)) ?? 0 });
});
