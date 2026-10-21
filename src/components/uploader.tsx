"use client";

import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  FolderUp,
  KeyRound,
  Link2,
  Lock,
  Plus,
  QrCode as QrIcon,
  RotateCcw,
  Share2,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_EXPIRY, EXPIRY_OPTIONS, LIMITS, type PublicConfig } from "@/lib/config";
import { api, getConfig } from "@/lib/client/api";
import { patchOwned, rememberOwned } from "@/lib/client/owned";
import { filesFromDrop, UploadSession, type UploadItem } from "@/lib/client/uploader";
import { nameRisk } from "@/lib/filetypes";
import { formatBytes, formatDuration, formatSpeed, middleEllipsis, plural } from "@/lib/format";
import { FileGlyph, ProgressBar, QrCode } from "./file-bits";
import { copyText, toast } from "./toast";

const JUNK = new Set([".ds_store", "thumbs.db", "desktop.ini", ".localized"]);
const clean = (files: File[]) => files.filter((f) => !JUNK.has(f.name.toLowerCase()) && !f.name.startsWith("._"));

type Share = { id: string; url: string; manageUrl: string; owner: string; protected: boolean };

export function Uploader() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [session, setSession] = useState<UploadSession | null>(null);
  const [share, setShare] = useState<Share | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opts, setOpts] = useState({ title: "", message: "", password: "", expiresIn: DEFAULT_EXPIRY as string, usePassword: false });
  const [showOpts, setShowOpts] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
  }, []);

  const addFiles = useCallback(
    (raw: File[]) => {
      const files = clean(raw);
      if (!files.length) return;
      if (session) {
        session.add(files);
        return;
      }
      setPicked((prev) => {
        const seen = new Set(prev.map((f) => `${f.name}:${f.size}:${f.lastModified}`));
        const merged = [...prev, ...files.filter((f) => !seen.has(`${f.name}:${f.size}:${f.lastModified}`))];
        if (merged.length > LIMITS.maxFiles) toast(`Maximum ${LIMITS.maxFiles} fichiers par dépôt.`, "warn");
        return merged.slice(0, LIMITS.maxFiles);
      });
      setError(null);
    },
    [session],
  );

  const tooBig = useMemo(() => (config ? picked.filter((f) => f.size > config.maxFileSize) : []), [picked, config]);
  const total = picked.reduce((s, f) => s + f.size, 0);

  async function start() {
    if (!picked.length || creating) return;
    if (tooBig.length) return setError(`${plural(tooBig.length, "fichier dépasse", "fichiers dépassent")} la taille maximale de ${formatBytes(config!.maxFileSize)}.`);
    if (config && total > config.maxFolderSize) return setError(`Le total dépasse ${formatBytes(config.maxFolderSize)} par dépôt.`);
    if (opts.usePassword && opts.password.length < LIMITS.passwordMin) return setError(`Le mot de passe doit contenir au moins ${LIMITS.passwordMin} caractères.`);
    setCreating(true);
    setError(null);
    try {
      const created = await api.create({
        title: opts.title.trim(),
        message: opts.message.trim(),
        password: opts.usePassword ? opts.password : "",
        expiresIn: opts.expiresIn,
      });
      const id = created.folder.id;
      rememberOwned({
        id,
        token: created.ownerToken,
        createdAt: created.folder.createdAt,
        expiresAt: created.folder.expiresAt,
        title: created.folder.title,
        fileCount: 0,
        totalSize: 0,
      });
      let count = 0;
      let size = 0;
      const s = new UploadSession(id, created.ownerToken, (f) => {
        count++;
        size += f.size;
        patchOwned(id, { fileCount: count, totalSize: size });
      });
      setShare({ id, url: created.url, manageUrl: created.manageUrl, owner: created.ownerToken, protected: !!opts.usePassword });
      setSession(s);
      s.add(picked);
      setPicked([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de créer le dépôt.");
    } finally {
      setCreating(false);
    }
  }

  function reset() {
    session?.cancelAll();
    setSession(null);
    setShare(null);
    setPicked([]);
    setOpts({ title: "", message: "", password: "", expiresIn: DEFAULT_EXPIRY, usePassword: false });
    setShowOpts(false);
  }

  return (
    <div className="card relative overflow-hidden p-2 shadow-[var(--shadow-lg)]">
      <PageDrop onFiles={addFiles} />
      {session && share ? (
        <Sending session={session} share={share} onMore={addFiles} onReset={reset} />
      ) : (
        <div className="p-3 sm:p-4">
          <DropZone onFiles={addFiles} compact={picked.length > 0} config={config} />

          {picked.length > 0 && (
            <div className="animate-fade mt-4">
              <div className="mb-2 flex items-baseline justify-between px-1">
                <p className="text-sm font-semibold">
                  {plural(picked.length, "fichier")} <span className="font-normal text-muted">· {formatBytes(total)}</span>
                </p>
                <button type="button" className="text-xs font-medium text-muted hover:text-ink" onClick={() => setPicked([])}>
                  Tout retirer
                </button>
              </div>
              <ul className="max-h-56 overflow-y-auto rounded-xl border border-line bg-raised" aria-label="Fichiers sélectionnés">
                {picked.map((f, i) => {
                  const risky = nameRisk(f.name).level === "high";
                  const big = config && f.size > config.maxFileSize;
                  return (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                      <FileGlyph name={f.name} mime={f.type} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={f.name}>
                          {middleEllipsis(f.name, 48)}
                        </p>
                        <p className={`text-xs ${big ? "text-danger" : "text-muted"}`}>
                          {formatBytes(f.size)}
                          {big && " · trop volumineux"}
                          {risky && !big && " · exécutable : les destinataires seront avertis"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon size-8"
                        aria-label={`Retirer ${f.name}`}
                        onClick={() => setPicked((p) => p.filter((_, j) => j !== i))}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                className="mt-4 flex w-full items-center justify-between rounded-xl px-1 py-1 text-sm font-medium text-ink-2"
                aria-expanded={showOpts}
                onClick={() => setShowOpts((s) => !s)}
              >
                <span className="flex items-center gap-2">
                  Options
                  <span className="text-xs font-normal text-muted">
                    {EXPIRY_OPTIONS.find((o) => o.id === opts.expiresIn)?.label}
                    {opts.usePassword && " · mot de passe"}
                    {opts.title && " · titre"}
                  </span>
                </span>
                <ChevronDown className={`size-4 transition-transform ${showOpts ? "rotate-180" : ""}`} />
              </button>

              {showOpts && (
                <div className="animate-fade mt-3 grid gap-4 rounded-xl border border-line bg-raised p-4">
                  <div>
                    <span className="label" id="exp-label">
                      Conservation
                    </span>
                    <div role="radiogroup" aria-labelledby="exp-label" className="grid grid-cols-4 gap-1 rounded-xl bg-bg2 p-1">
                      {EXPIRY_OPTIONS.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          role="radio"
                          aria-checked={opts.expiresIn === o.id}
                          onClick={() => setOpts((s) => ({ ...s, expiresIn: o.id }))}
                          className={`h-9 rounded-lg text-xs font-semibold transition-colors sm:text-sm ${
                            opts.expiresIn === o.id ? "bg-card text-ink shadow-[var(--shadow-sm)]" : "text-muted hover:text-ink"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="up-title">
                      Titre <span className="font-normal text-muted">(facultatif)</span>
                    </label>
                    <input
                      id="up-title"
                      className="field"
                      maxLength={LIMITS.titleMax}
                      placeholder="Ex. Rendu final du projet"
                      value={opts.title}
                      onChange={(e) => setOpts((s) => ({ ...s, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="up-msg">
                      Message aux destinataires <span className="font-normal text-muted">(facultatif)</span>
                    </label>
                    <textarea
                      id="up-msg"
                      rows={2}
                      className="field"
                      maxLength={LIMITS.messageMax}
                      placeholder="Quelques mots sur le contenu…"
                      value={opts.message}
                      onChange={(e) => setOpts((s) => ({ ...s, message: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--accent)]"
                        checked={opts.usePassword}
                        onChange={(e) => setOpts((s) => ({ ...s, usePassword: e.target.checked }))}
                      />
                      Protéger par un mot de passe
                    </label>
                    {opts.usePassword && (
                      <div className="relative mt-2.5">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                        <input
                          type="password"
                          autoComplete="new-password"
                          className="field pl-9"
                          aria-label="Mot de passe du dépôt"
                          placeholder={`${LIMITS.passwordMin} caractères minimum`}
                          maxLength={LIMITS.passwordMax}
                          value={opts.password}
                          onChange={(e) => setOpts((s) => ({ ...s, password: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}

              <button type="button" className="btn btn-primary btn-lg mt-4 w-full" onClick={start} disabled={creating}>
                {creating ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
                    Préparation du lien…
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-5" aria-hidden />
                    Envoyer {plural(picked.length, "fichier")}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Zone de dépôt ---------- */

function DropZone({ onFiles, compact, config }: { onFiles: (f: File[]) => void; compact: boolean; config: PublicConfig | null }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    dirInput.current?.setAttribute("webkitdirectory", "");
  }, []);

  return (
    <div
      data-over={over}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onFiles(await filesFromDrop(e.dataTransfer));
      }}
      className={`dropzone-ring relative grid place-items-center rounded-[18px] text-center transition-colors ${
        over ? "bg-accent-soft" : "bg-raised"
      } ${compact ? "px-4 py-5" : "px-6 py-12 sm:py-16"}`}
    >
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => (onFiles([...(e.target.files ?? [])]), (e.target.value = ""))} />
      <input ref={dirInput} type="file" multiple hidden onChange={(e) => (onFiles([...(e.target.files ?? [])]), (e.target.value = ""))} />
      {compact ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInput.current?.click()}>
            <Plus className="size-4" /> Ajouter des fichiers
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => dirInput.current?.click()}>
            <FolderUp className="size-4" /> Un dossier
          </button>
        </div>
      ) : (
        <div>
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent text-on-accent shadow-[0_14px_30px_-12px_var(--accent)] [animation:float_3.2s_ease-in-out_infinite]">
            <UploadCloud className="size-8" strokeWidth={1.8} aria-hidden />
          </div>
          <p className="mt-6 text-lg font-semibold tracking-tight">{over ? "Relâchez pour ajouter" : "Glissez vos fichiers ou dossiers ici"}</p>
          <p className="mt-1.5 text-sm text-muted">
            ou{" "}
            <button type="button" className="font-semibold text-accent underline-offset-4 hover:underline" onClick={() => fileInput.current?.click()}>
              parcourez votre appareil
            </button>
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => fileInput.current?.click()}>
              <Plus className="size-4" /> Choisir des fichiers
            </button>
            <button type="button" className="btn btn-outline" onClick={() => dirInput.current?.click()}>
              <FolderUp className="size-4" /> Choisir un dossier
            </button>
          </div>
          <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-muted">
            {config ? `Jusqu'à ${formatBytes(config.maxFileSize, 0)} par fichier · sans compte` : "Sans compte · sans inscription"}
          </p>
        </div>
      )}
    </div>
  );
}

/** Dépôt possible n'importe où sur la page, avec un voile explicite. */
function PageDrop({ onFiles }: { onFiles: (f: File[]) => void }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setActive(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setActive(false);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      if (e.dataTransfer) onFiles(await filesFromDrop(e.dataTransfer));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [onFiles]);
  if (!active) return null;
  return (
    <div className="animate-fade pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-accent/12 backdrop-blur-[3px]">
      <div className="rounded-3xl border-2 border-dashed border-accent bg-card px-10 py-8 text-center shadow-[var(--shadow-lg)]">
        <UploadCloud className="mx-auto size-10 text-accent" aria-hidden />
        <p className="mt-3 text-lg font-semibold">Déposez pour envoyer</p>
      </div>
    </div>
  );
}

/* ---------- Envoi en cours / terminé ---------- */

function Sending({ session, share, onMore, onReset }: { session: UploadSession; share: Share; onMore: (f: File[]) => void; onReset: () => void }) {
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const moreInput = useRef<HTMLInputElement>(null);
  const [showQr, setShowQr] = useState(false);
  const pct = snap.totalBytes ? snap.sentBytes / snap.totalBytes : snap.running ? 0 : 1;
  const finished = !snap.running && snap.doneCount > 0;

  useEffect(() => {
    if (!snap.running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [snap.running]);

  const shareNative = async () => {
    try {
      await navigator.share({ title: "Fichiers partagés avec Relais", url: share.url });
    } catch {}
  };

  return (
    <div className="p-3 sm:p-5">
      <div className="flex items-start gap-4">
        <div
          className={`grid size-12 shrink-0 place-items-center rounded-2xl transition-colors ${
            finished ? "bg-ok text-white dark:text-bg" : "bg-accent-soft text-accent"
          }`}
        >
          {finished ? <Check className="size-6" strokeWidth={2.6} /> : <UploadCloud className="size-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold tracking-tight" aria-live="polite">
            {finished
              ? snap.errorCount
                ? `${plural(snap.doneCount, "fichier envoyé")}, ${plural(snap.errorCount, "échec")}`
                : "C'est envoyé !"
              : `Envoi en cours… ${Math.floor(pct * 100)} %`}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {finished
              ? `${formatBytes(snap.totalBytes)} prêts à être partagés.`
              : `${formatBytes(snap.sentBytes)} sur ${formatBytes(snap.totalBytes)}${snap.speed ? ` · ${formatSpeed(snap.speed)}` : ""}${
                  snap.eta !== null ? ` · encore ${formatDuration(snap.eta)}` : ""
                }`}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <ProgressBar value={pct} active={snap.running} tone={finished && !snap.errorCount ? "ok" : "accent"} />
      </div>

      {/* Le lien est disponible dès le début de l'envoi. */}
      <div className="mt-5 rounded-2xl border border-line bg-raised p-3">
        <div className="flex items-center gap-2 px-1 pb-2 text-xs font-medium text-muted">
          <Link2 className="size-3.5" aria-hidden /> Lien de partage {share.protected && "· protégé par mot de passe"}
        </div>
        <div className="flex gap-2">
          <input
            readOnly
            value={share.url}
            aria-label="Lien de partage"
            onFocus={(e) => e.target.select()}
            className="field h-11 flex-1 bg-card font-mono text-sm"
          />
          <button type="button" className="btn btn-primary h-11" onClick={() => copyText(share.url)}>
            <Copy className="size-4" /> <span className="hidden sm:inline">Copier</span>
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <Link href={`/d/${share.id}`} className="btn btn-ghost btn-sm" target="_blank">
            <ArrowUpRight className="size-4" /> Ouvrir la page
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowQr((s) => !s)} aria-expanded={showQr}>
            <QrIcon className="size-4" /> QR code
          </button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={shareNative}>
              <Share2 className="size-4" /> Partager
            </button>
          )}
        </div>
        {showQr && (
          <div className="animate-fade mt-3 flex items-center gap-4 px-1">
            <QrCode value={share.url} size={132} />
            <p className="text-sm text-muted">Scannez pour ouvrir le lien sur un téléphone.</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-2xl bg-sun-soft px-4 py-3 text-sm">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium text-ink">Lien de gestion (gardez-le pour vous)</p>
          <p className="mt-0.5 text-ink-2">
            Il permet de modifier ou supprimer ce dépôt depuis un autre appareil. Il est aussi mémorisé dans{" "}
            <Link href="/mes-envois" className="font-medium underline underline-offset-2">
              Mes envois
            </Link>{" "}
            sur ce navigateur.
          </p>
          <button type="button" className="mt-1.5 font-medium text-accent hover:underline" onClick={() => copyText(share.manageUrl, "Lien de gestion copié")}>
            Copier le lien de gestion
          </button>
        </div>
      </div>

      <ul className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-line" aria-label="Progression par fichier">
        {snap.items.map((it) => (
          <ItemRow key={it.uid} it={it} onCancel={() => session.cancel(it.uid)} onRetry={() => session.retry(it.uid)} />
        ))}
      </ul>

      <input ref={moreInput} type="file" multiple hidden onChange={(e) => (onMore([...(e.target.files ?? [])]), (e.target.value = ""))} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => moreInput.current?.click()}>
          <Plus className="size-4" /> Ajouter des fichiers
        </button>
        {snap.running ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => session.cancelAll()}>
            <X className="size-4" /> Tout annuler
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={onReset}>
            <RotateCcw className="size-4" /> Nouvel envoi
          </button>
        )}
      </div>
    </div>
  );
}

function ItemRow({ it, onCancel, onRetry }: { it: UploadItem; onCancel: () => void; onRetry: () => void }) {
  const pct = it.file.size ? it.sent / it.file.size : it.status === "done" ? 1 : 0;
  const label =
    it.status === "queued"
      ? "En attente"
      : it.status === "uploading"
        ? `${Math.floor(pct * 100)} %`
        : it.status === "finalizing"
          ? "Analyse…"
          : it.status === "done"
            ? "Envoyé"
            : it.status === "canceled"
              ? "Annulé"
              : "Échec";
  return (
    <li className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-0">
      <FileGlyph name={it.name} mime={it.file.type} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium" title={it.name}>
            {middleEllipsis(it.name, 40)}
          </p>
          <span
            className={`shrink-0 font-mono text-xs ${
              it.status === "done" ? "text-ok" : it.status === "error" ? "text-danger" : "text-muted"
            }`}
          >
            {label}
          </span>
        </div>
        {it.status === "error" ? (
          <p className="mt-0.5 text-xs text-danger">{it.error}</p>
        ) : it.status === "done" && it.result?.risk === "high" ? (
          <p className="mt-0.5 text-xs text-warn">Marqué à risque : les destinataires verront un avertissement.</p>
        ) : (
          <div className="mt-1.5">
            <ProgressBar value={pct} active={it.status === "uploading"} tone={it.status === "done" ? "ok" : "accent"} />
          </div>
        )}
      </div>
      {(it.status === "uploading" || it.status === "queued") && (
        <button type="button" className="btn btn-ghost btn-icon size-8" aria-label={`Annuler ${it.name}`} onClick={onCancel}>
          <X className="size-4" />
        </button>
      )}
      {(it.status === "error" || it.status === "canceled") && (
        <button type="button" className="btn btn-ghost btn-icon size-8" aria-label={`Réessayer ${it.name}`} onClick={onRetry}>
          <RotateCcw className="size-4" />
        </button>
      )}
      {it.status === "done" && <Check className="size-4 shrink-0 text-ok" aria-hidden />}
    </li>
  );
}

