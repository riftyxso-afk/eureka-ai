"use client";

import { Check, ChevronDown, Flame, Loader2, X } from "lucide-react";

import type { StepLogEntry } from "@/lib/agents/loopStream";

interface StepLogProps {
  entries: StepLogEntry[];
  /** Artifact terminal terkait (collapsed by default — PRD §7.4). */
  terminal?: {
    title: string;
    content: string;
    streaming: boolean;
  } | null;
}

/**
 * Step-log Solve-then-Guide (PRD §8.4) — menampilkan tahapan ASLI dari
 * event SSE backend. Tidak ada step yang disimulasikan: bila koneksi
 * terputus, log berhenti pada status terakhir yang benar-benar diterima.
 */
export default function StepLog({ entries, terminal }: StepLogProps) {
  if (entries.length === 0) return null;

  return (
    <div
      className="mx-auto mb-2 w-full max-w-3xl rounded-clay-md bg-clay-cream px-3.5 py-2.5 shadow-clay-sm"
      data-testid="step-log"
    >
      <div className="flex items-center gap-2 text-[12.5px] font-extrabold text-clay-dark">
        <Flame size={14} className="text-[rgb(var(--accent-coral))]" />
        Menyelesaikan soal ini...
      </div>
      <ul className="mt-2 space-y-1.5">
        {entries.map((s, i) => (
          <li key={`${s.label}-${i}`} className="flex items-center gap-2 text-xs font-bold">
            {s.status === "done" ? (
              <Check size={13} className="shrink-0 text-clay-success" />
            ) : s.status === "running" ? (
              <Loader2 size={13} className="shrink-0 animate-spin text-clay-primary" />
            ) : (
              <X size={13} className="shrink-0 text-clay-muted" />
            )}
            <span className={s.status === "failed" ? "text-clay-muted line-through" : "text-clay-dark"}>
              {s.label}
            </span>
          </li>
        ))}
      </ul>

      {/* Panel terminal — clay-pressed (inset), monospace, collapsed by default */}
      {terminal && <TerminalStep content={terminal.content} streaming={terminal.streaming} />}
    </div>
  );
}

function TerminalStep({ content, streaming }: { content: string; streaming: boolean }) {
  return (
    <details className="group mt-2" data-testid="step-terminal">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-clay-sm bg-clay-inputBg px-2.5 py-1.5 text-[11px] font-extrabold text-clay-muted shadow-[inset_0_2px_5px_rgb(var(--clay-shadow-dark)/0.3)] transition-colors hover:text-clay-dark">
        <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
        Lihat detail verifikasi
      </summary>
      <pre className="mt-1.5 max-h-64 overflow-y-auto rounded-clay-sm bg-clay-inputBg p-2.5 font-mono text-[11px] leading-relaxed text-clay-dark shadow-[inset_0_2px_5px_rgb(var(--clay-shadow-dark)/0.3)]">
        {content}
        {streaming && <span className="animate-pulse text-clay-primary">▌</span>}
      </pre>
    </details>
  );
}
