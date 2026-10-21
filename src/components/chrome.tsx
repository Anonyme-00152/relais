"use client";

import { Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { site } from "@/lib/config";
import { listOwned, onOwnedChange } from "@/lib/client/owned";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <circle cx="10" cy="21" r="3.2" fill="var(--on-accent)" opacity="0.55" />
        <circle cx="22" cy="11" r="3.2" fill="var(--sun)" />
        <path d="M10 21 C 10 14, 15 11, 22 11" stroke="var(--on-accent)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M18.5 8.5 22 11 18.8 13.9" stroke="var(--on-accent)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[1.15rem] font-semibold tracking-[-0.03em]">{site.name}</span>
    </span>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"), []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("relais:theme", next);
    } catch {}
    setTheme(next);
  };
  return (
    <button type="button" onClick={toggle} className="btn btn-ghost btn-icon" aria-label={theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}>
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

const NAV = [
  { href: "/#fonctionnement", label: "Fonctionnement" },
  { href: "/securite", label: "Sécurité" },
  { href: "/developpeurs", label: "API" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [owned, setOwned] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sync = () => setOwned(listOwned().length);
    sync();
    return onOwnedChange(sync);
  }, []);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200 ${
        scrolled || open ? "border-b border-line bg-bg/80 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="shell flex h-16 items-center gap-6">
        <Link href="/" aria-label={`${site.name}, accueil`} className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Navigation principale" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`rounded-lg px-3 py-2 text-[0.92rem] font-medium transition-colors hover:text-ink ${
                    pathname === n.href ? "text-ink" : "text-muted"
                  }`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Link href="/mes-envois" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            Mes envois
            {owned > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-accent-soft px-1.5 font-mono text-[0.7rem] text-accent">{owned}</span>
            )}
          </Link>
          <Link href="/" className="btn btn-primary btn-sm hidden sm:inline-flex">
            Envoyer
          </Link>
          <button
            type="button"
            className="btn btn-ghost btn-icon md:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="menu-mobile" aria-label="Navigation mobile" className="shell animate-fade pb-5 md:hidden">
          <ul className="grid gap-1 border-t border-line pt-3">
            {[...NAV, { href: "/mes-envois", label: `Mes envois${owned ? ` (${owned})` : ""}` }].map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block rounded-lg px-3 py-3 font-medium hover:bg-bg2">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/" className="btn btn-primary mt-3 w-full">
            Envoyer des fichiers
          </Link>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="shell grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Hébergement et partage de fichiers par lien. Sans compte, avec mot de passe, expiration et analyse des fichiers avant téléchargement.
          </p>
        </div>
        <FooterCol
          title="Produit"
          links={[
            ["/", "Envoyer des fichiers"],
            ["/mes-envois", "Mes envois"],
            ["/#fonctionnement", "Fonctionnement"],
            ["/#comparatif", "Relais ou cloud ?"],
          ]}
        />
        <FooterCol
          title="Ressources"
          links={[
            ["/securite", "Télécharger sans risque"],
            ["/developpeurs", "API & développeurs"],
            ["/#faq", "Questions fréquentes"],
            ["/api/v1/config", "État de l'instance"],
          ]}
        />
        <FooterCol
          title="Légal"
          links={[
            ["/conditions", "Conditions d'utilisation"],
            ["/confidentialite", "Confidentialité"],
            ["/conditions#signalement", "Signaler un abus"],
          ]}
        />
      </div>
      <div className="shell flex flex-col gap-2 border-t border-line py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} {site.name}. Les fichiers appartiennent à leurs expéditeurs.</p>
        <p className="font-mono">Chiffré en transit · Fichiers privés par défaut · Sans pistage publicitaire</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow">{title}</p>
      <ul className="mt-4 grid gap-2.5 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-ink-2 transition-colors hover:text-accent">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
