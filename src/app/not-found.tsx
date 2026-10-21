import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <p className="font-mono text-sm text-muted">404</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Page introuvable</h1>
        <p className="mx-auto mt-3 max-w-sm text-muted">Cette adresse ne mène nulle part. Vérifiez le lien ou revenez à l&apos;accueil.</p>
        <Link href="/" className="btn btn-primary mt-8">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
