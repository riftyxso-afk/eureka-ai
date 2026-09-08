"use client";

import { useCallback, useRef, useState } from "react";

/** Step UI dari event kemajuan SSE (mirrors lib/progressTracker StepInfo). */
export interface NoteStep {
  id: string;
  label: string;
  icon: string;
  detail?: string;
  status: "active" | "done";
  isSubStep?: boolean;
}

/** Payload event kemajuan dari SSE /api/notes/process-progress. */
export interface NoteProgressEvent {
  phase?: string;
  percent?: number;
  message?: string;
  step?: NoteStep;
}

/**
 * Ubah event kemajuan SSE → daftar langkah untuk NoteLoadingSteps.
 *
 * Idempoten terhadap event berulang (replay SSE setelah putus-sambung):
 * state dibangun per id langkah — event duplikat hanya memperbarui, tidak
 * menambah baris. Urutan baris = urutan kedatangan pertama tiap id.
 * Tidak ada timer/mock: baris hanya berubah saat event SSE tiba.
 *
 * Sub-steps (chapter-0, chapter-1, ...) dikelompokkan di bawah
 * langkah "chapters" sebagai children.
 */
export function useNoteSteps() {
  const [steps, setSteps] = useState<NoteStep[]>([]);
  const seenRef = useRef<Map<string, NoteStep>>(new Map());
  const orderRef = useRef<string[]>([]);

  const handleEvent = useCallback((event: NoteProgressEvent) => {
    const step = event.step;
    if (!step?.id || !step.label) return;
    const seen = seenRef.current;
    const existing = seen.get(step.id);
    if (existing) {
      // Update di tempat — tidak menambah baris baru (aman untuk replay).
      seen.set(step.id, { ...step });
    } else {
      seen.set(step.id, { ...step });
      orderRef.current = [...orderRef.current, step.id];
    }
    // Rebuild: parent steps dulu, lalu sub-steps per parent.
    const allSteps: NoteStep[] = [];
    for (const id of orderRef.current) {
      const s = seen.get(id)!;
      if (s.isSubStep) continue; // ditambahkan sebagai children
      allSteps.push(s);
      // Kumpulkan sub-steps untuk step ini (chapter-0, chapter-1, ...)
      if (id === "chapters") {
        const subSteps = orderRef.current
          .filter((subId) => subId.startsWith("chapter-"))
          .map((subId) => seen.get(subId)!)
          .filter(Boolean);
        allSteps.push(...subSteps);
      }
    }
    setSteps(allSteps);
  }, []);

  const reset = useCallback(() => {
    seenRef.current = new Map();
    orderRef.current = [];
    setSteps([]);
  }, []);

  return { steps, handleEvent, reset };
}
