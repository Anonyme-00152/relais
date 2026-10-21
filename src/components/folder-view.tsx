"use client";

import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileArchive,
  Flag,
  FolderX,
  Hash,
  KeyRound,
  Lock,
  Plus,
  QrCode as QrIcon,
  Search,
  Settings2,
  ShieldAlert,
  ShieldOff,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { EXPIRY_OPTIONS, LIMITS } from "@/lib/config";
import { api, ApiFail, fileUrl } from "@/lib/client/api";
import { forgetOwned, ownerToken, patchOwned, rememberOwned } from "@/lib/client/owned";
import { UploadSession } from "@/lib/client/uploader";
import { CATEGORY_LABEL, categoryOf, previewKind } from "@/lib/filetypes";
import { formatBytes, formatDate, formatRemaining, middleEllipsis, plural } from "@/lib/format";
import type { FileView, FolderView } from "@/lib/types";
import { FileGlyph, ProgressBar, QrCode, RiskChip } from "./file-bits";
import { Modal } from "./modal";
import { copyText, toast } from "./toast";

type State = { kind: "loading" } | { kind: "error"; status: number; message: string } | { kind: "ready"; view: FolderView };

export function FolderPage({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [owner, setOwner] = useState<string | null>(null);

  const load = useCallback(
    async (tok: string | null, countView = false) => {
      try {
        const view = await api.folder(id, tok, countView);
        setState({ kind: "ready", view });
        if (view.isOwner && tok) patchOwned(id, { fileCount: view.fileCount, totalSize: view.totalSize, expiresAt: view.expiresAt, title: view.title });
        return view;
      } catch (e) {
        const f = e instanceof ApiFail ? e : new ApiFail(0, "network", "Connexion impossible.");
        setState({ kind: "error", status: f.status, message: f.message });
        return null;
      }
    },
    [id],
  );

  useEffect(() => {
    // Lien de gestion : la clé voyage dans le fragment (#cle=…), jamais envoyé au serveur par le navigateur.
    const m = /[#&]cle=([A-Za-z0-9_-]{20,})/.exec(window.location.hash);
    let tok = ownerToken(id);
    if (m) {
      tok = m[1];
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setOwner(tok);
    const seenKey = `relais:seen:${id}`;
    let first = false;
    try {
      first = !sessionStorage.getItem(seenKey);
      sessionStorage.setItem(seenKey, "1");
    } catch {}
    load(tok, first).then((view) => {
      if (m && view?.isOwner) {
        rememberOwned({
          id,
          token: m[1],
          createdAt: view.createdAt,
          expiresAt: view.expiresAt,
          title: view.title,
          fileCount: view.fileCount,
          totalSize: view.totalSize,
        });
        toast("Clé de gestion enregistrée sur cet appareil");
      } else if (m && view && !view.isOwner) {
        setOwner(ownerToken(id));
        toast("Ce lien de gestion n'est pas valide", "warn");
      }
    });
  }, [id, load]);

  const reload = useCallback(() => load(owner), [load, owner]);

  return (
    <div className="relative">
      <div className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-96 [mask-image:linear-gradient(black,transparent)]" aria-hidden />
      <div className="shell relative max-w-5xl pt-8 pb-16 sm:pt-12">
        {state.kind === "loading" && <Skeleton />}
        {state.kind === "error" && <ErrorCard status={state.status} message={state.message} />}
        {state.kind === "ready" && !state.view.unlocked && state.view.suspended && <ErrorCard status={451} message="" />}
        {state.kind === "ready" && !state.view.unlocked && !state.view.suspended && (
          <Unlock view={state.view} onUnlocked={(v) => setState({ kind: "ready", view: v })} />
        )}
        {state.kind === "ready" && state.view.unlocked && <FolderMain view={state.view} owner={state.view.isOwner ? owner : null} reload={reload} />}
      </div>
    </div>
  );
}

/* ---------- États ---------- */

function Skeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Chargement">
      <div className="card p-7">
        <div className="h-4 w-28 rounded bg-bg2" />
        <div className="mt-4 h-8 w-2/3 rounded-lg bg-bg2" />
        <div className="mt-4 flex gap-3">
          <div className="h-6 w-24 rounded-full bg-bg2" />
          <div className="h-6 w-24 rounded-full bg-bg2" />
          <div className="h-6 w-32 rounded-full bg-bg2" />
        </div>
      </div>
      <div className="card mt-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line p-5 last:border-0">
            <div className="size-10 rounded-xl bg-bg2" />
            <div className="h-4 flex-1 rounded bg-bg2" />
            <div className="h-9 w-28 rounded-lg bg-bg2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorCard({ status, message }: { status: number; message: string }) {
  const suspended = status === 451;
  const missing = status === 404;
  return (
    <div className="card mx-auto max-w-lg p-8 text-center sm:p-10">
      <span className={`mx-auto grid size-16 place-items-center rounded-2xl ${suspended ? "bg-danger-soft text-danger" : "bg-bg2 text-muted"}`}>
        {suspended ? <ShieldOff className="size-8" /> : <FolderX className="size-8" />}
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        {suspended ? "Dépôt suspendu" : missing ? "Ce lien n'existe plus" : "Chargement impossible"}
      </h1>
      <p className="mt-3 leading-relaxed text-muted">
        {suspended
          ? "Ce dépôt a été signalé à plusieurs reprises et n'est plus accessible en attendant son examen."
          : missing
            ? "Il a expiré, a été supprimé par son expéditeur, ou l'adresse est incomplète. Demandez un nouveau lien à la personne qui vous l'a envoyé."
            : message}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {!missing && !suspended && (
          <button type="button" className="btn btn-outline" onClick={() => location.reload()}>
            Réessayer
          </button>
        )}
        <Link href="/" className="btn btn-primary">
          <UploadCloud className="size-4" /> Envoyer mes fichiers
        </Link>
      </div>
    </div>
  );
}

function Unlock({ view, onUnlocked }: { view: FolderView; onUnlocked: (v: FolderView) => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="card mx-auto max-w-md p-8 sm:p-10"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!pw || busy) return;
        setBusy(true);
        setErr(null);
        try {
          onUnlocked(await api.unlock(view.id, pw));
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Erreur");
          setPw("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Lock className="size-7" />
      </span>
      <h1 className="mt-6 text-center text-2xl font-semibold tracking-tight">{view.title || "Dépôt protégé"}</h1>
      <p className="mt-2 text-center text-sm text-muted">
        {plural(view.fileCount, "fichier")} · {formatBytes(view.totalSize)} · protégé par mot de passe
      </p>
      <label htmlFor="unlock-pw" className="label mt-8">
        Mot de passe
      </label>
      <input
        id="unlock-pw"
        type="password"
        autoComplete="current-password"
        autoFocus
        className="field"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        aria-invalid={!!err}
        aria-describedby={err ? "unlock-err" : undefined}
      />
      {err && (
        <p id="unlock-err" role="alert" className="mt-2 text-sm text-danger">
          {err}
        </p>
      )}
      <button type="submit" className="btn btn-primary mt-5 w-full" disabled={!pw || busy}>
        {busy ? "Vérification…" : "Déverrouiller"}
      </button>
      <p className="mt-5 text-center text-xs text-muted">Vous n&apos;avez pas le mot de passe ? Demandez-le à l&apos;expéditeur.</p>
    </form>
  );
}

/* ---------- Vue principale ---------- */

type Sort = "name" | "size" | "type" | "date";

function FolderMain({ view, owner, reload }: { view: FolderView; owner: string | null; reload: () => Promise<unknown> }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("date");
  const [preview, setPreview] = useState<number | null>(null);
  const [confirmFile, setConfirmFile] = useState<FileView | null>(null);
  const [confirmZip, setConfirmZip] = useState(false);
  const [qr, setQr] = useState(false);
  const [report, setReport] = useState(false);
  const [settings, setSettings] = useState(false);
  const [zip, setZip] = useState<{ done: number; total: number } | null>(null);
  const shareUrl = typeof window !== "undefined" ? `${location.origin}/d/${view.id}` : `/d/${view.id}`;

  const files = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = view.files.filter((f) => !q || f.name.toLowerCase().includes(q));
    const by: Record<Sort, (a: FileView, b: FileView) => number> = {
      name: (a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }),
      size: (a, b) => b.size - a.size,
      type: (a, b) => categoryOf(a.name).localeCompare(categoryOf(b.name)) || a.name.localeCompare(b.name),
      date: (a, b) => a.createdAt - b.createdAt,
    };
    return [...list].sort(by[sort]);
  }, [view.files, query, sort]);

  const risky = view.files.filter((f) => f.risk === "high");
  const empty = view.files.length === 0;

  const download = (f: FileView, force = false) => {
    if (f.risk === "high" && !force && !owner) return setConfirmFile(f);
    const a = document.createElement("a");
    a.href = fileUrl(view.id, f.id);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  async function downloadAll(force = false) {
    if (risky.length && !force && !owner) return setConfirmZip(true);
    const total = view.totalSize;
    const name = `${(view.title || `relais-${view.id}`).replace(/[^\p{L}\p{N} ._-]+/gu, "_").slice(0, 60)}.zip`;
    try {
      const { downloadZip } = await import("client-zip");
      const used = new Map<string, number>();
      const unique = (n: string) => {
        const c = used.get(n) ?? 0;
        used.set(n, c + 1);
        if (!c) return n;
        const dot = n.lastIndexOf(".");
        return dot > 0 ? `${n.slice(0, dot)} (${c + 1})${n.slice(dot)}` : `${n} (${c + 1})`;
      };
      const list = view.files;
      async function* entries() {
        for (const f of list) {
          const res = await fetch(`${fileUrl(view.id, f.id)}?zip=1`);
          if (!res.ok) throw new Error(`Échec sur ${f.name}`);
          yield { name: unique(f.name), input: res, size: f.size, lastModified: new Date(f.createdAt) };
        }
      }
      setZip({ done: 0, total });
      let done = 0;
      const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctrl) {
          done += chunk.length;
          setZip({ done: Math.min(done, total), total });
          ctrl.enqueue(chunk);
        },
      });
      const stream = downloadZip(entries()).body!.pipeThrough(counter);
      const picker = (window as unknown as { showSaveFilePicker?: (o: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
      if (picker) {
        // Écriture en flux directement sur le disque : aucune limite de mémoire.
        const handle = await picker({ suggestedName: name, types: [{ description: "Archive ZIP", accept: { "application/zip": [".zip"] } }] });
        await stream.pipeTo(await (handle as FileSystemFileHandle & { createWritable(): Promise<WritableStream> }).createWritable());
      } else {
        const blob = await new Response(stream).blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
      }
      toast("Archive téléchargée");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) toast(e instanceof Error ? e.message : "Téléchargement interrompu", "warn");
    } finally {
      setZip(null);
    }
  }

  const previewable = (f: FileView) => previewKind(f.name, f.mime) !== null || !!f.archive;

  return (
    <>
      {/* En-tête */}
      <section className="card animate-rise overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="eyebrow flex items-center gap-2">
                Dépôt partagé {view.protected && <Lock className="size-3" aria-label="protégé" />}
              </p>
              <h1 className="mt-2 text-[clamp(1.6rem,4vw,2.3rem)] font-semibold leading-tight tracking-[-0.03em] break-words">
                {view.title || (empty ? "Dépôt vide" : view.fileCount === 1 ? view.files[0].name : plural(view.fileCount, "fichier"))}
              </h1>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Meta>{plural(view.fileCount, "fichier")}</Meta>
                <Meta>{formatBytes(view.totalSize)}</Meta>
                <Meta>
                  <Clock3 className="size-3.5" aria-hidden /> expire dans {formatRemaining(view.expiresAt)}
                </Meta>
                {owner && <Meta>{plural(view.views, "visite")}</Meta>}
                {owner && <Meta>{plural(view.downloads, "téléchargement")}</Meta>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {!empty && (
                <button type="button" className="btn btn-primary" onClick={() => (view.files.length === 1 ? download(view.files[0]) : downloadAll())} disabled={!!zip}>
                  <ArrowDownToLine className="size-4" />
                  {view.files.length === 1 ? "Télécharger" : "Tout télécharger"}
                </button>
              )}
              <button type="button" className="btn btn-outline btn-icon size-11" onClick={() => copyText(shareUrl)} aria-label="Copier le lien">
                <Copy className="size-4" />
              </button>
              <button type="button" className="btn btn-outline btn-icon size-11" onClick={() => setQr(true)} aria-label="Afficher le QR code">
                <QrIcon className="size-4" />
              </button>
            </div>
          </div>

          {view.message && (
            <blockquote className="mt-6 rounded-2xl border-l-4 border-accent bg-raised px-5 py-4 text-[0.95rem] leading-relaxed whitespace-pre-line text-ink-2">
              {view.message}
            </blockquote>
          )}

          {zip && (
            <div className="mt-6" aria-live="polite">
              <div className="mb-2 flex justify-between text-sm">
                <span className="font-medium">Création de l&apos;archive…</span>
                <span className="font-mono text-muted">
                  {formatBytes(zip.done)} / {formatBytes(zip.total)}
                </span>
              </div>
              <ProgressBar value={zip.total ? zip.done / zip.total : 0} active />
            </div>
          )}
        </div>

        {owner && <OwnerBar view={view} owner={owner} reload={reload} onSettings={() => setSettings(true)} />}
      </section>

      {/* Avertissement global */}
      {risky.length > 0 && (
        <div role="note" className="animate-rise mt-5 flex gap-4 rounded-2xl border border-danger/25 bg-danger-soft p-5 [animation-delay:60ms]">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold text-danger">
              {risky.length === 1 ? "Un fichier peut exécuter du code" : `${risky.length} fichiers peuvent exécuter du code`} sur votre appareil.
            </p>
            <p className="mt-1 text-ink-2">
              N&apos;ouvrez un programme ou une archive que si vous connaissez l&apos;expéditeur et attendiez ce fichier. Une analyse favorable ne garantit jamais
              l&apos;absence de risque.{" "}
              <Link href="/securite" className="font-medium text-ink underline underline-offset-2">
                Comment vérifier un fichier
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Fichiers */}
      <section className="card animate-rise mt-5 overflow-hidden [animation-delay:90ms]" aria-label="Fichiers">
        {view.files.length > 5 && (
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                className="field h-10 pl-9"
                placeholder="Rechercher un fichier"
                aria-label="Rechercher un fichier"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              Trier
              <select className="field h-10 w-auto pr-8" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="date">Ordre d&apos;envoi</option>
                <option value="name">Nom</option>
                <option value="size">Taille</option>
                <option value="type">Type</option>
              </select>
            </label>
          </div>
        )}
        {empty ? (
          <div className="p-10 text-center">
            <p className="font-medium">Aucun fichier pour le moment.</p>
            <p className="mt-1 text-sm text-muted">{owner ? "Ajoutez des fichiers avec le bouton ci-dessus." : "L'expéditeur n'a pas encore terminé son envoi."}</p>
          </div>
        ) : files.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted">Aucun fichier ne correspond à « {query} ».</p>
        ) : (
          <ul>
            {files.map((f) => (
              <FileRow
                key={f.id}
                f={f}
                folderId={view.id}
                owner={owner}
                onDownload={() => download(f)}
                onPreview={previewable(f) ? () => setPreview(files.indexOf(f)) : undefined}
                reload={reload}
              />
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex flex-col items-start justify-between gap-3 px-1 text-xs text-muted sm:flex-row sm:items-center">
        <p className="max-w-xl leading-relaxed">
          Fichiers déposés par un tiers et analysés automatiquement par Relais. L&apos;analyse ne remplace pas votre vigilance.
        </p>
        <button type="button" className="inline-flex items-center gap-1.5 font-medium hover:text-ink" onClick={() => setReport(true)}>
          <Flag className="size-3.5" /> Signaler ce dépôt
        </button>
      </div>

      {/* Dialogues */}
      <PreviewModal files={files} index={preview} setIndex={setPreview} folderId={view.id} onDownload={download} />

      <Modal open={!!confirmFile} onClose={() => setConfirmFile(null)} title="Télécharger un fichier à risque ?">
        {confirmFile && (
          <RiskConfirm
            text={`« ${confirmFile.name} » peut exécuter du code sur votre appareil.`}
            warnings={confirmFile.warnings}
            onCancel={() => setConfirmFile(null)}
            onConfirm={() => {
              download(confirmFile, true);
              setConfirmFile(null);
            }}
          />
        )}
      </Modal>
      <Modal open={confirmZip} onClose={() => setConfirmZip(false)} title="Ce dépôt contient des fichiers à risque">
        <RiskConfirm
          text={`${plural(risky.length, "fichier")} de ce dépôt ${risky.length > 1 ? "peuvent" : "peut"} exécuter du code : ${risky
            .slice(0, 3)
            .map((f) => f.name)
            .join(", ")}${risky.length > 3 ? "…" : ""}.`}
          warnings={[]}
          onCancel={() => setConfirmZip(false)}
          onConfirm={() => {
            setConfirmZip(false);
            downloadAll(true);
          }}
        />
      </Modal>
      <Modal open={qr} onClose={() => setQr(false)} title="Ouvrir sur un autre appareil">
        <div className="flex flex-col items-center gap-5">
          <QrCode value={shareUrl} size={220} />
          <div className="flex w-full gap-2">
            <input readOnly value={shareUrl} className="field font-mono text-sm" aria-label="Lien" onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-primary" onClick={() => copyText(shareUrl)}>
              <Copy className="size-4" />
            </button>
          </div>
        </div>
      </Modal>
      <ReportModal open={report} onClose={() => setReport(false)} folderId={view.id} />
      {owner && <SettingsModal open={settings} onClose={() => setSettings(false)} view={view} owner={owner} reload={reload} />}
    </>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-bg2 px-3 py-1 text-ink-2">{children}</span>;
}

/* ---------- Ligne de fichier ---------- */

function FileRow({
  f,
  folderId,
  owner,
  onDownload,
  onPreview,
  reload,
}: {
  f: FileView;
  folderId: string;
  owner: string | null;
  onDownload: () => void;
  onPreview?: () => void;
  reload: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const detailsId = `details-${f.id}`;

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <li className="border-b border-line last:border-0">
      <div className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6">
        <FileGlyph name={f.name} mime={f.mime} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={f.name}>
            {middleEllipsis(f.name, 56)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span>{formatBytes(f.size)}</span>
            <span className="hidden sm:inline">{f.detected?.label ?? CATEGORY_LABEL[categoryOf(f.name, f.mime)]}</span>
            {f.archive && <span>{plural(f.archive.entries, "élément")}</span>}
            <RiskChip level={f.risk} compact />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onPreview && (
            <button type="button" className="btn btn-ghost btn-icon hidden sm:inline-flex" onClick={onPreview} aria-label={`Aperçu de ${f.name}`}>
              {f.archive ? <FileArchive className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          )}
          <button type="button" className="btn btn-outline btn-sm" onClick={onDownload} aria-label={`Télécharger ${f.name}`}>
            <Download className="size-4" />
            <span className="hidden sm:inline">Télécharger</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-expanded={open}
            aria-controls={detailsId}
            aria-label={open ? "Masquer les détails" : "Afficher les détails"}
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown className={`size-[18px] transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <div id={detailsId} className="animate-fade border-t border-line bg-raised px-4 py-5 sm:px-6">
          {f.warnings.length > 0 && (
            <ul className={`mb-5 grid gap-2 rounded-xl p-4 text-sm ${f.risk === "high" ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>
              {f.warnings.map((w) => (
                <li key={w} className="flex gap-2">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="text-ink-2">{w}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
            <Detail label="Type réel détecté">{f.detected?.label ?? "Non reconnu (texte ou format libre)"}</Detail>
            <Detail label="Ajouté le">{formatDate(f.createdAt)}</Detail>
            <Detail label="Téléchargements">{f.downloads.toLocaleString("fr-FR")}</Detail>
          </dl>
          <div className="mt-5">
            <p className="label flex items-center gap-1.5">
              <Hash className="size-3.5" aria-hidden /> Empreinte SHA-256
              <span className="font-normal text-muted">{f.sha256 ? (f.hashVerified ? "· calculée par le serveur" : "· calculée à l'envoi") : ""}</span>
            </p>
            {f.sha256 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="block flex-1 overflow-x-auto rounded-lg border border-line bg-card px-3 py-2 font-mono text-xs break-all">{f.sha256}</code>
                <div className="flex gap-1">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyText(f.sha256!, "Empreinte copiée")}>
                    <Copy className="size-3.5" /> Copier
                  </button>
                  <a className="btn btn-ghost btn-sm" href={`https://www.virustotal.com/gui/file/${f.sha256}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-3.5" /> VirusTotal
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Indisponible pour ce fichier.</p>
            )}
          </div>
          {f.archive && <ArchiveList f={f} limit={12} />}
          <div className="mt-5 flex flex-wrap gap-2">
            {onPreview && (
              <button type="button" className="btn btn-outline btn-sm sm:hidden" onClick={onPreview}>
                <Eye className="size-4" /> Aperçu
              </button>
            )}
            {owner && (
              <button
                type="button"
                className={`btn btn-sm ${armed ? "bg-danger text-white dark:text-bg" : "btn-ghost text-danger"}`}
                onClick={async () => {
                  if (!armed) return setArmed(true);
                  try {
                    await api.removeFile(folderId, f.id, owner);
                    toast("Fichier supprimé");
                    await reload();
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "Suppression impossible", "warn");
                  }
                }}
              >
                <Trash2 className="size-4" /> {armed ? "Confirmer la suppression" : "Supprimer ce fichier"}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}

function ArchiveList({ f, limit }: { f: FileView; limit?: number }) {
  const a = f.archive!;
  const risky = new Set(a.risky.map((r) => r.name));
  const list = limit ? a.list.filter((e) => !e.dir).slice(0, limit) : a.list;
  return (
    <div className="mt-5">
      <p className="label flex flex-wrap items-center gap-x-2">
        Contenu de l&apos;archive
        <span className="font-normal text-muted">
          {plural(a.entries, "élément")} · {formatBytes(a.totalSize)} une fois extrait{a.encrypted ? " · chiffrée" : ""}
        </span>
      </p>
      <ul className="max-h-[50vh] overflow-y-auto rounded-xl border border-line bg-card font-mono text-xs">
        {list.map((e, i) => (
          <li key={`${e.name}-${i}`} className={`flex items-center justify-between gap-4 border-b border-line px-3 py-1.5 last:border-0 ${risky.has(e.name) ? "bg-danger-soft text-danger" : ""}`}>
            <span className={`truncate ${e.dir ? "text-muted" : ""}`} title={e.name}>
              {risky.has(e.name) && <ShieldAlert className="mr-1.5 inline size-3.5 align-[-2px]" aria-label="à risque" />}
              {e.name}
            </span>
            {!e.dir && <span className="shrink-0 text-muted">{formatBytes(e.size)}</span>}
          </li>
        ))}
      </ul>
      {(a.truncated || (limit && a.list.filter((e) => !e.dir).length > limit) || a.entries > a.list.length) && (
        <p className="mt-2 text-xs text-muted">Liste partielle{limit ? " : ouvrez l'aperçu pour voir davantage" : ""}.</p>
      )}
    </div>
  );
}

/* ---------- Aperçu ---------- */

function PreviewModal({
  files,
  index,
  setIndex,
  folderId,
  onDownload,
}: {
  files: FileView[];
  index: number | null;
  setIndex: (i: number | null) => void;
  folderId: string;
  onDownload: (f: FileView) => void;
}) {
  const f = index !== null ? files[index] : null;
  const previewables = files.map((x, i) => (previewKind(x.name, x.mime) || x.archive ? i : -1)).filter((i) => i >= 0);
  const pos = index !== null ? previewables.indexOf(index) : -1;
  const go = useCallback(
    (d: number) => {
      if (pos < 0) return;
      setIndex(previewables[(pos + d + previewables.length) % previewables.length]);
    },
    [pos, previewables, setIndex],
  );

  useEffect(() => {
    if (index === null) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [index, go]);

  return (
    <Modal open={!!f} onClose={() => setIndex(null)} title={f ? `Aperçu de ${f.name}` : "Aperçu"} wide bare>
      {f && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
            <FileGlyph name={f.name} mime={f.mime} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{f.name}</p>
              <p className="text-xs text-muted">
                {formatBytes(f.size)}
                {previewables.length > 1 && ` · ${pos + 1} / ${previewables.length}`}
              </p>
            </div>
            {previewables.length > 1 && (
              <>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => go(-1)} aria-label="Précédent">
                  <ArrowLeft className="size-4" />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => go(1)} aria-label="Suivant">
                  <ArrowRight className="size-4" />
                </button>
              </>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onDownload(f)}>
              <Download className="size-4" /> <span className="hidden sm:inline">Télécharger</span>
            </button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setIndex(null)} aria-label="Fermer l'aperçu">
              <X className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-raised">
            <PreviewBody key={f.id} f={f} folderId={folderId} />
          </div>
        </div>
      )}
    </Modal>
  );
}

function PreviewBody({ f, folderId }: { f: FileView; folderId: string }) {
  const kind = previewKind(f.name, f.mime);
  const src = fileUrl(folderId, f.id, true);
  if (f.archive)
    return (
      <div className="p-5">
        <ArchiveList f={f} />
      </div>
    );
  if (kind === "image")
    return (
      <div className="grid min-h-[50vh] place-items-center bg-[repeating-conic-gradient(var(--bg-2)_0_25%,transparent_0_50%)] bg-[length:20px_20px] p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={f.name} className="max-h-[75dvh] max-w-full rounded-lg object-contain shadow-[var(--shadow)]" />
      </div>
    );
  if (kind === "video")
    return (
      <div className="bg-black">
        <video src={src} controls playsInline preload="metadata" className="mx-auto max-h-[75dvh] w-full" />
      </div>
    );
  if (kind === "audio")
    return (
      <div className="grid place-items-center p-12">
        <audio src={src} controls preload="metadata" className="w-full max-w-lg" />
      </div>
    );
  if (kind === "pdf") return <iframe src={src} title={f.name} className="h-[78dvh] w-full border-0 bg-white" />;
  if (kind === "text") return <TextPreview src={src} size={f.size} />;
  return <p className="p-10 text-center text-sm text-muted">Aperçu indisponible pour ce format.</p>;
}

const TEXT_MAX = 256 * 1024;

function TextPreview({ src, size }: { src: string; size: number }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(src, { headers: { Range: `bytes=0-${TEXT_MAX - 1}` }, signal: ctrl.signal })
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((b) => setText(new TextDecoder("utf-8", { fatal: false }).decode(b)))
      .catch(() => !ctrl.signal.aborted && setErr(true));
    return () => ctrl.abort();
  }, [src]);
  if (err) return <p className="p-10 text-center text-sm text-muted">Impossible de charger l&apos;aperçu.</p>;
  if (text === null) return <p className="p-10 text-center text-sm text-muted">Chargement…</p>;
  return (
    <div>
      <pre className="overflow-x-auto p-5 font-mono text-[0.8rem] leading-relaxed whitespace-pre text-ink">{text}</pre>
      {size > TEXT_MAX && <p className="border-t border-line px-5 py-3 text-xs text-muted">Aperçu limité aux 256 premiers Ko.</p>}
    </div>
  );
}

/* ---------- Confirmation, signalement ---------- */

function RiskConfirm({ text, warnings, onCancel, onConfirm }: { text: string; warnings: string[]; onCancel: () => void; onConfirm: () => void }) {
  const [ack, setAck] = useState(false);
  return (
    <div>
      <div className="flex gap-3 rounded-2xl bg-danger-soft p-4 text-sm">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div>
          <p className="font-medium text-ink">{text}</p>
          {warnings.length > 0 && (
            <ul className="mt-2 grid list-disc gap-1 pl-4 text-ink-2">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <ul className="mt-5 grid gap-2 text-sm text-ink-2">
        <li>• Ne lancez ce fichier que si vous connaissez l&apos;expéditeur et l&apos;attendiez.</li>
        <li>• Vérifiez son empreinte SHA-256 sur VirusTotal avant de l&apos;ouvrir.</li>
        <li>• Méfiez-vous des « outils gratuits », générateurs ou cracks : ce sont les vecteurs favoris des voleurs de mots de passe.</li>
      </ul>
      <label className="mt-5 flex items-start gap-3 rounded-xl border border-line p-3.5 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        Je comprends les risques et je souhaite télécharger quand même.
      </label>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annuler
        </button>
        <button type="button" className="btn btn-primary" disabled={!ack} onClick={onConfirm}>
          <Download className="size-4" /> Télécharger
        </button>
      </div>
    </div>
  );
}

const REASONS = [
  ["malware", "Logiciel malveillant ou fichier piégé"],
  ["phishing", "Hameçonnage ou arnaque"],
  ["copyright", "Atteinte au droit d'auteur"],
  ["illegal", "Contenu illégal"],
  ["other", "Autre motif"],
] as const;

function ReportModal({ open, onClose, folderId }: { open: boolean; onClose: () => void; folderId: string }) {
  const [reason, setReason] = useState<string>("malware");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Signaler ce dépôt">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await api.report(folderId, reason, details);
            toast(r.suspended ? "Merci. Le dépôt est désormais suspendu." : "Merci, votre signalement a été enregistré.");
            onClose();
            setDetails("");
            if (r.suspended) setTimeout(() => location.reload(), 1200);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Signalement impossible", "warn");
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset className="grid gap-2">
          <legend className="label">Motif</legend>
          {REASONS.map(([id, label]) => (
            <label key={id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${reason === id ? "border-accent bg-accent-soft" : "border-line"}`}>
              <input type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} className="accent-[var(--accent)]" />
              {label}
            </label>
          ))}
        </fieldset>
        <label htmlFor="report-details" className="label mt-5">
          Précisions <span className="font-normal text-muted">(facultatif)</span>
        </label>
        <textarea id="report-details" rows={3} maxLength={500} className="field" value={details} onChange={(e) => setDetails(e.target.value)} />
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Après {LIMITS.reportsToSuspend} signalements de personnes différentes, le dépôt est suspendu automatiquement. Votre adresse IP n&apos;est pas conservée.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            <Flag className="size-4" /> Envoyer le signalement
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Propriétaire ---------- */

function OwnerBar({ view, owner, reload, onSettings }: { view: FolderView; owner: string; reload: () => Promise<unknown>; onSettings: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<UploadSession | null>(null);

  const add = (files: File[]) => {
    if (!files.length) return;
    const s = session ?? new UploadSession(view.id, owner, () => void reload());
    if (!session) setSession(s);
    s.add(files);
  };

  return (
    <div className="border-t border-line bg-accent-soft/50 px-6 py-4 sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-4 text-accent" aria-hidden />
          Vous gérez ce dépôt
          {!!view.reports && <span className="chip bg-danger-soft text-danger">{plural(view.reports, "signalement")}</span>}
        </p>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          <input ref={input} type="file" multiple hidden onChange={(e) => (add([...(e.target.files ?? [])]), (e.target.value = ""))} />
          <button type="button" className="btn btn-outline btn-sm" onClick={() => input.current?.click()}>
            <Plus className="size-4" /> Ajouter
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={onSettings}>
            <Settings2 className="size-4" /> Réglages
          </button>
        </div>
      </div>
      {session && <InlineProgress session={session} />}
    </div>
  );
}

function InlineProgress({ session }: { session: UploadSession }) {
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  if (!snap.items.length) return null;
  const pct = snap.totalBytes ? snap.sentBytes / snap.totalBytes : 1;
  return (
    <div className="mt-4" aria-live="polite">
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-medium">
          {snap.running ? `Envoi de ${plural(snap.items.filter((i) => i.status !== "done" && i.status !== "canceled").length, "fichier")}…` : "Envoi terminé"}
          {snap.errorCount > 0 && ` · ${plural(snap.errorCount, "échec")}`}
        </span>
        <span className="font-mono text-muted">{Math.floor(pct * 100)} %</span>
      </div>
      <ProgressBar value={pct} active={snap.running} tone={snap.running ? "accent" : "ok"} />
    </div>
  );
}

function SettingsModal({ open, onClose, view, owner, reload }: { open: boolean; onClose: () => void; view: FolderView; owner: string; reload: () => Promise<unknown> }) {
  const router = useRouter();
  const [title, setTitle] = useState(view.title);
  const [message, setMessage] = useState(view.message);
  const [pwMode, setPwMode] = useState<"keep" | "set" | "remove">("keep");
  const [pw, setPw] = useState("");
  const [extend, setExtend] = useState("");
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(view.title);
      setMessage(view.message);
      setPwMode("keep");
      setPw("");
      setExtend("");
      setDel(false);
    }
  }, [open, view.title, view.message]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pwMode === "set" && pw.length < LIMITS.passwordMin) return toast(`Mot de passe : ${LIMITS.passwordMin} caractères minimum`, "warn");
    setBusy(true);
    try {
      await api.update(view.id, owner, {
        title,
        message,
        ...(pwMode === "set" ? { password: pw } : pwMode === "remove" ? { password: null } : {}),
        ...(extend ? { expiresIn: extend } : {}),
      });
      toast("Réglages enregistrés");
      await reload();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Enregistrement impossible", "warn");
    } finally {
      setBusy(false);
    }
  }

  async function destroy() {
    setBusy(true);
    try {
      await api.remove(view.id, owner);
      forgetOwned(view.id);
      toast("Dépôt supprimé définitivement");
      router.push("/mes-envois");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Suppression impossible", "warn");
      setBusy(false);
    }
  }

  const manageUrl = typeof window !== "undefined" ? `${location.origin}/d/${view.id}#cle=${owner}` : "";

  return (
    <Modal open={open} onClose={onClose} title="Réglages du dépôt">
      <form onSubmit={save} className="grid gap-5">
        <div>
          <label htmlFor="s-title" className="label">
            Titre
          </label>
          <input id="s-title" className="field" maxLength={LIMITS.titleMax} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="s-msg" className="label">
            Message
          </label>
          <textarea id="s-msg" rows={3} className="field" maxLength={LIMITS.messageMax} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <fieldset>
          <legend className="label">Mot de passe {view.protected ? "(actif)" : "(aucun)"}</legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-bg2 p-1 text-xs font-semibold sm:text-sm">
            {(
              [
                ["keep", "Inchangé"],
                ["set", view.protected ? "Changer" : "Définir"],
                ["remove", "Retirer"],
              ] as const
            )
              .filter(([m]) => m !== "remove" || view.protected)
              .map(([m, l]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={pwMode === m}
                  onClick={() => setPwMode(m)}
                  className={`h-9 rounded-lg transition-colors ${pwMode === m ? "bg-card text-ink shadow-[var(--shadow-sm)]" : "text-muted"}`}
                >
                  {l}
                </button>
              ))}
          </div>
          {pwMode === "set" && (
            <input
              type="password"
              autoComplete="new-password"
              className="field mt-2.5"
              placeholder={`${LIMITS.passwordMin} caractères minimum`}
              aria-label="Nouveau mot de passe"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          )}
        </fieldset>
        <div>
          <label htmlFor="s-exp" className="label">
            Expiration <span className="font-normal text-muted">· actuellement dans {formatRemaining(view.expiresAt)}</span>
          </label>
          <select id="s-exp" className="field" value={extend} onChange={(e) => setExtend(e.target.value)}>
            <option value="">Ne pas modifier</option>
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                Expirer dans {o.label} à partir de maintenant
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-xl bg-sun-soft p-4 text-sm">
          <p className="font-medium">Lien de gestion</p>
          <p className="mt-1 text-ink-2">Ouvrez-le sur un autre appareil pour gérer ce dépôt. Ne le partagez pas.</p>
          <button type="button" className="mt-2 font-medium text-accent hover:underline" onClick={() => copyText(manageUrl, "Lien de gestion copié")}>
            Copier le lien de gestion
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          {del ? (
            <button type="button" className="btn btn-sm bg-danger text-white dark:text-bg" onClick={destroy} disabled={busy}>
              <Trash2 className="size-4" /> Confirmer : tout supprimer
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setDel(true)}>
              <Trash2 className="size-4" /> Supprimer le dépôt
            </button>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Enregistrer
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
