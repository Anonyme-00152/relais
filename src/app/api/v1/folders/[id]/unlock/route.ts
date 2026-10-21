import { verifyPassword } from "@/lib/server/crypto";
import { requireFolder, setAccessCookie, toView } from "@/lib/server/folders";
import { clientIp, HttpError, json, rateLimit, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Vérifie le mot de passe et dépose un cookie d'accès (12 h, httpOnly). */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  rateLimit(`pw:${id}:${clientIp(req)}`, 10, 60_000);
  const { rec } = await requireFolder(id);
  if (!rec.passwordHash) return json(toView(rec, { owner: false, unlocked: true }));
  const { password } = await readJson<{ password?: string }>(req);
  if (typeof password !== "string" || !(await verifyPassword(password, rec.passwordHash))) {
    await new Promise((r) => setTimeout(r, 400));
    throw new HttpError(401, "wrong_password", "Mot de passe incorrect.");
  }
  await setAccessCookie(rec);
  return json(toView(rec, { owner: false, unlocked: true }));
});
