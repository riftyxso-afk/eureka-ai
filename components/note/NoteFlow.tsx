"use client";

import { ArrowRight } from "lucide-react";

interface NoteFlowProps {
  flow: string[];
}

/** Diagram alur proses: kotak langkah claymorphism dihubungkan panah. */
export const NoteFlow = ({ flow }: NoteFlowProps) => {
  if (!flow || flow.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-clay-muted">
        Alur Proses
      </div>
      <div className="flex flex-wrap items-center gap-y-3">
        {flow.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="rounded-clay-md border-3 border-clay-primary/30 bg-clay-primary/10 px-3 py-2 text-xs font-extrabold leading-snug text-clay-primary shadow-clay-sm">
              <span className="mr-1.5 text-clay-muted">{i + 1}.</span>
              {step}
            </div>
            {i < flow.length - 1 && (
              <ArrowRight size={16} className="shrink-0 text-clay-muted" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
