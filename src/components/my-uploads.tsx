"use client";

import { ArrowUpRight, Clock3, Copy, FolderOpen, KeyRound, Lock, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiFail } from "@/lib/client/api";
import { forgetOwned, listOwned, onOwnedChange, patchOwned, rememberOwned, type Owned } from "@/lib/client/owned";
import { formatBytes, formatDate, formatRemaining, plural } from "@/lib/format";
import type { FolderView } from "@/lib/types";
import { copyText, toast } from "./toast";

type Status = { kind: "ok"; view: FolderView } | { kind: "gone" } | { kind: "error" } | { kind: "loading" };

export function MyUploads() {
  const [list, setList] = useState<Owned[] | null>(null);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [importUrl, setImportUrl] = useState("");

  const refresh = useCallback(async (items: Owned[]) => {
    setStatus(Object.fromEntries(items.map((o) => [o.id, { kind: "loading" } as Status])));
    await Promise.all(
      items.map(async (o) => {
        try {
          const view = await api.folder(o.id, o.token);
          patchOwned(o.id, { fileCount: view.fileCount, totalSize: view.totalSize, expiresAt: view.expiresAt, title: view.title });
          setStatus((s) => ({ ...s, [o.id]: { kind: "ok", view } }));
        } catch (e) {
          setStatus((s) => ({ ...s, [o.id]: e instanceof ApiFail && e.status === 404 ? { kind: "gone" } : { kind: "error" } }));
        }
      }),
    );
  }, []);

  useEffect(() => {
    const items = listOwned();
    setList(items);
    refresh(items);
    return onOwnedChange(() => setList(listOwned()));
  }, [refresh]);

  async function importLink(e: React.FormEvent) {
    e.preventDefault();
    const m = /\/d\/([A-Za-z0-9]{4,32}).*[#&]cle=([A-Za-z0-9_-]{20,})/.exec(importUrl.trim());
    if (!m) return toast("Collez un lien de gestion complet (…/d/xxxx#cle=…)", "warn");
    try {
      const view = await api.folder(m[1], m[2]);
      if (!view.isOwner) return toast("Cette clé de gestion n'est pas valide", "warn");
      rememberOwned({ id: view.id, token: m[2], createdAt: view.createdAt, expiresAt: view.expiresAt, title: view.title, fileCount: view.fileCount, totalSize: view.totalSize });
      setStatus((s) => ({ ...s, [view.id]: { kind: "ok", view } }));
      setImportUrl("");
      toast("Dépôt ajouté à vos envois");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Import impossible", "warn");
    }
  }

  if (list === null) return <div className="mt-10 h-40 animate-pulse rounded-2xl bg-bg2" aria-busy="true" />;

  const active = list.filter((o) => status[o.id]?.kind !== "gone");
  const gone = list.filter((o) => status[o.id]?.kind === "gone");

  return (
    <div className="mt-10">
      {list.length === 0 ? (
        <div className="card p-10 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <FolderOpen className="size-7" />
          </span>
          <p className="mt-5 text-lg font-semibold">Aucun envoi sur ce navigateur</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Vos dépôts apparaîtront ici après votre premier envoi.</p>
          <Link href="/" className="btn btn-primary mt-6">
            <UploadCloud className="size-4" /> Envoyer des fichiers
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted">{plural(active.length, "dépôt actif", "dépôts actifs")}</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => refresh(listOwned())}>
              <RefreshCw className="size-4" /> Actualiser
            </button>
          </div>
          <ul className="grid gap-3">
            {active.map((o) => (
              <Row key={o.id} o={o} st={status[o.id] ?? { kind: "loading" }} />
            ))}
          </ul>
          {gone.length > 0 && (
            <div className="mt-10">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-muted">Expirés ou supprimés</p>
                <button type="button" className="text-sm font-medium text-muted hover:text-ink" onClick={() => gone.forEach((o) => forgetOwned(o.id))}>
                  Effacer l&apos;historique
                </button>
              </div>
              <ul className="grid gap-2">
                {gone.map((o) => (
                  <li key={o.id} className="flex items-center justify-between rounded-xl border border-dashed border-line2 px-5 py-3 text-sm text-muted">
                    <span className="truncate">
                      {o.title || plural(o.fileCount, "fichier")} · créé le {formatDate(o.createdAt)}
                    </span>
                    <button type="button" className="btn btn-ghost btn-icon size-8" aria-label="Retirer de la liste" onClick={() => forgetOwned(o.id)}>
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <form onSubmit={importLink} className="card mt-10 p-6">
        <p className="flex items-center gap-2 font-semibold">
          <KeyRound className="size-4 text-accent" /> Importer un lien de gestion
        </p>
        <p className="mt-1 text-sm text-muted">Vous avez créé un dépôt sur un autre appareil ? Collez son lien de gestion pour le retrouver ici.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="field font-mono text-sm"
            placeholder="https://…/d/AbC123xY#cle=…"
            aria-label="Lien de gestion"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
          />
          <button type="submit" className="btn btn-outline" disabled={!importUrl.trim()}>
            Importer
          </button>
        </div>
      </form>
    </div>
  );
}

function Row({ o, st }: { o: Owned; st: Status }) {
  const view = st.kind === "ok" ? st.view : null;
  const url = typeof window !== "undefined" ? `${location.origin}/d/${o.id}` : `/d/${o.id}`;
  const count = view?.fileCount ?? o.fileCount;
  const size = view?.totalSize ?? o.totalSize;
  const expiresAt = view?.expiresAt ?? o.expiresAt;
  const soon = expiresAt - Date.now() < 24 * 3600 * 1000;
  return (
    <li className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/d/${o.id}`} className="truncate text-[1.05rem] font-semibold hover:text-accent">
            {view?.title || o.title || (count ? plural(count, "fichier") : "Dépôt vide")}
          </Link>
          {view?.protected && <Lock className="size-3.5 shrink-0 text-muted" aria-label="Protégé par mot de passe" />}
          {view?.suspended && <span className="chip bg-danger-soft text-danger">Suspendu</span>}
          {st.kind === "error" && <span className="chip bg-warn-soft text-warn">Hors ligne</span>}
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>{plural(count, "fichier")}</span>
          <span>{formatBytes(size)}</span>
          <span className={`inline-flex items-center gap-1 ${soon ? "text-warn" : ""}`}>
            <Clock3 className="size-3.5" aria-hidden /> {formatRemaining(expiresAt)}
          </span>
          {view && <span>{plural(view.downloads, "téléchargement")}</span>}
          <span className="font-mono text-xs">/{o.id}</span>
        </p>
      </div>
      <div className="flex gap-1.5">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => copyText(url)}>
          <Copy className="size-4" /> Copier
        </button>
        <Link href={`/d/${o.id}`} className="btn btn-primary btn-sm">
          Gérer <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </li>
  );
}
