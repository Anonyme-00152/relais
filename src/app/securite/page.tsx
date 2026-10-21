import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocLayout } from "@/components/doc-layout";

export const metadata: Metadata = {
  title: "Télécharger sans risque",
  description:
    "Pourquoi trouve-t-on parfois des fichiers dangereux sur les services de partage, comment les reconnaître, et ce que Relais vérifie pour vous.",
  alternates: { canonical: "/securite" },
};

const RISKS: [string, string][] = [
  [".exe, .msi, .bat, .scr", "Lancent un programme dès l'ouverture. C'est le format des voleurs de mots de passe (« stealers ») et des chevaux de Troie (RAT)."],
  [".zip, .rar, .7z", "Peuvent cacher un exécutable au milieu de fichiers anodins. Une archive chiffrée échappe à toute analyse avant extraction."],
  ["« facture.pdf.exe »", "La double extension imite un document. Windows masque souvent la vraie extension : on ne voit que « facture.pdf »."],
  [".docm, .xlsm", "Documents Office pouvant contenir des macros. Le piège classique : « Activez le contenu pour afficher le document »."],
  [".lnk, .iso, .js, .vbs", "Raccourcis, images disques et scripts : contournent souvent les avertissements du système."],
];

export default function Page() {
  return (
    <DocLayout
      eyebrow="Guide"
      title={
        <>
          Télécharger <span className="font-serif font-normal italic text-accent">sans risque</span>
        </>
      }
      lead={
        <>
          Un service de partage de fichiers n&apos;est ni un virus ni un dépôt officiel de logiciels&nbsp;: ce sont les fichiers hébergés, leur provenance et leur
          contenu qui déterminent le risque. Voici comment les juger.
        </>
      }
      toc={[
        ["pourquoi", "Pourquoi des fichiers suspects ?"],
        ["formats", "Formats à surveiller"],
        ["reflexes", "Les bons réflexes"],
        ["relais", "Ce que Relais vérifie"],
        ["limites", "Ce que Relais ne peut pas faire"],
        ["signaler", "Signaler un fichier"],
      ]}
    >
      <section id="pourquoi">
        <h2>Pourquoi trouve-t-on parfois des fichiers suspects&nbsp;?</h2>
        <p>
          Un service comme Relais est un <strong>hébergeur</strong>, pas un catalogue&nbsp;: les fichiers ne sont ni créés ni vérifiés à la main par
          l&apos;éditeur du site. N&apos;importe qui peut déposer un fichier et en partager le lien. La grande majorité des usages sont légitimes&nbsp;:
        </p>
        <ul>
          <li>un développeur partage le code source de son application&nbsp;;</li>
          <li>un étudiant transmet l&apos;archive de son projet&nbsp;;</li>
          <li>un vidéaste envoie ses rushes à un monteur&nbsp;;</li>
          <li>un chercheur en sécurité partage un échantillon dans un cadre d&apos;analyse.</li>
        </ul>
        <p>
          Mais une personne malveillante peut aussi tenter d&apos;y diffuser un programme qui vole des mots de passe ou espionne un ordinateur. Le nom du site
          ne dit donc rien du fichier&nbsp;: il faut examiner <strong>le fichier lui-même et son origine</strong>.
        </p>
      </section>

      <section id="formats">
        <h2>Les formats à surveiller</h2>
        <div className="not-prose grid gap-3">
          {RISKS.map(([k, v]) => (
            <div key={k} className="grid gap-1 rounded-2xl border border-line bg-card p-5 sm:grid-cols-[11rem_1fr] sm:gap-6">
              <p className="font-mono text-sm font-semibold text-danger">{k}</p>
              <p className="text-[0.95rem] leading-relaxed text-ink-2">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-5">
          Une page de téléchargement peut aussi chercher à vous tromper avec de faux boutons ou un fichier différent de celui annoncé. Sur Relais, le seul
          bouton de téléchargement est celui de la ligne du fichier, et il n&apos;y a aucune publicité.
        </p>
      </section>

      <section id="reflexes">
        <h2>Les bons réflexes</h2>
        <ol className="not-prose mt-4 grid gap-3">
          {[
            ["Connaissez-vous l'expéditeur ?", "Un lien reçu d'un inconnu, dans un commentaire ou un message privé inattendu, est suspect par défaut."],
            ["Le fichier correspond-il à ce qu'on vous a annoncé ?", "Une vidéo ne pèse pas 400 Ko ; un document n'a pas besoin d'être un .exe."],
            ["Vérifiez l'empreinte.", "Relais affiche le SHA-256 de chaque fichier. Comparez-le à celui publié par l'auteur, ou ouvrez-le sur VirusTotal."],
            ["N'activez jamais les macros", "d'un document reçu, même si le document vous le demande avec insistance."],
            ["Méfiez-vous des « outils gratuits ».", "Cracks, générateurs, triches et « optimiseurs » sont les appâts préférés des voleurs de comptes."],
            ["En cas de doute, ne l'ouvrez pas.", "Une analyse favorable réduit le risque, elle ne l'annule jamais."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4 rounded-2xl bg-card p-5 ring-1 ring-line">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-sm font-semibold text-accent">{i + 1}</span>
              <p className="text-[0.95rem] leading-relaxed text-ink-2">
                <strong className="text-ink">{t}</strong> {d}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section id="relais">
        <h2>Ce que Relais vérifie pour vous</h2>
        <p>À la fin de chaque envoi, avant que quiconque puisse télécharger, le fichier passe par plusieurs contrôles&nbsp;:</p>
        <ul>
          <li>
            <strong>Type réel.</strong> Les premiers octets du fichier révèlent son format véritable. Une «&nbsp;photo&nbsp;» qui est en réalité un exécutable
            Windows, Linux ou macOS est signalée.
          </li>
          <li>
            <strong>Nom piégé.</strong> Doubles extensions, caractères invisibles d&apos;inversion de texte, extensions repoussées par des espaces.
          </li>
          <li>
            <strong>Contenu des archives ZIP.</strong> L&apos;index est lu sans extraire&nbsp;: exécutables cachés, chemins qui sortent de l&apos;archive,
            archives chiffrées et taux de compression anormaux («&nbsp;bombes zip&nbsp;»).
          </li>
          <li>
            <strong>Empreinte SHA-256.</strong> Calculée pendant l&apos;envoi, avec un lien direct vers VirusTotal. Votre fichier n&apos;est jamais transmis à
            un service tiers&nbsp;: seule l&apos;empreinte sert à la recherche.
          </li>
          <li>
            <strong>Confirmation explicite.</strong> Télécharger un fichier jugé à risque demande de cocher une case après lecture des avertissements.
          </li>
          <li>
            <strong>Aperçus cloisonnés.</strong> Les aperçus sont servis dans un bac à sable&nbsp;: un fichier HTML ou SVG piégé ne peut exécuter aucun script.
          </li>
        </ul>
      </section>

      <section id="limites">
        <h2>Ce que Relais ne peut pas faire</h2>
        <Callout tone="warn" title="Aucune analyse n'est une garantie">
          <p>
            Relais n&apos;exécute pas les fichiers et ne remplace pas un antivirus. Un document piégé par une faille inconnue, une archive RAR ou un fichier
            chiffré peuvent ne présenter aucun signal. «&nbsp;Aucun signal&nbsp;» ne veut jamais dire «&nbsp;sans danger&nbsp;».
          </p>
        </Callout>
        <p>
          Relais n&apos;est pas non plus une sauvegarde&nbsp;: un fichier hébergé disparaît à l&apos;expiration choisie par son expéditeur. Gardez toujours vos
          originaux.
        </p>
      </section>

      <section id="signaler">
        <h2>Signaler un fichier</h2>
        <p>
          Chaque page de téléchargement comporte un lien <strong>Signaler ce dépôt</strong>. Après trois signalements de personnes différentes, le dépôt est
          suspendu automatiquement en attendant son examen. Votre adresse IP n&apos;est pas conservée&nbsp;: seule une empreinte anonyme sert à éviter les
          doublons. Voir aussi les <Link href="/conditions">conditions d&apos;utilisation</Link>.
        </p>
      </section>
    </DocLayout>
  );
}
