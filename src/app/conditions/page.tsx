import type { Metadata } from "next";
import Link from "next/link";
import { DocLayout } from "@/components/doc-layout";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Règles d'utilisation de Relais : contenus interdits, conservation, signalement.",
  alternates: { canonical: "/conditions" },
};

export default function Page() {
  return (
    <DocLayout
      eyebrow="Légal"
      title="Conditions d'utilisation"
      lead="Relais met à disposition un espace temporaire pour transmettre des fichiers. En l'utilisant, vous acceptez les règles ci-dessous."
      toc={[
        ["service", "Le service"],
        ["interdits", "Contenus interdits"],
        ["conservation", "Conservation"],
        ["responsabilite", "Responsabilités"],
        ["signalement", "Signalement"],
      ]}
    >
      <section id="service">
        <h2>Le service</h2>
        <p>
          Relais permet d&apos;héberger des fichiers pour une durée limitée et de les partager par lien. Le service est fourni «&nbsp;en l&apos;état&nbsp;», sans
          garantie de disponibilité. Il n&apos;est pas conçu pour l&apos;archivage ni pour la sauvegarde.
        </p>
      </section>
      <section id="interdits">
        <h2>Contenus interdits</h2>
        <p>Il est interdit d&apos;utiliser Relais pour héberger ou diffuser&nbsp;:</p>
        <ul>
          <li>des logiciels malveillants destinés à nuire (sauf échantillons partagés dans un cadre de recherche, clairement identifiés et protégés par mot de passe)&nbsp;;</li>
          <li>des contenus dont vous ne détenez pas les droits de diffusion&nbsp;;</li>
          <li>des contenus illégaux, notamment pédocriminels, terroristes, haineux ou portant atteinte à la vie privée d&apos;autrui&nbsp;;</li>
          <li>des pages d&apos;hameçonnage ou des fichiers destinés à tromper leurs destinataires.</li>
        </ul>
      </section>
      <section id="conservation">
        <h2>Conservation</h2>
        <p>
          Chaque dépôt est supprimé, avec tous ses fichiers, à la date d&apos;expiration choisie (de 1 heure à 30 jours). L&apos;expéditeur peut le supprimer à
          tout moment. Un dépôt suspendu peut être supprimé sans préavis.
        </p>
      </section>
      <section id="responsabilite">
        <h2>Responsabilités</h2>
        <p>
          L&apos;expéditeur est seul responsable des fichiers qu&apos;il dépose. Relais agit en qualité d&apos;hébergeur et retire promptement tout contenu
          manifestement illicite qui lui est signalé. Les analyses automatiques sont fournies à titre indicatif et ne constituent pas une garantie de sécurité.
        </p>
      </section>
      <section id="signalement">
        <h2>Signalement</h2>
        <p>
          Pour signaler un contenu, utilisez le lien <strong>Signaler ce dépôt</strong> en bas de la page de téléchargement concernée. Trois signalements distincts
          entraînent la suspension automatique du dépôt. Voir notre <Link href="/securite">guide de sécurité</Link>.
        </p>
      </section>
    </DocLayout>
  );
}
