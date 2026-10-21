"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Coloration minimale : commentaires, chaînes, nombres. Suffisant et sans dépendance. */
function highlight(code: string, lang: string) {
  const comment = lang === "python" || lang === "bash" ? /#[^\n]*/ : /\/\/[^\n]*/;
  const re = new RegExp(`(${comment.source})|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|(\\b\\d+\\b)`, "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const cls = m[1] ? "text-[#8a93a8] italic" : m[2] ? "text-[#9be3b8]" : "text-[#ffd27a]";
    out.push(
      <span key={i++} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  out.push(code.slice(last));
  return out;
}

export function CodeBlock({ code, lang = "bash", title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#0d1424] text-[#e6eaf2] shadow-[var(--shadow)]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-[#8a93a8]">{title ?? lang}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#aeb6c8] transition-colors hover:bg-white/5 hover:text-white"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {}
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[0.8rem] leading-[1.7]">
        <code>{highlight(code, lang)}</code>
      </pre>
    </div>
  );
}
