"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Database,
  Download,
  Globe,
  Layers,
  PenLine,
  Sparkles,
} from "lucide-react";

import type { NoteStep } from "@/components/note/useNoteSteps";

/**
 * Daftar langkah nyata pembuatan catatan (note-loading-live-steps).
 *
 * Setiap baris = satu fase pipeline yang muncul HANYA saat event SSE tiba
 * (tanpa timer/mock). Baris aktif berdenyut, baris selesai berceklis; tiap
 * baris bisa di-expand untuk melihat detail, dan seluruh daftar bisa
 * diciutkan dari header. Visual tema clay Eureka.
 *
 * Sub-steps (per-bab) ditampilkan di bawah langkah "chapters" dengan
 * indentasi dan style lebih kecil.
 */

const StepIcon = ({ icon, className }: { icon: string; className?: string }) => {
  switch (icon) {
    case "download":
      return <Download size={14} className={className} />;
    case "pen":
      return <PenLine size={14} className={className} />;
    case "globe":
      return <Globe size={14} className={className} />;
    case "database":
      return <Database size={14} className={className} />;
    case "layers":
      return <Layers size={14} className={className} />;
    default:
      return <Sparkles size={14} className={className} />;
  }
};

interface NoteLoadingStepsProps {
  steps: NoteStep[];
}

export function NoteLoadingSteps({ steps }: NoteLoadingStepsProps) {
  const [listOpen, setListOpen] = useState(true);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const doneCount = steps.filter((s) => s.status === "done" && !s.isSubStep).length;
  const totalParents = steps.filter((s) => !s.isSubStep).length;

  const toggleRow = (id: string) =>
    setOpenRows((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (steps.length === 0) return null;

  return (
    <div className="mt-2 w-full text-left">
      {/* Header collapsible */}
      <button
        type="button"
        aria-expanded={listOpen}
        onClick={() => setListOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-extrabold text-clay-muted transition-colors hover:bg-clay-cream"
      >
        <ChevronDown
          size={13}
          className={`shrink-0 transition-transform duration-200 ${
            listOpen ? "" : "-rotate-90"
          }`}
        />
        <span className="tabular-nums">
          Detail proses · {doneCount}/{totalParents} langkah selesai
        </span>
      </button>

      {/* Daftar baris langkah */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: listOpen ? "1fr" : "0fr",
          opacity: listOpen ? 1 : 0,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-1 flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {steps.map((step) => {
                const isActive = step.status === "active";
                const isSubStep = step.isSubStep;
                const rowOpen = openRows.has(step.id);
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <button
                      type="button"
                      aria-expanded={step.detail ? rowOpen : undefined}
                      disabled={!step.detail}
                      onClick={() => step.detail && toggleRow(step.id)}
                      className={`grid min-h-[40px] w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-lg px-2 py-2 text-left transition-colors ${
                        isSubStep ? "pl-6" : ""
                      } ${isActive ? "bg-violet-50 dark:bg-violet-950/40" : ""} ${step.detail ? "hover:bg-violet-100 dark:hover:bg-violet-900/40" : ""}`}
                    >
                      {/* Ikon status langkah */}
                      <span
                        className={`relative flex shrink-0 items-center justify-center rounded-full border ${
                          isSubStep ? "h-4 w-4" : "h-5 w-5"
                        } ${
                          step.status === "done"
                            ? "border-clay-success/40 bg-clay-success/15 text-clay-success"
                            : "border-clay-primary/40 bg-clay-primary/10 text-clay-primary"
                        }`}
                      >
                        {step.status === "done" ? (
                          <Check size={isSubStep ? 9 : 11} strokeWidth={3} />
                        ) : (
                          <StepIcon icon={step.icon} className={isSubStep ? "!h-3 !w-3" : ""} />
                        )}
                        {isActive && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-clay-primary/20 motion-reduce:animate-none" />
                        )}
                      </span>

                      {/* Label aksi */}
                      <span
                        className={`min-w-0 break-words font-bold ${
                          isSubStep ? "text-[11px]" : "text-xs"
                        } ${
                          step.status === "done"
                            ? "text-clay-muted"
                            : "text-clay-dark"
                        }`}
                      >
                        {step.label}
                      </span>

                      {/* Chip detail baris aktif */}
                      {isActive && step.detail && (
                        <span className="col-start-2 row-start-2 min-w-0 truncate text-[11px] font-medium text-clay-muted">
                          {step.detail}
                        </span>
                      )}

                      {/* Chevron expand bila ada detail */}
                      {step.detail && (
                        <ChevronDown
                          size={12}
                          className={`col-start-3 row-start-1 shrink-0 text-clay-muted transition-transform duration-200 ${
                            rowOpen ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </button>

                    {/* Detail expandable */}
                    <div
                      className="grid transition-[grid-template-rows,opacity] duration-300"
                      style={{
                        gridTemplateRows: rowOpen && step.detail ? "1fr" : "0fr",
                        opacity: rowOpen && step.detail ? 1 : 0,
                      }}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <p className="mb-1 ml-8 break-all border-l-2 border-clay-borderLight py-1 pl-3 text-[11px] font-medium text-clay-muted">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
