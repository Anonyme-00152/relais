/**
 * Dépôts créés depuis ce navigateur. La clé de gestion ne quitte jamais
 * l'appareil, sauf si l'utilisateur partage lui-même son lien de gestion.
 */

export type Owned = {
  id: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  title: string;
  fileCount: number;
  totalSize: number;
};

const KEY = "relais:owned";
const EVENT = "relais:owned";

export function listOwned(): Owned[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Owned[]) : [];
    return Array.isArray(list) ? list.filter((o) => o && typeof o.id === "string" && typeof o.token === "string") : [];
  } catch {
    return [];
  }
}

function save(list: Owned[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
    window.dispatchEvent(new Event(EVENT));
  } catch {}
}

export function ownerToken(id: string): string | null {
  return listOwned().find((o) => o.id === id)?.token ?? null;
}

export function rememberOwned(entry: Owned) {
  const list = listOwned().filter((o) => o.id !== entry.id);
  save([entry, ...list]);
}

export function patchOwned(id: string, patch: Partial<Owned>) {
  save(listOwned().map((o) => (o.id === id ? { ...o, ...patch } : o)));
}

export function forgetOwned(id: string) {
  save(listOwned().filter((o) => o.id !== id));
}

export function onOwnedChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}
