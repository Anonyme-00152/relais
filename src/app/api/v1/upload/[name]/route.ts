import { completeFile, initFile } from "@/lib/server/files";
import { createFolder } from "@/lib/server/folders";
import { clientIp, HttpError, json, rateLimit, route } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

type Ctx = { params: Promise<{ name: string }> };

/**
 * Envoi en une seule commande :
 *   curl -T rapport.pdf https://…/api/v1/upload/rapport.pdf
 * Sans en-tête, crée un dépôt. Avec `X-Relais-Folder` + `Authorization: Bearer <clé>`,
 * ajoute le fichier à un dépôt existant.
 */
export const PUT = route(async (req: Request, { params }: Ctx) => {
  const { name: rawName } = await params;
  const name = decodeURIComponent(rawName);
  if (!req.body) throw new HttpError(400, "empty", "Corps de requête vide.");

  let folderId = req.headers.get("x-relais-folder");
  let ownerToken: string | null = null;
  let created = false;
  let authed = req;

  if (!folderId) {
    rateLimit(`create:${clientIp(req)}`, 40, 10 * 60_000);
    const { rec, ownerToken: token } = await createFolder({
      title: req.headers.get("x-relais-title") ?? "",
      password: req.headers.get("x-relais-new-password") ?? "",
      expiresIn: req.headers.get("x-relais-expires") ?? undefined,
    });
    folderId = rec.id;
    ownerToken = token;
    created = true;
    const headers = new Headers(req.headers);
    headers.set("authorization", `Bearer ${token}`);
    authed = new Request(req.url, { method: "PUT", headers });
  }

  const size = Number(req.headers.get("content-length") ?? 0);
  const init = await initFile(authed, folderId, { name, size });
  const store = await getStore();
  try {
    await store.writeChunk(init.key, 0, req.body, size || null);
    const { key: _key, ...file } = await completeFile(authed, folderId, init.fileId, { name, mime: req.headers.get("content-type") ?? "" });
    const base = new URL(req.url).origin;
    return json(
      {
        folder: created ? { id: folderId, url: `${base}/d/${folderId}`, ownerToken, manageUrl: `${base}/d/${folderId}#cle=${ownerToken}` } : { id: folderId, url: `${base}/d/${folderId}` },
        file: { ...file, downloadUrl: `${base}/api/v1/folders/${folderId}/files/${file.id}` },
      },
      201,
    );
  } catch (e) {
    await store.deleteObjects([init.key]).catch(() => {});
    if (created) {
      const { loadFolder, purgeFolder } = await import("@/lib/server/folders");
      const got = await loadFolder(folderId);
      if (got && !got.rec.files.length) await purgeFolder(got.rec).catch(() => {});
    }
    throw e;
  }
});

export const POST = PUT;

export const dynamic = "force-dynamic";
