"use client";

import { useState } from "react";
import { Check, ExternalLink, Globe } from "lucide-react";
import type { WebSearchItem, WebSearchStage } from "@/lib/assistant/types";

/** Favicon dari Google (gratis, tanpa API key) — fallback ke ikon globe. */
function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function Favicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !domain) {
    return <Globe size={14} className="shrink-0 text-clay-muted" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={faviconUrl(domain)}
      alt=""
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
      onError={() => setFailed(true)}
    />
  );
}

interface StepDef {
  id: WebSearchStage;
  icon: string;
  label: string;
  desc: string;
}

const STEPS: StepDef[] = [
  {
    id: "searching",
    icon: "🔍",
    label: "Mencari di web",
    desc: "Mengirim pertanyaan ke mesin pencari",
  },
  {
    id: "analyzing",
    icon: "📄",
    label: "Membaca hasil",
    desc: "Memilih sumber terbaik",
  },
  {
    id: "writing",
    icon: "✍️",
    label: "Menyusun jawaban",
    desc: "Merangkai jawaban dengan sumber",
  },
];

const STAGE_INDEX: Record<WebSearchStage, number> = {
  searching: 0,
  analyzing: 1,
  writing: 2,
};

/**
 * Kartu pipeline web search: 3 langkah loading (mencari → membaca → menulis)
 * + deretan hasil pencarian dengan logo situs (maks 10, klik = buka sumber).
 */
export default function WebSearchPipeline({
  stage,
  results,
  completed = false,
}: {
  stage: WebSearchStage | null;
  results: WebSearchItem[];
  /** true = jawaban selesai → semua langkah centang, spinner hilang. */
  completed?: boolean;
}) {
  const activeIdx = completed ? STEPS.length : stage ? STAGE_INDEX[stage] : 0;
  const done =
    completed ||
    (results.length > 0 && (stage === "analyzing" || stage === "writing"));

  return (
    <div className="w-full max-w-3xl">
      <div className="rounded-clay-md border-2 border-clay-borderLight bg-white p-4 shadow-clay-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-clay-md bg-clay-primary/10">
            <Globe size={15} className="text-clay-primary" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-clay-dark">
              Pencarian web
            </p>
            <p className="text-[11px] font-bold text-clay-muted">
              {completed
                ? "Selesai ✓"
                : done
                  ? `${results.length} sumber ditemukan`
                  : "Mencari jawaban terbaru…"}
            </p>
          </div>
        </div>

        {/* Langkah pipeline */}
        <div className="space-y-1.5">
          {STEPS.map((step, i) => {
            const isDone = i < activeIdx;
            const isActive = i === activeIdx && !completed;
            return (
              <div key={step.id} className="flex items-center gap-2.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isDone
                      ? "border-clay-secondary bg-clay-secondary/15 text-clay-secondary"
                      : isActive
                        ? "border-clay-primary bg-clay-primary/10 text-clay-primary"
                        : "border-clay-borderLight text-clay-muted/60"
                  }`}
                >
                  {isDone ? (
                    <Check size={11} strokeWidth={3.5} />
                  ) : isActive ? (
                    <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-clay-primary border-t-transparent" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-clay-borderLight" />
                  )}
                </span>
                <span
                  className={`text-[12.5px] font-extrabold ${
                    isActive
                      ? "text-clay-primary"
                      : isDone
                        ? "text-clay-dark"
                        : "text-clay-muted"
                  }`}
                >
                  {step.icon} {step.label}
                </span>
                {isActive && (
                  <span className="hidden text-[11px] font-bold text-clay-muted sm:inline">
                    {step.desc}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Hasil pencarian + logo situs */}
        {results.length > 0 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {results.map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                title={r.title}
                className="group flex shrink-0 items-center gap-1.5 rounded-clay-full border-2 border-clay-borderLight bg-clay-beige/60 px-3 py-1.5 text-[12px] font-extrabold text-clay-dark transition-all duration-75 hover:-translate-y-0.5 hover:border-clay-primary/50 hover:bg-white"
              >
                <Favicon domain={r.domain} />
                <span className="max-w-[140px] truncate">{r.domain}</span>
                <ExternalLink
                  size={11}
                  className="shrink-0 text-clay-muted opacity-0 transition-opacity group-hover:opacity-100"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
