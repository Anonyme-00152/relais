import { initFile } from "@/lib/server/files";
import { json, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Étape 1 de l'envoi : réserve un identifiant de fichier. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await readJson<{ name?: string; size?: number }>(req);
  const init = await initFile(req, id, body);
  return json(
    {
      fileId: init.fileId,
      name: init.name,
      driver: init.driver,
      chunkSize: init.chunkSize,
      pathname: init.driver === "blob" ? init.key : undefined,
      chunkUrl: `/api/v1/folders/${id}/files/${init.fileId}/chunk?name=${encodeURIComponent(init.name)}`,
      completeUrl: `/api/v1/folders/${id}/files/${init.fileId}/complete`,
    },
    201,
  );
});
