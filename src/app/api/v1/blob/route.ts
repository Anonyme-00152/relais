import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { safeEqual, sha256 } from "@/lib/server/crypto";
import { publicConfig, requireFolder } from "@/lib/server/folders";
import { HttpError, json, route } from "@/lib/server/http";

/**
 * Jeton d'envoi direct navigateur → Vercel Blob (multipart, très gros
 * fichiers). Délivré uniquement au propriétaire du dépôt, pour un chemin précis.
 */
export const POST = route(async (req: Request) => {
  const body = (await req.json()) as HandleUploadBody;
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const { folderId, ownerToken } = JSON.parse(clientPayload ?? "{}") as { folderId?: string; ownerToken?: string };
      if (!folderId || !ownerToken) throw new HttpError(403, "forbidden", "Jeton manquant.");
      const { rec } = await requireFolder(folderId);
      if (!safeEqual(sha256(ownerToken), rec.ownerHash)) throw new HttpError(403, "forbidden", "Clé de gestion invalide.");
      if (!pathname.startsWith(`files/${folderId}/`) || pathname.includes("..")) {
        throw new HttpError(400, "bad_path", "Chemin d'envoi invalide.");
      }
      return {
        maximumSizeInBytes: publicConfig().maxFileSize,
        addRandomSuffix: false,
        allowOverwrite: true,
        validUntil: Date.now() + 6 * 60 * 60 * 1000,
      };
    },
  });
  return json(result);
});
