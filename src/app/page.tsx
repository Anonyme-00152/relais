import {
  ArrowRight,
  Braces,
  Clock3,
  FileSearch,
  Fingerprint,
  Flag,
  Link2,
  Lock,
  PackageOpen,
  Server,
  ShieldCheck,
  Share2,
  UploadCloud,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { CodeBlock } from "@/components/code-block";
import { Uploader } from "@/components/uploader";
import { publicConfig } from "@/lib/server/folders";
import { formatBytes } from "@/lib/format";
import { site, siteHost } from "@/lib/config";

const STEPS = [
  {
    icon: UploadCloud,
    title: "Déposez",
    text: "Glissez des fichiers ou un dossier entier. L'envoi démarre aussitôt, par morceaux, et reprend tout seul après une coupure réseau.",
  },
  {
    icon: FileSearch,
    title: "Relais analyse",
    text: "Type réel détecté d'après les octets, contenu des archives listé, empreinte SHA-256 calculée. Les fichiers suspects sont signalés.",
  },
  {
    icon: Link2,
    title: "Partagez le lien",
    text: "Le lien est prêt avant même la fin de l'envoi. Copiez-le, scannez le QR code ou utilisez le partage natif du téléphone.",
  },
  {
    icon: Clock3,
    title: "Il expire",
    text: "Au bout d'une heure, d'un jour, d'une semaine ou d'un mois, le dépôt et ses fichiers sont supprimés définitivement.",
  },
];

const TYPES = [
  { label: "Documents", ex: ["PDF", "DOCX", "XLSX", "TXT"] },
  { label: "Images", ex: ["PNG", "JPG", "SVG", "HEIC"] },
  { label: "Vidéos", ex: ["MP4", "MOV", "MKV", "WEBM"] },
  { label: "Audio", ex: ["MP3", "WAV", "FLAC"] },
  { label: "Archives", ex: ["ZIP", "RAR", "7Z", "TAR.GZ"] },
  { label: "Développement", ex: ["Code source", "JSON", "Config"] },
  { label: "Logiciels", ex: ["EXE", "MSI", "DMG", "APK"], flag: true },
  { label: "Données", ex: ["CSV", "SQLite", "Sauvegardes"] },
];

const PROTECTIONS = [
  { icon: Fingerprint, title: "Type réel, pas le nom", text: "Un « photo.jpg » qui contient un programme Windows est démasqué grâce à sa signature binaire." },
  { icon: PackageOpen, title: "Archives inspectées", text: "Le contenu d'un ZIP est listé sans l'extraire : exécutables cachés, chemins piégés, bombes zip." },
  { icon: ShieldCheck, title: "Empreinte SHA-256", text: "Vérifiez l'intégrité du fichier et consultez sa réputation sur VirusTotal en un clic, sans le téléverser." },
  { icon: Lock, title: "Mot de passe", text: "Haché avec scrypt, jamais stocké en clair. Tentatives limitées pour empêcher le forçage." },
  { icon: Server, title: "Stockage privé", text: "Aucun fichier n'est public. Chaque téléchargement reçoit une autorisation de quelques minutes." },
  { icon: Flag, title: "Signalement", text: "Un bouton sur chaque page. Après plusieurs signalements distincts, le dépôt est suspendu." },
];

const COMPARE: [string, string, string][] = [
  ["Envoyer sans créer de compte", "Oui", "Non"],
  ["Partager par simple lien", "Oui", "Oui"],
  ["Expiration automatique", "Oui, au choix", "Manuelle"],
  ["Analyse des fichiers reçus", "Type réel, archives, empreinte", "Antivirus du service"],
  ["Modifier des documents en ligne", "Non, ce n'est pas le but", "Oui"],
  ["Travail collaboratif", "Non", "Oui"],
  ["API d'envoi en une commande", "curl -T", "API OAuth complexe"],
];

const FAQ = [
  {
    q: "Faut-il créer un compte ?",
    a: "Non. Vous déposez, vous obtenez un lien. Une clé de gestion, mémorisée dans votre navigateur et copiable sous forme de lien, vous permet ensuite de modifier ou supprimer le dépôt.",
  },
  {
    q: "Combien de temps mes fichiers restent-ils en ligne ?",
    a: "Vous choisissez : 1 heure, 24 heures, 7 jours (par défaut) ou 30 jours. Vous pouvez prolonger depuis la page de gestion. À l'expiration, tout est supprimé, y compris les fichiers. Relais n'est pas une sauvegarde : gardez toujours vos originaux.",
  },
  {
    q: "Les fichiers sont-ils analysés par un antivirus ?",
    a: "Relais vérifie le type réel de chaque fichier, inspecte le contenu des archives ZIP et calcule une empreinte SHA-256 consultable sur VirusTotal. C'est une première barrière, pas une garantie : aucun outil ne peut certifier qu'un fichier est sans danger. N'ouvrez jamais un programme dont vous ne connaissez pas l'expéditeur.",
  },
  {
    q: "Qui peut voir mes fichiers ?",
    a: "Uniquement les personnes qui ont le lien, et le mot de passe si vous en avez défini un. Les liens sont aléatoires, non indexés par les moteurs de recherche, et les fichiers sont stockés dans un espace privé.",
  },
  {
    q: "Mon envoi a été coupé, dois-je tout recommencer ?",
    a: "Non. L'envoi se fait par morceaux : après une coupure, il reprend à partir du dernier morceau confirmé par le serveur. Gardez simplement l'onglet ouvert.",
  },
  {
    q: "Puis-je automatiser des envois ?",
    a: "Oui, une API REST permet d'envoyer un fichier en une commande (curl -T), de créer des dépôts, de les protéger et de les supprimer. Voir la page Développeurs.",
  },
  {
    q: "Que faire si je trouve un fichier illégal ou malveillant ?",
    a: "Utilisez le bouton « Signaler » présent sur chaque page de téléchargement. Au-delà de trois signalements distincts, le dépôt est suspendu automatiquement en attendant examen.",
  },
];

export default function Home() {
  const cfg = publicConfig();
  const maxFile = formatBytes(cfg.maxFileSize, 0);

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden />
        <div className="pointer-events-none absolute -top-40 right-[-10%] size-[42rem] rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute top-40 left-[-15%] size-[28rem] rounded-full bg-sun/10 blur-3xl" aria-hidden />

        <div className="shell relative grid items-center gap-12 pt-10 pb-20 sm:pt-16 lg:grid-cols-[1fr_minmax(0,32rem)] lg:gap-16 lg:pt-20 lg:pb-28">
          <div className="animate-rise max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card/70 px-3 py-1.5 text-xs font-medium text-ink-2 backdrop-blur">
              <span className="size-1.5 rounded-full bg-ok shadow-[0_0_0_3px_var(--ok-soft)]" aria-hidden />
              Sans compte · jusqu&apos;à {maxFile} par fichier
            </p>
            <h1 className="mt-6 text-[clamp(2.6rem,6.4vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.045em]">
              Envoyez lourd.
              <br />
              Partagez <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.02em] text-accent">léger.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[1.075rem] leading-relaxed text-ink-2">
              Relais héberge vos fichiers et les transmet par un simple lien. Vidéos, archives, projets entiers&nbsp;: déposez, partagez, c&apos;est tout. Et
              vos destinataires savent ce qu&apos;ils téléchargent.
            </p>
            <ul className="mt-8 hidden gap-3 text-sm text-ink-2 sm:grid sm:grid-cols-2">
              {[
                [UserX, "Aucune inscription"],
                [Lock, "Mot de passe et expiration"],
                [FileSearch, "Fichiers analysés à l'envoi"],
                [Braces, "API en une commande"],
              ].map(([Icon, t]) => {
                const I = Icon as typeof Lock;
                return (
                  <li key={t as string} className="flex items-center gap-2.5">
                    <span className="grid size-7 place-items-center rounded-lg bg-card text-accent shadow-[var(--shadow-sm)] ring-1 ring-line">
                      <I className="size-4" aria-hidden />
                    </span>
                    {t as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="animate-rise [animation-delay:120ms]">
            <Uploader />
          </div>
        </div>
      </section>

      {/* ---------- Fonctionnement ---------- */}
      <section id="fonctionnement" className="shell py-20">
        <SectionHead eyebrow="Fonctionnement" title="De votre disque à leur écran, en quatre temps." />
        <ol className="relative mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-line2 to-transparent lg:block" aria-hidden />
          {STEPS.map((s, i) => (
            <li key={s.title} className="card relative p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <s.icon className="size-6" strokeWidth={1.8} aria-hidden />
                </span>
                <span className="font-mono text-xs text-muted">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Usages ---------- */}
      <section className="shell py-12">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="card p-7 lg:col-span-2">
            <p className="eyebrow">Usages</p>
            <h2 className="mt-3 max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">Un fichier trop lourd pour un e-mail&nbsp;? C&apos;est exactement pour ça.</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {[
                ["Héberger", "Photos, vidéos, PDF, archives, programmes : vos fichiers vivent en ligne le temps nécessaire, pas sur une clé USB."],
                ["Partager", "Un seul lien pour un dossier entier. Plus besoin de renvoyer le fichier à chaque destinataire."],
                ["Distribuer", "Ressources de cours, rushes vidéo, builds de jeu : les destinataires récupèrent tout, fichier par fichier ou en ZIP."],
              ].map(([t, d]) => (
                <div key={t}>
                  <p className="font-semibold">{t}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{d}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="card flex flex-col justify-between overflow-hidden bg-ink p-7 text-bg dark:bg-raised dark:text-ink">
            <div>
              <p className="eyebrow !text-current opacity-60">Automatiser</p>
              <p className="mt-3 text-xl font-semibold tracking-tight">Un script, une commande, un lien.</p>
            </div>
            <pre className="mt-6 overflow-x-auto rounded-xl bg-white/[0.06] p-4 font-mono text-[0.78rem] leading-relaxed dark:bg-bg">
              <span className="opacity-50">$</span> curl -T projet.zip \{"\n"}
              {"  "}{siteHost}/api/v1/upload/projet.zip
            </pre>
            <Link href="/developpeurs" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-sun dark:text-accent">
              Documentation de l&apos;API <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Types ---------- */}
      <section id="types" className="shell py-20">
        <SectionHead eyebrow="Formats" title="Tous les types de fichiers." text="Sans conversion ni compression : le fichier reçu est identique, octet pour octet, au fichier envoyé." />
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TYPES.map((t) => (
            <div key={t.label} className={`rounded-2xl border p-5 ${t.flag ? "border-danger/25 bg-danger-soft/50" : "border-line bg-card"}`}>
              <p className="font-semibold">{t.label}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.ex.map((e) => (
                  <span key={e} className="rounded-md bg-bg2 px-1.5 py-0.5 font-mono text-[0.7rem] text-ink-2">
                    {e}
                  </span>
                ))}
              </div>
              {t.flag && <p className="mt-3 text-xs leading-relaxed text-danger">Acceptés, mais signalés aux destinataires.</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Sécurité ---------- */}
      <section id="securite" className="relative overflow-hidden border-y border-line bg-bg2/60 py-24">
        <div className="shell grid items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Confiance</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.05]">
              Un service de partage n&apos;est pas un virus.{" "}
              <span className="font-serif font-normal italic text-accent">Un fichier, parfois si.</span>
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-ink-2">
              N&apos;importe qui peut héberger n&apos;importe quoi sur un service de partage. Relais ne se contente pas de stocker&nbsp;: chaque fichier est
              examiné à l&apos;arrivée, et ce qu&apos;on trouve est montré clairement aux personnes qui téléchargent.
            </p>
            <Link href="/securite" className="btn btn-outline mt-8">
              Le guide pour télécharger sans risque <ArrowRight className="size-4" />
            </Link>
          </div>
          <AnalysisDemo />
        </div>
        <div className="shell mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {PROTECTIONS.map((p) => (
            <div key={p.title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-accent shadow-[var(--shadow-sm)] ring-1 ring-line">
                <p.icon className="size-5" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <p className="font-semibold">{p.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Comparatif ---------- */}
      <section id="comparatif" className="shell py-24">
        <SectionHead eyebrow="Comparatif" title="Relais ou cloud collaboratif ?" text="Les deux stockent et partagent. Relais est taillé pour transmettre, un cloud collaboratif pour travailler ensemble." />
        <div className="card mt-12 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="px-6 py-4 font-medium text-muted">
                  Fonction
                </th>
                <th scope="col" className="px-6 py-4">
                  <span className="inline-flex items-center gap-2 font-semibold text-accent">
                    <Share2 className="size-4" aria-hidden /> Relais
                  </span>
                </th>
                <th scope="col" className="px-6 py-4 font-semibold">
                  Cloud collaboratif
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([f, a, b]) => (
                <tr key={f} className="border-b border-line last:border-0">
                  <th scope="row" className="px-6 py-4 font-medium">
                    {f}
                  </th>
                  <td className="px-6 py-4 text-ink-2">{a}</td>
                  <td className="px-6 py-4 text-muted">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- API ---------- */}
      <section className="shell py-12">
        <div className="card grid gap-10 overflow-hidden p-7 sm:p-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <p className="eyebrow">Pour les développeurs</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Une API REST sans clé à demander.</h2>
            <p className="mt-4 leading-relaxed text-ink-2">
              Envoyez depuis un script Python, une CI ou un terminal. La réponse contient le lien public et la clé de gestion du dépôt&nbsp;; ajoutez,
              protégez ou supprimez ensuite par de simples requêtes HTTP.
            </p>
            <Link href="/developpeurs" className="btn btn-primary mt-7">
              Lire la documentation <ArrowRight className="size-4" />
            </Link>
          </div>
          <CodeBlock
            lang="python"
            code={`import requests

with open("rapport.pdf", "rb") as f:
    r = requests.put("${site.url}/api/v1/upload/rapport.pdf",
                     data=f, headers={"X-Relais-Expires": "7d"})

depot = r.json()["folder"]
print(depot["url"])        # lien à partager
print(depot["ownerToken"]) # clé de gestion`}
          />
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="shell py-24">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHead eyebrow="FAQ" title="Questions fréquentes." text="Une autre question ? Le guide de sécurité et la documentation détaillent tout le reste." align="left" />
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex list-none items-center justify-between gap-6 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line2 text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 pr-10 leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="shell">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-accent px-7 py-14 text-center text-on-accent sm:px-12 sm:py-20">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [--grid:rgb(255_255_255/0.1)]" aria-hidden />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Votre prochain fichier lourd part en <span className="font-serif font-normal italic">trois secondes</span>.
          </h2>
          <Link href="/" className="btn btn-lg relative mt-9 bg-card text-ink hover:bg-raised">
            <UploadCloud className="size-5" /> Envoyer des fichiers
          </Link>
        </div>
      </section>
    </>
  );
}

function SectionHead({ eyebrow, title, text, align = "center" }: { eyebrow: string; title: string; text?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-md"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem] sm:leading-[1.05]">{title}</h2>
      {text && <p className="mt-4 leading-relaxed text-ink-2">{text}</p>}
    </div>
  );
}

/** Exemple statique d'analyse, tel qu'il apparaît sur une page de téléchargement. */
function AnalysisDemo() {
  return (
    <div className="card relative p-5 sm:p-6" aria-label="Exemple d'analyse d'un fichier suspect">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-danger-soft text-danger">
          <FileSearch className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-medium">facture_mars.pdf.exe</p>
          <p className="text-xs text-muted">412 Ko · envoyé il y a 2 min</p>
        </div>
        <span className="chip ml-auto bg-danger-soft text-danger">À risque</span>
      </div>
      <ul className="mt-5 grid gap-2.5 text-sm">
        {[
          ["Type réel", "exécutable Windows (PE)", "danger"],
          ["Extension", "double extension « .pdf.exe »", "danger"],
          ["Archive", "—", "muted"],
          ["SHA-256", "9f2c…e41a", "mono"],
        ].map(([k, v, tone]) => (
          <li key={k} className="flex items-center justify-between gap-4 rounded-xl bg-raised px-3.5 py-2.5">
            <span className="text-muted">{k}</span>
            <span className={`text-right font-medium ${tone === "danger" ? "text-danger" : tone === "mono" ? "font-mono text-xs" : "text-muted"}`}>{v}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl bg-danger-soft px-3.5 py-3 text-sm leading-relaxed text-danger">
        Ce fichier se présente comme un PDF mais contient en réalité un programme. Ne l&apos;ouvrez pas si vous ne connaissez pas l&apos;expéditeur.
      </p>
    </div>
  );
}
