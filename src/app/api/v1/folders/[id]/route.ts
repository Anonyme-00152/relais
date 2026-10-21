import { expiryMs, LIMITS } from "@/lib/config";
import { hashPassword } from "@/lib/server/crypto";
import { hasAccess, isOwner, purgeFolder, requireFolder, requireOwner, toView, updateFolder } from "@/lib/server/folders";
import { HttpError, json, readJson, route, str } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Vue publique (ou propriétaire) d'un dépôt. `?view=1` compte une visite. */
export const GET = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  let { rec } = await requireFolder(id);
  const owner = isOwner(rec, req);
  const unlocked = await hasAccess(rec, req);
  if (!owner && new URL(req.url).searchParams.get("view") === "1") {
    rec = await updateFolder(id, (r) => {
      r.views++;
    }).catch(() => rec);
  }
  return json(toView(rec, { owner, unlocked }));
});

type Patch = { title?: string; message?: string; password?: string | null; expiresIn?: string };

/** Réglages du propriétaire : titre, message, mot de passe, prolongation. */
export const PATCH = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rec: current } = await requireFolder(id);
  requireOwner(current, req);
  const body = await readJson<Patch>(req);

  let passwordHash: string | null | undefined;
  if (body.password === null || body.password === "") passwordHash = null;
  else if (typeof body.password === "string") {
    if (body.password.length < LIMITS.passwordMin || body.password.length > LIMITS.passwordMax) {
      throw new HttpError(400, "bad_password", `Le mot de passe doit faire entre ${LIMITS.passwordMin} et ${LIMITS.passwordMax} caractères.`);
    }
    passwordHash = await hashPassword(body.password);
  }
  let expiresAt: number | undefined;
  if (body.expiresIn) {
    const ms = expiryMs(body.expiresIn);
    if (!ms) throw new HttpError(400, "bad_expiry", "Durée de conservation invalide.");
    expiresAt = Date.now() + ms;
  }

  const rec = await updateFolder(id, (r) => {
    if (typeof body.title === "string") r.title = str(body.title, LIMITS.titleMax);
    if (typeof body.message === "string") r.message = str(body.message, LIMITS.messageMax);
    if (passwordHash !== undefined) r.passwordHash = passwordHash;
    if (expiresAt) r.expiresAt = expiresAt;
  });
  return json(toView(rec, { owner: true, unlocked: true }));
});

/** Suppression définitive du dépôt et de tous ses fichiers. */
export const DELETE = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { rec } = await requireFolder(id);
  requireOwner(rec, req);
  await purgeFolder(rec);
  return json({ ok: true });
});
