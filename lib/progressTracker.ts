/**
 * Progress tracking untuk proses pembuatan catatan (ekstrak → bab →
 * enrichment web search → RAG → study tools), dikirim realtime via SSE.
 *
 * Store in-memory per sesi (Map) dengan TTL 10 menit — pola sama seperti
 * store JSON MVP lain; nanti bisa diganti Redis bila perlu horizontal scaling.
 */

export type ProcessPhase =
  | "extract"
  | "chapters"
  | "enrichment"
  | "rag"
  | "study_tools";

/**
 * Info langkah (step) yang ikut pada event kemajuan — dipakai UI untuk
 * menampilkan daftar langkah nyata yang sedang dikerjakan AI
 * (note-loading-live-steps). Field opsional: klien lama yang hanya membaca
 * percent/message tetap berfungsi.
 */
export interface StepInfo {
  /** Identitas langkah = fase pipeline (satu baris per fase). */
  id: ProcessPhase;
  /** Label aksi dalam bahasa Indonesia. */
  label: string;
  /** Kunci ikon UI (dipetakan ke ikon lucide di komponen). */
  icon: string;
  /** Detail pendek: pesan pipeline terkini (mis. "Bab 2/4"). */
  detail?: string;
  /** active = sedang berjalan; done = selesai. */
  status: "active" | "done";
}

export interface ProgressEvent {
  phase: ProcessPhase;
  percent: number;
  message: string;
  timestamp: number;
  /** Langkah UI — aditif; absen pada event lama. */
  step?: StepInfo;
}

/** Fraksi kemajuan (0..1) dalam satu fase, dipakai oleh fungsi kaitan AI. */
export type PhaseProgressFn = (fraction: number, label: string) => void;

const MAX_EVENTS_PER_SESSION = 300;
const SESSION_TTL_MS = 10 * 60 * 1000;

interface Session {
  events: ProgressEvent[];
  updatedAt: number;
}

const sessions = new Map<string, Session>();

function cleanup() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.updatedAt > SESSION_TTL_MS) sessions.delete(id);
  }
}

export function registerSession(sessionId: string) {
  cleanup();
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { events: [], updatedAt: Date.now() });
  }
}

export function publishProgress(sessionId: string, event: ProgressEvent) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.events.push(event);
  if (session.events.length > MAX_EVENTS_PER_SESSION) {
    session.events.splice(0, session.events.length - MAX_EVENTS_PER_SESSION);
  }
  session.updatedAt = Date.now();
}

export function getProgressEvents(sessionId: string): ProgressEvent[] {
  return sessions.get(sessionId)?.events ?? [];
}

export function closeSession(sessionId: string) {
  sessions.delete(sessionId);
}

/**
 * Batas fase pada persen keseluruhan:
 * extract 0-15, chapters 15-50, enrichment 50-80, rag 80-90, study_tools 90-100.
 */
const PHASES: Record<ProcessPhase, { base: number; span: number }> = {
  extract: { base: 0, span: 15 },
  chapters: { base: 15, span: 35 },
  enrichment: { base: 50, span: 30 },
  rag: { base: 80, span: 10 },
  study_tools: { base: 90, span: 10 },
};

/** Konversi fraksi (0..1) dalam satu fase → persen absolut 0-100. */
export function phaseToPercent(phase: ProcessPhase, fraction: number): number {
  const { base, span } = PHASES[phase];
  return Math.round(base + span * Math.max(0, Math.min(1, fraction)));
}

/** Persen absolut saat sebuah fase selesai. */
export function phaseDonePercent(phase: ProcessPhase): number {
  return phaseToPercent(phase, 1);
}

/**
 * Label & ikon langkah per fase untuk UI daftar langkah (note-loading-live-steps).
 * Label bahasa Indonesia; ikon adalah nama lucide yang dipetakan di komponen.
 */
export const PHASE_STEP_META: Record<ProcessPhase, { label: string; icon: string }> = {
  extract: { label: "Mengambil materi", icon: "download" },
  chapters: { label: "Menyusun bab catatan", icon: "pen" },
  enrichment: { label: "Memperkaya dengan pencarian web", icon: "globe" },
  rag: { label: "Menyiapkan pencarian cerdas", icon: "database" },
  study_tools: { label: "Membuat kuis & kartu hafalan", icon: "layers" },
};

export class ProgressTracker {
  private readonly sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    registerSession(sessionId);
    this.emit("extract", 0, "Menyiapkan proses...");
  }

  /** Emit event dengan persen absolut 0-100; otomatis menyertakan step UI. */
  emit(phase: ProcessPhase, percent: number, message: string, stepDone = false) {
    const meta = PHASE_STEP_META[phase];
    publishProgress(this.sessionId, {
      phase,
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      message,
      timestamp: Date.now(),
      step: {
        id: phase,
        label: meta.label,
        icon: meta.icon,
        detail: message,
        status: stepDone ? "done" : "active",
      },
    });
  }

  /** Kemajuan berbasis fraksi 0..1 di dalam satu fase. */
  advance(phase: ProcessPhase, fraction: number, message: string) {
    this.emit(phase, phaseToPercent(phase, fraction), message);
  }

  /** Tandai satu fase selesai. */
  done(phase: ProcessPhase, message: string) {
    this.emit(phase, phaseDonePercent(phase), message, true);
  }

  /** Wrapper fase: emit awal → jalankan kerja → emit selesai. */
  async run<T>(
    phase: ProcessPhase,
    startMsg: string,
    doneMsg: string,
    work: () => Promise<T>
  ): Promise<T> {
    this.advance(phase, 0.03, startMsg);
    const result = await work();
    this.done(phase, doneMsg);
    return result;
  }
}