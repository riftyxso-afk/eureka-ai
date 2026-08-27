"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ExternalLink, Globe } from "lucide-react";
import EurekaOrb from "@/components/ui/EurekaOrb";
import { emojiToIcon } from "@/lib/emojiIcon";
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
  const [expanded, setExpanded] = useState(false);
  const activeIdx = completed ? STEPS.length : stage ? STAGE_INDEX[stage] : 0;
  const done =
    completed ||
    (results.length > 0 && (stage === "analyzing" || stage === "writing"));
  // Auto-expand ketika hasil datang
  const hasResults = results.length > 0;

  return (
    <div className="w-full max-w-3xl">
      <div className="rounded-clay-md border-2 border-clay-borderLight bg-clay-cream p-4 shadow-clay-sm">
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
            const isSearchingStep = step.id === "searching";
            return (
              <div key={step.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex shrink-0 items-center justify-center ${
                      isActive
                        ? ""
                        : "h-5 w-5 rounded-full border-2 " +
                          (isDone
                            ? "border-clay-secondary bg-clay-secondary/15 text-clay-secondary"
                            : "border-clay-borderLight text-clay-muted/60")
                    }`}
                  >
                    {isDone ? (
                      <Check size={11} strokeWidth={3.5} />
                    ) : isActive ? (
                      <EurekaOrb
                        variant="searching"
                        scale="inline"
                        label={step.label}
                      />
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
                    {(() => {
                      const StepIcon = emojiToIcon(step.icon);
                      return <StepIcon size={13} className="mr-1 inline" />;
                    })()}
                    {step.label}
                  </span>
                  {isActive && (
                    <span className="hidden text-[11px] font-bold text-clay-muted sm:inline">
                      {step.desc}
                    </span>
                  )}
                  {/* Toggle hasil di step Mencari */}
                  {isSearchingStep && hasResults && (
                    <button
                      onClick={() => setExpanded((v) => !v)}
                      className="ml-auto flex items-center gap-1 rounded-clay-full border border-clay-borderLight bg-clay-beige/40 px-2 py-0.5 text-[11px] font-extrabold text-clay-muted hover:bg-clay-beige"
                    >
                      <span>{results.length} sumber</span>
                      <span className={`transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
                    </button>
                  )}
                </div>
                {/* Hasil kecil di bawah "Mencari di web" — collapse/expand, logo + nama, muncul satu per satu */}
                {isSearchingStep && hasResults && expanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                    className="ml-7 mt-1 space-y-1 overflow-hidden"
                  >
                    <AnimatePresence initial={false}>
                      {results.slice(0, 6).map((r, idx) => (
                        <motion.a
                          key={r.url}
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={r.title}
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{
                            duration: 0.32,
                            delay: idx * 0.07,
                            ease: [0.32, 0.72, 0, 1],
                          }}
                          className="flex items-center gap-2 rounded-clay-md border border-clay-borderLight/60 bg-white px-2.5 py-1.5 text-[11px] font-bold text-clay-dark shadow-clay-sm transition-colors hover:border-clay-primary/30 hover:bg-clay-beige/30"
                        >
                          <Favicon domain={r.domain} />
                          <span className="min-w-0 flex-1 truncate">{r.domain}</span>
                          <span className="hidden max-w-[120px] truncate text-[10px] font-semibold text-clay-muted sm:inline">
                            {r.title.slice(0, 40)}
                          </span>
                          <ExternalLink size={10} className="shrink-0 text-clay-muted" />
                        </motion.a>
                      ))}
                    </AnimatePresence>
                    {results.length > 6 && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 6 * 0.07 + 0.1 }}
                        className="pl-1 text-[10px] font-bold text-clay-muted"
                      >
                        +{results.length - 6} sumber lainnya
                      </motion.p>
                    )}
                  </motion.div>
                )}
                {/* Preview kecil saat collapsed — logo baris, muncul satu per satu */}
                {isSearchingStep && hasResults && !expanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ml-7 flex items-center gap-1.5 overflow-hidden"
                  >
                    <div className="flex -space-x-1">
                      {results.slice(0, 4).map((r, idx) => (
                        <motion.span
                          key={r.url}
                          initial={{ opacity: 0, scale: 0.6, x: -6 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          transition={{ duration: 0.28, delay: idx * 0.08, ease: [0.32, 0.72, 0, 1] }}
                          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-clay-beige shadow-sm"
                          title={r.domain}
                        >
                          <Favicon domain={r.domain} />
                        </motion.span>
                      ))}
                    </div>
                    <motion.span
                      initial={{ opacity: 0, x: 4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.32 }}
                      className="truncate text-[11px] font-bold text-clay-muted"
                    >
                      {results
                        .slice(0, 3)
                        .map((r) => r.domain)
                        .join(" · ")}
                      {results.length > 3 ? ` +${results.length - 3}` : ""}
                    </motion.span>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
