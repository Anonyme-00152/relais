import { loadFolder } from "@/lib/server/folders";
import { json } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Purge quotidienne des dépôts expirés (Vercel Cron). Les dépôts expirés
 * sont déjà inaccessibles : ceci libère simplement l'espace.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "Non autorisé" }, 401);
  }
  const store = await getStore();
  const ids = await store.listFolderIds();
  let purged = 0;
  for (const id of ids) {
    // loadFolder supprime d'elle-même un dépôt expiré.
    const before = await store.readFolder(id).catch(() => null);
    if (before && before.rec.expiresAt <= Date.now()) {
      await loadFolder(id).catch(() => null);
      purged++;
    }
  }
  return json({ scanned: ids.length, purged });
}
