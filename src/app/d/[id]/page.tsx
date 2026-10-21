import type { Metadata } from "next";
import { FolderPage } from "@/components/folder-view";
import { loadFolder } from "@/lib/server/folders";
import { formatBytes, plural } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const got = await loadFolder(id).catch(() => null);
  if (!got) return { title: "Lien introuvable", robots: { index: false } };
  const { rec } = got;
  const size = rec.files.reduce((s, f) => s + f.size, 0);
  const summary = `${plural(rec.files.length, "fichier")} · ${formatBytes(size)}`;
  const title = rec.passwordHash ? "Dépôt protégé" : rec.title || summary;
  return {
    title,
    description: rec.passwordHash ? "Ce dépôt est protégé par un mot de passe." : `${summary} partagés avec Relais.`,
    robots: { index: false, follow: false },
    openGraph: { title, description: `${summary} à télécharger` },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <FolderPage id={id} />;
}
