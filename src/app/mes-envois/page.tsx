import type { Metadata } from "next";
import { MyUploads } from "@/components/my-uploads";

export const metadata: Metadata = {
  title: "Mes envois",
  description: "Les dépôts créés depuis ce navigateur : liens, expiration, gestion.",
  robots: { index: false },
};

export default function Page() {
  return (
    <div className="shell max-w-5xl pt-10 pb-16 sm:pt-14">
      <p className="eyebrow">Tableau de bord</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-[-0.035em]">Mes envois</h1>
      <p className="mt-3 max-w-xl leading-relaxed text-ink-2">
        Les dépôts créés depuis ce navigateur. Leurs clés de gestion sont stockées uniquement sur cet appareil&nbsp;: pour gérer un dépôt ailleurs, utilisez son
        lien de gestion.
      </p>
      <MyUploads />
    </div>
  );
}
