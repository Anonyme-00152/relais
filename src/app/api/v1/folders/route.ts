import { site } from "@/lib/config";
import { createFolder, toView } from "@/lib/server/folders";
import { clientIp, json, rateLimit, readJson, route, str } from "@/lib/server/http";

type Body = { title?: string; message?: string; password?: string; expiresIn?: string };

/** Crée un dépôt vide et renvoie sa clé de gestion (affichée une seule fois). */
export const POST = route(async (req: Request) => {
  rateLimit(`create:${clientIp(req)}`, 40, 10 * 60_000);
  const body = await readJson<Body>(req);
  const { rec, ownerToken } = await createFolder({
    title: str(body.title, 200),
    message: str(body.message, 2000),
    password: typeof body.password === "string" ? body.password : "",
    expiresIn: str(body.expiresIn, 8) || undefined,
  });
  const base = new URL(req.url).origin || site.url;
  return json(
    {
      folder: toView(rec, { owner: true, unlocked: true }),
      ownerToken,
      url: `${base}/d/${rec.id}`,
      manageUrl: `${base}/d/${rec.id}#cle=${ownerToken}`,
    },
    201,
  );
});
