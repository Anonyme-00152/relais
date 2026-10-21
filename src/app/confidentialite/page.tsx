import type { Metadata } from "next";
import { DocLayout } from "@/components/doc-layout";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Quelles données Relais traite, pourquoi, et combien de temps.",
  alternates: { canonical: "/confidentialite" },
};

const ROWS: [string, string, string][] = [
  ["Fichiers envoyés", "Les transmettre aux destinataires", "Jusqu'à l'expiration ou la suppression"],
  ["Titre, message, nom des fichiers", "Les afficher sur la page de téléchargement", "Idem"],
  ["Empreinte de la clé de gestion", "Vérifier que vous êtes l'expéditeur", "Idem"],
  ["Mot de passe (haché scrypt)", "Protéger l'accès au dépôt", "Idem"],
  ["Compteurs de visites et téléchargements", "Statistiques visibles par l'expéditeur seul", "Idem"],
  ["Empreinte anonyme de l'IP (signalements)", "Empêcher les signalements en double", "Idem"],
];

export default function Page() {
  return (
    <DocLayout
      eyebrow="Légal"
      title="Confidentialité"
      lead="Relais collecte le strict nécessaire pour transmettre vos fichiers. Pas de compte, pas de publicité, pas de pistage."
      toc={[
        ["donnees", "Données traitées"],
        ["navigateur", "Dans votre navigateur"],
        ["tiers", "Services tiers"],
        ["droits", "Vos droits"],
      ]}
    >
      <section id="donnees">
        <h2>Données traitées</h2>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="py-3 pr-4 font-medium">
                  Donnée
                </th>
                <th scope="col" className="py-3 pr-4 font-medium">
                  Finalité
                </th>
                <th scope="col" className="py-3 font-medium">
                  Durée
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([a, b, c]) => (
                <tr key={a} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4 font-medium">{a}</td>
                  <td className="py-3 pr-4 text-ink-2">{b}</td>
                  <td className="py-3 text-muted">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-5">
          Les adresses IP ne sont pas enregistrées dans les dépôts. Elles transitent par l&apos;hébergeur pour limiter les abus (nombre de tentatives) et ne
          sont gardées qu&apos;en mémoire, quelques minutes.
        </p>
      </section>
      <section id="navigateur">
        <h2>Dans votre navigateur</h2>
        <ul>
          <li>
            <strong>Mes envois</strong>&nbsp;: la liste de vos dépôts et leurs clés de gestion sont stockées localement (localStorage), jamais sur nos serveurs.
          </li>
          <li>
            <strong>Cookie d&apos;accès</strong>&nbsp;: après saisie d&apos;un mot de passe correct, un cookie technique de 12&nbsp;h évite de le redemander.
          </li>
          <li>
            <strong>Thème</strong>&nbsp;: votre préférence clair/sombre.
          </li>
        </ul>
        <p>Aucun cookie publicitaire ni de mesure d&apos;audience n&apos;est déposé&nbsp;: aucun bandeau de consentement n&apos;est donc nécessaire.</p>
      </section>
      <section id="tiers">
        <h2>Services tiers</h2>
        <p>
          Les fichiers sont stockés chez l&apos;hébergeur de l&apos;instance, dans un espace privé. Le lien «&nbsp;VirusTotal&nbsp;» n&apos;envoie que
          l&apos;empreinte SHA-256 du fichier, et seulement si vous cliquez dessus. Le QR code est généré dans votre navigateur.
        </p>
      </section>
      <section id="droits">
        <h2>Vos droits</h2>
        <p>
          Vous pouvez supprimer à tout moment un dépôt que vous avez créé, depuis ses réglages. Faute de compte, nous ne pouvons pas relier un dépôt à une
          personne&nbsp;: c&apos;est la clé de gestion qui fait foi.
        </p>
      </section>
    </DocLayout>
  );
}
