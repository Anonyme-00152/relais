import { LIMITS } from "@/lib/config";
import { clientFingerprint } from "@/lib/server/crypto";
import { requireFolder, updateFolder } from "@/lib/server/folders";
import { clientIp, HttpError, json, rateLimit, readJson, route, str } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

const REASONS = ["malware", "phishing", "copyright", "illegal", "other"];

/** Signalement : au-delà de 3 signalements distincts, le dépôt est suspendu. */
export const POST = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const ip = clientIp(req);
  rateLimit(`report:${ip}`, 10, 60 * 60_000);
  await requireFolder(id);
  const body = await readJson<{ reason?: string; details?: string }>(req);
  const reason = REASONS.includes(body.reason ?? "") ? body.reason! : null;
  if (!reason) throw new HttpError(400, "bad_reason", "Motif de signalement invalide.");
  const by = clientFingerprint(ip);
  const rec = await updateFolder(id, (r) => {
    if (r.reports.some((x) => x.by === by)) return false;
    r.reports.push({ by, reason: `${reason}${body.details ? `: ${str(body.details, 500)}` : ""}`, at: Date.now() });
    if (r.reports.length >= LIMITS.reportsToSuspend) r.suspended = true;
  });
  return json({ ok: true, suspended: rec.suspended });
});
