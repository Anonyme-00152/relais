import type { ReactNode } from "react";

/** Mise en page des pages longues : titre, sommaire collant, contenu. */
export function DocLayout({
  eyebrow,
  title,
  lead,
  toc,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  toc: [string, string][];
  children: ReactNode;
}) {
  return (
    <div className="shell pt-10 pb-10 sm:pt-16">
      <header className="max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 text-[clamp(2.2rem,5vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.04em]">{title}</h1>
        <div className="mt-5 text-lg leading-relaxed text-ink-2">{lead}</div>
      </header>
      <div className="mt-12 grid gap-12 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Sommaire" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="eyebrow">Sur cette page</p>
            <ul className="mt-4 grid gap-1 border-l border-line text-sm">
              {toc.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="-ml-px block border-l border-transparent py-1.5 pl-4 text-muted transition-colors hover:border-accent hover:text-ink">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <article className="prose-doc min-w-0 max-w-3xl [&>section:first-child>h2]:mt-0">{children}</article>
      </div>
    </div>
  );
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "ok"; title?: string; children: ReactNode }) {
  const cls = tone === "warn" ? "border-danger/25 bg-danger-soft" : tone === "ok" ? "border-ok/25 bg-ok-soft" : "border-accent/20 bg-accent-soft";
  return (
    <div className={`my-6 rounded-2xl border p-5 ${cls}`}>
      {title && <p className="!mt-0 font-semibold text-ink">{title}</p>}
      <div className="mt-1 text-[0.95rem] [&>p]:!mt-1">{children}</div>
    </div>
  );
}
