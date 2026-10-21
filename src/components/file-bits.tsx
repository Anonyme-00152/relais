"use client";

import {
  AppWindow,
  Archive,
  Database,
  File as FileIcon2,
  FileCode2,
  FileText,
  Film,
  ImageIcon,
  Music,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { categoryOf, type Category, type RiskLevel } from "@/lib/filetypes";

const ICONS: Record<Category, { Icon: typeof FileIcon2; tone: string }> = {
  image: { Icon: ImageIcon, tone: "bg-[#e8f0ff] text-[#2557f5] dark:bg-[#7d9bff1f] dark:text-[#9fb4ff]" },
  video: { Icon: Film, tone: "bg-[#efe9ff] text-[#5b3fd6] dark:bg-[#a48bff1f] dark:text-[#bba9ff]" },
  audio: { Icon: Music, tone: "bg-[#e3f6f4] text-[#0b7d74] dark:bg-[#4fd3c41a] dark:text-[#6fe0d2]" },
  document: { Icon: FileText, tone: "bg-[#e6f3ff] text-[#0d6aa8] dark:bg-[#5cb6ff1a] dark:text-[#8bcbff]" },
  archive: { Icon: Archive, tone: "bg-[#fff3d6] text-[#8a5a00] dark:bg-[#ffcf5c1a] dark:text-[#ffd77a]" },
  code: { Icon: FileCode2, tone: "bg-[#e9f5e3] text-[#3d7a1c] dark:bg-[#8fd36a1a] dark:text-[#a9e08a]" },
  executable: { Icon: AppWindow, tone: "bg-[#ffe9dc] text-[#a3430c] dark:bg-[#ff9a5c1f] dark:text-[#ffb084]" },
  data: { Icon: Database, tone: "bg-[#eceef3] text-[#46506a] dark:bg-[#ffffff12] dark:text-[#c1c8d6]" },
  other: { Icon: FileIcon2, tone: "bg-[#eceef3] text-[#46506a] dark:bg-[#ffffff12] dark:text-[#c1c8d6]" },
};

export function FileGlyph({ name, mime = "", size = "md" }: { name: string; mime?: string; size?: "sm" | "md" | "lg" }) {
  const { Icon, tone } = ICONS[categoryOf(name, mime)];
  const box = size === "sm" ? "size-8 rounded-lg" : size === "lg" ? "size-14 rounded-2xl" : "size-10 rounded-xl";
  const icon = size === "sm" ? "size-4" : size === "lg" ? "size-7" : "size-5";
  return (
    <span className={`grid shrink-0 place-items-center ${box} ${tone}`} aria-hidden>
      <Icon className={icon} strokeWidth={1.8} />
    </span>
  );
}

export function RiskChip({ level, compact = false }: { level: RiskLevel; compact?: boolean }) {
  if (level === "high")
    return (
      <span className="chip bg-danger-soft text-danger">
        <ShieldAlert className="size-3.5" aria-hidden />
        {compact ? "Risque" : "Exécutable / à risque"}
      </span>
    );
  if (level === "caution")
    return (
      <span className="chip bg-warn-soft text-warn">
        <TriangleAlert className="size-3.5" aria-hidden />
        Prudence
      </span>
    );
  return (
    <span className="chip bg-ok-soft text-ok" title="Aucun signal suspect détecté. Cela ne garantit pas l'absence de risque.">
      <ShieldCheck className="size-3.5" aria-hidden />
      {compact ? "Analysé" : "Aucun signal"}
    </span>
  );
}

/** QR code généré localement (aucun service tiers). */
export function QrCode({ value, size = 168 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    import("qrcode").then((QR) =>
      QR.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0d1628", light: "#ffffff" } }).then((s) => {
        if (alive) setSvg(s);
      }),
    );
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <div
      role="img"
      aria-label="QR code du lien de partage"
      className="overflow-hidden rounded-xl border border-line bg-white p-2"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}

export function ProgressBar({ value, active = false, tone = "accent" }: { value: number; active?: boolean; tone?: "accent" | "ok" }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out ${tone === "ok" ? "bg-ok" : "bg-accent"} ${active ? "progress-stripes" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
