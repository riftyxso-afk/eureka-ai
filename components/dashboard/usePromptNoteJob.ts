"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiEventSource, getClientLocale } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { detectNoteIntent } from "@/lib/assistant/noteIntent";
import { addActiveJobId, removeActiveJobId } from "@/context/JobWatcherContext";
import { useNoteSteps, type NoteProgressEvent } from "@/components/note/useNoteSteps";
import type { NoteCreatePrefs } from "@/components/note/NoteCreateWizard";

type JobState = { status: "running" | "done" | "error"; prompt: string; percent: number; message: string; jobId?: string; noteId?: string; error?: string };
export function usePromptNoteJob() {
  const [job, setJob] = useState<JobState | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [connection, setConnection] = useState("");
  const { steps, handleEvent, reset } = useNoteSteps();
  const active = useRef(false);
  const mounted = useRef(true);
  const stop = useRef<() => void>(() => {});
  const jobId = useRef("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; stop.current(); abort.current?.abort(); }; }, []);
  const start = useCallback(async (prompt: string, prefs: NoteCreatePrefs, files: readonly File[] = []) => {
    if (active.current) return;
    active.current = true; jobId.current = ""; stop.current(); reset(); setConnection("");
    setJob({ status: "running", prompt, percent: 0, message: "Mengirim topik ke Momo…" });
    const controller = new AbortController(); abort.current = controller;
    const sessionId = crypto.randomUUID();
    let timer: ReturnType<typeof setInterval> | undefined;
    let es: EventSource | undefined;
    stop.current = () => { es?.close(); if (timer) clearInterval(timer); };
    const fail = (message: string) => { active.current = false; stop.current(); if (mounted.current) setJob(current => current && ({ ...current, status: "error", error: message })); };
    try {
      const intent = detectNoteIntent(prompt);
      const form = new FormData();
      if (files.length) {
        if (files.length > 5 || files.some(file => file.size > 4 * 1024 * 1024 || file.size === 0)) throw new Error("Pilih hingga 5 file, masing-masing maksimal 4 MB dan tidak kosong.");
        const sources = files.map((file, index) => {
          form.set(`file${index}`, file);
          const type = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(file.name) ? "audio" : file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name) ? "video" : "dokumen";
          return { type, fileName: file.name };
        });
        form.set("sources", JSON.stringify(sources));
      } else form.set("sources", JSON.stringify(intent.url ? [{ type: intent.isYoutube ? "youtube" : "web", url: intent.url }] : [{ type: "prompt", prompt: intent.topic }]));
      form.set("userId", getUserId()); form.set("sessionId", sessionId);
      form.set("chapterCount", String(prefs.chapterCount)); form.set("generationMode", prefs.generationMode);
      form.set("studyMode", prefs.studyMode); form.set("noteType", prefs.noteType);
      form.set("bahasa", getClientLocale() === "en" ? "English" : "Bahasa Indonesia");
      const response = await apiFetch("/api/notes/process", { method: "POST", body: form, headers: { "x-session-id": sessionId }, signal: controller.signal });
      const result = await response.json();
      if (!response.ok || typeof result.jobId !== "string") throw new Error(result.error || "Proses catatan belum bisa dimulai.");
      jobId.current = result.jobId; addActiveJobId(result.jobId);
      if (!mounted.current) return;
      setJob(current => current && ({ ...current, jobId: result.jobId }));
      let polling = false;
      async function poll() {
        if (polling || !active.current) return;
        polling = true;
        try {
          const statusResponse = await apiFetch(`/api/notes/jobs/${encodeURIComponent(result.jobId)}`, { signal: controller.signal });
          const data = await statusResponse.json();
          if (!statusResponse.ok) {
            if ([401, 403, 404].includes(statusResponse.status)) { fail(data.error || "Proses tidak ditemukan. Silakan coba lagi."); return; }
            throw new Error("Status belum tersedia");
          }
          const next = data.job;
          if (!next || !mounted.current || !active.current || controller.signal.aborted) return;
          if (next.status === "error") { removeActiveJobId(result.jobId); fail(next.error || "Catatan gagal diproses."); return; }
          setConnection("");
          if (next.status === "done" && next.noteId) {
            active.current = false; stop.current(); removeActiveJobId(result.jobId);
            setJob(current => current && ({ ...current, status: "done", percent: 100, message: "Catatan siap dipelajari", noteId: next.noteId }));
            if (files.length) {
              try { localStorage.setItem(`eureka:v2:sources:${getUserId()}:${next.noteId}`, JSON.stringify(files.map(file => ({ name: file.name, size: file.size, type: file.type })))); } catch { /* Source labels are optional on this device. */ }
            }
            window.dispatchEvent(new CustomEvent("note-ready"));
          } else setJob(current => current && ({ ...current, percent: Math.max(current.percent, Math.min(99, Number(next.percent) || 0)), message: next.message || current.message }));
        } catch { if (mounted.current && !controller.signal.aborted) setConnection("Menghubungkan ulang. Proses tetap berjalan di server."); }
        finally { polling = false; }
      }
      es = apiEventSource(`/api/notes/process-progress/${sessionId}`);
      es.onmessage = event => {
        if (!mounted.current || !active.current) return;
        try {
          const data = JSON.parse(event.data) as NoteProgressEvent;
          handleEvent(data); setConnection("");
          setJob(current => current && ({ ...current, percent: Math.max(current.percent, Math.min(99, data.percent ?? 0)), message: data.message || current.message }));
          if ((data.percent ?? 0) >= 100) void poll();
        } catch { /* Ignore incomplete events; polling keeps the status current. */ }
      };
      es.onerror = () => { if (mounted.current && active.current) setConnection("Memperbarui progres melalui koneksi cadangan…"); };
      timer = setInterval(() => void poll(), 3000);
      void poll();
    } catch (error) { if (!controller.signal.aborted) fail(error instanceof Error ? error.message : "Proses belum bisa dimulai."); }
  }, [handleEvent, reset]);
  async function cancel() {
    if (!jobId.current || cancelling) return;
    setCancelling(true);
    try {
      const response = await apiFetch(`/api/notes/jobs/${encodeURIComponent(jobId.current)}`, { method: "POST" });
      if (!response.ok) throw new Error();
      stop.current(); abort.current?.abort(); active.current = false; removeActiveJobId(jobId.current);
      setJob(current => current && ({ ...current, status: "error", error: "Pembuatan dihentikan. Kamu bisa menyesuaikan topik dan mencoba lagi." }));
    } catch { setConnection("Permintaan berhenti belum terkirim. Silakan coba lagi."); }
    finally { setCancelling(false); }
  }
  return { job, steps, connection, start, cancel, cancelling, busy: job?.status === "running", dismiss: () => { if (!active.current) { setJob(null); reset(); } } };
}
