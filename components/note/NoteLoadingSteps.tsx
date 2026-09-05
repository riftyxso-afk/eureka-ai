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

  const doneCount = steps.filter((s) => s.status === "done").length;

  const toggleRow = (id: string) =>
    setOpenRows((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (steps.length === 0) return null;

  return (
    <div className="mt-4 w-full text-left">
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
          {doneCount}/{steps.length} langkah selesai
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
                      aria-expanded={rowOpen}
                      onClick={() => step.detail && toggleRow(step.id)}
                      className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors ${
                        step.detail ? "hover:bg-clay-cream" : ""
                      }`}
                    >
                      {/* Ikon status langkah */}
                      <span
                        className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          step.status === "done"
                            ? "border-clay-success/40 bg-clay-success/15 text-clay-success"
                            : "border-clay-primary/40 bg-clay-primary/10 text-clay-primary"
                        }`}
                      >
                        {step.status === "done" ? (
                          <Check size={11} strokeWidth={3} />
                        ) : (
                          <StepIcon icon={step.icon} />
                        )}
                        {isActive && (
                          <span className="absolute inset-0 animate-ping rounded-full bg-clay-primary/20" />
                        )}
                      </span>

                      {/* Label aksi */}
                      <span
                        className={`shrink-0 text-xs font-bold ${
                          step.status === "done"
                            ? "text-clay-muted"
                            : "text-clay-dark"
                        }`}
                      >
                        {step.label}
                      </span>

                      {/* Chip detail baris aktif */}
                      {isActive && step.detail && (
                        <span className="inline-flex min-w-0 flex-1 items-center truncate rounded-full bg-clay-inputBg px-2 py-0.5 text-[11px] font-semibold text-clay-muted">
                          {step.detail}
                        </span>
                      )}

                      {/* Chevron expand bila ada detail */}
                      {step.detail && (
                        <ChevronDown
                          size={12}
                          className={`ml-auto shrink-0 text-clay-muted transition-transform duration-200 ${
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
                        <p className="mb-1 ml-8 border-l-2 border-clay-borderLight py-0.5 pl-3 text-[11px] font-medium text-clay-muted">
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
