"use client";

import { useCallback, useRef, useState } from "react";

/** Step UI dari event kemajuan SSE (mirrors lib/progressTracker StepInfo). */
export interface NoteStep {
  id: string;
  label: string;
  icon: string;
  detail?: string;
  status: "active" | "done";
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
      setSteps(orderRef.current.map((id) => seen.get(id)!));
    } else {
      seen.set(step.id, { ...step });
      orderRef.current = [...orderRef.current, step.id];
      setSteps(orderRef.current.map((id) => seen.get(id)!));
    }
  }, []);

  const reset = useCallback(() => {
    seenRef.current = new Map();
    orderRef.current = [];
    setSteps([]);
  }, []);

  return { steps, handleEvent, reset };
}
