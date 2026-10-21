const UNITS = ["o", "Ko", "Mo", "Go", "To"];

/** 1536 → "1,5 Ko". Base 1024, virgule française. */
export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  const d = v >= 100 ? 0 : digits;
  return `${v.toFixed(d).replace(".", ",").replace(/,0+$/, "")} ${UNITS[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

/** Durée lisible : 75 → "1 min 15 s". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${s % 60 ? ` ${s % 60} s` : ""}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d} j${h % 24 ? ` ${h % 24} h` : ""}`;
}

/** Temps restant avant une date : "expire dans 6 j 23 h". */
export function formatRemaining(target: number, now = Date.now()): string {
  const diff = (target - now) / 1000;
  if (diff <= 0) return "expiré";
  if (diff < 60) return "moins d'une minute";
  return formatDuration(diff - (diff % 60));
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(ts: number): string {
  return dateFmt.format(new Date(ts));
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;
}

/** Raccourcit un nom long en gardant l'extension visible. */
export function middleEllipsis(name: string, max = 42): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 8 ? name.slice(dot) : "";
  const keep = max - ext.length - 1;
  const head = Math.ceil(keep * 0.65);
  const tail = keep - head;
  const base = name.slice(0, name.length - ext.length);
  return `${base.slice(0, head)}…${base.slice(base.length - tail)}${ext}`;
}
