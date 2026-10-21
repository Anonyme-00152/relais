"use client";

import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

type Toast = { id: number; text: string; tone: "ok" | "info" | "warn" };

const EVENT = "relais:toast";
let seq = 0;

export function toast(text: string, tone: Toast["tone"] = "ok") {
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { id: ++seq, text, tone } }));
}

export function Toaster() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<Toast>).detail;
      setList((l) => [...l.slice(-2), t]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 3200);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div
          key={t.id}
          className="animate-pop pointer-events-auto flex items-center gap-2.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-bg shadow-lg"
        >
          {t.tone === "ok" ? (
            <CheckCircle2 className="size-4 text-ok" aria-hidden />
          ) : t.tone === "warn" ? (
            <TriangleAlert className="size-4 text-sun" aria-hidden />
          ) : (
            <Info className="size-4 text-accent" aria-hidden />
          )}
          {t.text}
        </div>
      ))}
    </div>
  );
}

export async function copyText(text: string, label = "Lien copié") {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    toast("Copie impossible : sélectionnez le texte manuellement.", "warn");
  }
}
