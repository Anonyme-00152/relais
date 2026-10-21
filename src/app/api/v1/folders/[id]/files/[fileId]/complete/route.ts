import { completeFile } from "@/lib/server/files";
import { json, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/** Étape 3 : le fichier est complet, il est analysé puis ajouté au dépôt. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id, fileId } = await params;
  const body = await readJson<{ name?: string; mime?: string; sha256?: string }>(req);
  const { key: _key, ...file } = await completeFile(req, id, fileId, body);
  return json(file, 201);
});
