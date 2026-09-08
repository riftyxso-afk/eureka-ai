"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import {
  streamAssistantChat,
  type ClarificationQuestion,
} from "@/lib/assistant-stream";
import {
  streamAgentLoop,
  type LoopDecision,
  type StepLogEntry,
} from "@/lib/agents/loopStream";
import {
  ArtifactStreamParser,
  type ArtifactParserEvent,
} from "@/lib/agents/artifactParser";
import type { Artifact } from "@/lib/agents/types";
import { findYoutubeLink } from "@/lib/assistant/videoUrl";
import type {
  AssistantChatMessage,
  AssistantChatSession,
  ChatToolOptions,
  WebSearchItem,
  WebSearchStage,
} from "@/lib/assistant/types";

/** Input kirim pesan: teks + mentions + opsi tool (web search / lampiran). */
export interface ChatSendInput extends ChatToolOptions {
  question: string;
  mentions: string[];
  /** Jawaban klarifikasi (saat prompt ambigu) — disuntikkan server. */
  clarifications?: { id: string; question?: string; answer: string }[];
  /** User memilih "Langsung jawab saja" — lewati klarifikasi tanpa menilai ulang. */
  clarificationsSkipped?: boolean;
}

/** State loop "Eureka Multi Agent" yang tampil di UI (indikator iterasi). */
export interface LoopUiState {
  /** Toggle ON — dipertahankan saat ganti topik/sesi (PRD §5.1). */
  toggleOn: boolean;
  iteration: number;
  maxIterations: number;
  status: "active" | "goal_reached" | "max_iterations" | "user_stopped" | "manual_exit" | null;
  decision: LoopDecision | null;
}

/** Artifact yang sedang dirender di canvas (live streaming included). */
export interface CanvasState {
  artifacts: Artifact[];
  /** Artifact yang sedang menerima stream (terakhir dibuka). */
  streamingId: string | null;
  /** Panel canvas terbuka (dipakai toggle tombol). */
  open: boolean;
}

export interface StreamingState {
  content: string;
  thinking: string;
  sources: AssistantChatMessage["sources"];
  error: string | null;
  /** Link upgrade (402 premium) — tampilkan tombol ke /pricing. */
  upgradeUrl: string | null;
  model: string | null;
  skill: string | null;
  /** Pipeline web search (tool globe) — loading bertahap. */
  webStage: WebSearchStage | null;
  /** Hasil pencarian web yang ditampilkan dengan logo situs. */
  webResults: WebSearchItem[];
}

/**
 * Konten pesan user yang tampil di bubble: prompt asli + jawaban QnA
 * (format Q/A) bila user menjawab klarifikasi — konsisten dengan yang
 * disimpan server (effectiveQuestion).
 */
function buildStoredQuestion(input: ChatSendInput): string {
  const answers = input.clarifications ?? [];
  if (answers.length === 0) return input.question;
  const qa = answers
    .map((c) => `Pilih: ${c.question || c.id} -> ${c.answer}`)
    .join("\n");
  return `${input.question}\n\nPilihan pengguna untuk pertanyaan klarifikasi:\n${qa}`;
}

function newStreaming(): StreamingState {
  return {
    content: "",
    thinking: "",
    sources: [],
    error: null,
    upgradeUrl: null,
    model: null,
    skill: null,
    webStage: null,
    webResults: [],
  };
}

export interface UseAssistantChatResult {
  sessions: AssistantChatSession[];
  messages: AssistantChatMessage[];
  loading: boolean;
  sending: boolean;
  streaming: StreamingState;
  sessionsLoading: boolean;
  hasError: boolean;
  renderedMessages: AssistantChatMessage[];
  refreshSessions: () => Promise<void>;
  loadMessages: (id: string) => Promise<void>;
  handleNew: () => Promise<void>;
  handleSend: (input: ChatSendInput) => Promise<void>;
  handleStop: () => void;
  handleRetry: () => void;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<AssistantChatSession[]>;
  /** Pertanyaan klarifikasi aktif (prompt ambigu) — null bila tidak ada. */
  clarification: ClarificationQuestion[] | null;
  /** Kirim ulang prompt dengan jawaban klarifikasi. */
  answerClarification: (answers: { id: string; answer: string }[]) => Promise<void>;
  /** Lewati klarifikasi — langsung jawab dengan prompt apa adanya. */
  skipClarification: () => Promise<void>;
  /** State Mode "Eureka Multi Agent" (toggle + iterasi untuk indikator). */
  loop: LoopUiState;
  /** Nyalakan/matikan toggle Multi Agent (dipanggil pill di Composer). */
  setLoopToggle: (on: boolean) => void;
  /** Artifact Canvas: daftar artifact + status streaming + open. */
  canvas: CanvasState;
  /** Buka panel canvas. */
  openCanvas: () => void;
  /** Tutup panel canvas. */
  closeCanvas: () => void;
  /** Simpan editan artifact markdown (version naik otomatis). */
  saveArtifactEdit: (id: string, content: string) => void;
  /** Step-log Solve-then-Guide (event asli; kosong saat tidak aktif). */
  stepLog: StepLogEntry[];
  /** Output terminal live (stdout/stderr asli sandbox). */
  terminalLive: string;
}

/**
 * Logika chat asisten AI yang dipakai halaman /chat/[id] (dan /home untuk
 * daftar sesi).
 *
 * - `sessionId` null → mode "chat baru": handleSend otomatis membuat sesi
 *   lalu mengirim (onSessionCreated dipanggil dengan id sesi baru).
 * - `sessionId` terisi → muat riwayat, kirim ke sesi tersebut.
 * - `initialSend` → prompt yang diteruskan /home: otomatis dikirim SETELAH
 *   riwayat pertama selesai dimuat (menghindari race: loadMessages tidak
 *   menimpa pesan optimis yang baru ditambahkan).
 * - Streaming SSE dengan tombol Stop & Retry idempotent (tanpa duplikat).
 */
export function useAssistantChat(options: {
  sessionId: string | null;
  onSessionCreated?: (id: string) => void;
  initialSend?: ChatSendInput | null;
}): UseAssistantChatResult {
  const { sessionId, onSessionCreated } = options;
  const initialSendRef = useRef(options.initialSend ?? null);
  const initialSentRef = useRef(false);

  const [sessions, setSessions] = useState<AssistantChatSession[]>([]);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState<StreamingState>(newStreaming());
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const abortRef = useRef<() => void>(() => {});
  const stoppedRef = useRef(false);
  const sendingRef = useRef(false);
  const lastSendRef = useRef<ChatSendInput | null>(null);
  const [clarification, setClarification] = useState<ClarificationQuestion[] | null>(null);
  // ── Mode "Eureka Multi Agent" ──
  // Toggle & iterasi per sesi; state terakhir dipertahankan saat ganti topik.
  const [loop, setLoop] = useState<LoopUiState>({
    toggleOn: false,
    iteration: 0,
    maxIterations: 6,
    status: null,
    decision: null,
  });
  // Ref agar handleSend membaca state toggle terbaru tanpa re-create callback.
  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // ── Artifact Canvas ──
  const [canvas, setCanvas] = useState<CanvasState>({
    artifacts: [],
    streamingId: null,
    open: false,
  });
  // Parser artifact hidup selama satu respons streaming (dibuat per send).
  const parserRef = useRef<ArtifactStreamParser | null>(null);

  // ── Step-log Solve-then-Guide (event SSE asli — PRD §8.4) ──
  const [stepLog, setStepLog] = useState<StepLogEntry[]>([]);
  const [terminalLive, setTerminalLive] = useState<string>("");

  /** Buka panel canvas. */
  const openCanvas = useCallback(() => {
    setCanvas((c) => ({ ...c, open: true }));
  }, []);

  /** Tutup panel canvas & bersihkan artifact (mis. saat ganti sesi). */
  const closeCanvas = useCallback(() => {
    setCanvas((c) => ({ ...c, open: false }));
  }, []);

  /** Simpan editan artifact markdown — content baru + version bertambah. */
  const saveArtifactEdit = useCallback((id: string, content: string) => {
    setCanvas((c) => ({
      ...c,
      artifacts: c.artifacts.map((a) =>
        a.id === id ? { ...a, content, version: a.version + 1 } : a
      ),
    }));
  }, []);
  // Input & sesi yang sedang menunggu jawaban klarifikasi (untuk kirim ulang).
  const pendingInputRef = useRef<ChatSendInput | null>(null);
  const pendingSessionRef = useRef<string | null>(null);
  // Buffer teks streaming (token/thinking) — di-flush PALING CEPAT tiap
  // FLUSH_MIN_MS agar puluhan event SSE per detik tidak memicu rantai
  // re-render + efek pasif yang tak pernah reda (pemicu "Maximum update
  // depth exceeded" + lag Markdown/KaTeX). Sisa buffer selalu ikut pada
  // flush berikutnya / saat stream selesai, jadi tak ada token hilang.
  const streamBufRef = useRef({ content: "", thinking: "" });
  const streamFlushRef = useRef<number | null>(null);
  const lastFlushRef = useRef(0);
  const FLUSH_MIN_MS = 120;

  /** Terapkan isi buffer ke state dalam SATU setState. */
  const flushStreamBuffer = useCallback(() => {
    streamFlushRef.current = null;
    const content = streamBufRef.current.content;
    const thinking = streamBufRef.current.thinking;
    streamBufRef.current.content = "";
    streamBufRef.current.thinking = "";
    if (!content && !thinking) return;
    lastFlushRef.current = Date.now();
    setStreaming((s) => ({
      ...s,
      content: s.content + content,
      thinking: s.thinking + thinking,
      // Token mulai mengalir → tahap terakhir pipeline: menyusun jawaban.
      webStage: content && s.webStage ? "writing" : s.webStage,
    }));
  }, []);

  /** Buang buffer terjadwal (dipakai saat stop/kirim baru agar tak bocor). */
  const clearStreamBuffer = useCallback(() => {
    if (streamFlushRef.current !== null) {
      // ID bisa dari rAF maupun setTimeout — batalkan keduanya (no-op aman).
      cancelAnimationFrame(streamFlushRef.current);
      clearTimeout(streamFlushRef.current);
      streamFlushRef.current = null;
    }
    streamBufRef.current.content = "";
    streamBufRef.current.thinking = "";
  }, []);

  /** Tampung teks, jadwalkan satu flush (segera atau tunda hingga throttle). */
  const queueStreamText = useCallback(
    (kind: "content" | "thinking", text: string) => {
      streamBufRef.current[kind] += text;
      if (streamFlushRef.current !== null) return; // sudah terjadwal
      const wait = FLUSH_MIN_MS - (Date.now() - lastFlushRef.current);
      if (wait <= 0) {
        streamFlushRef.current = requestAnimationFrame(flushStreamBuffer);
      } else {
        // Tunda hingga jendela throttle lewat — trailing flush dijamin jalan
        // walau tak ada token lagi sesudahnya.
        streamFlushRef.current = window.setTimeout(flushStreamBuffer, wait) as unknown as number;
      }
    },
    [flushStreamBuffer]
  );

  /** Terapkan event parser artifact ke state canvas + teks chat. */
  const applyParserEvents = useCallback(
    (events: ArtifactParserEvent[]) => {
      if (events.length === 0) return;
      let chatText = "";
      for (const ev of events) {
        if (ev.kind === "chat") {
          chatText += ev.text;
        } else if (ev.kind === "artifact-open") {
          setCanvas((c) => ({
            ...c,
            artifacts: [...c.artifacts, ev.artifact],
            streamingId: ev.artifact.id,
            open: true,
          }));
        } else if (ev.kind === "artifact-chunk") {
          const { id, text } = ev;
          setCanvas((c) => ({
            ...c,
            artifacts: c.artifacts.map((a) =>
              a.id === id ? { ...a, content: a.content + text } : a
            ),
          }));
        } else if (ev.kind === "artifact-close") {
          setCanvas((c) => ({
            ...c,
            streamingId: c.streamingId === ev.id ? null : c.streamingId,
          }));
        }
      }
      if (chatText) queueStreamText("content", chatText);
    },
    [queueStreamText]
  );

  const refreshSessions = useCallback(async () => {
    const userId = getUserId();
    if (!userId) return;
    try {
      const res = await apiFetch(
        `/api/assistant/sessions?userId=${encodeURIComponent(userId)}`
      );
      const data = (await res.json()) as { sessions?: AssistantChatSession[] };
      setSessions(data.sessions ?? []);
    } catch {
      // abaikan — retry pada navigasi berikutnya
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const userId = getUserId();
    if (!userId) return;
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/assistant/sessions/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`
      );
      if (!res.ok) {
        // Sesi hilang / bukan milik user — kosongkan (pemanggil bisa redirect).
        setMessages([]);
        return;
      }
      const data = (await res.json()) as {
        messages?: AssistantChatMessage[];
      };
      const fetchedMsgs = data.messages ?? [];
      setMessages(fetchedMsgs);

      // Parse artifact dari riwayat percakapan terdahulu agar canvas terisi
      // saat halaman di-load / di-refresh
      if (fetchedMsgs.length > 0) {
        let historyArtifacts: Artifact[] = [];
        for (const msg of fetchedMsgs) {
          if (msg.role === "assistant" && msg.content.includes("<artifact")) {
            const historyParser = new ArtifactStreamParser();
            const evs = historyParser.push(msg.content);
            for (const ev of evs) {
              if (ev.kind === "artifact-open") historyArtifacts.push(ev.artifact);
              else if (ev.kind === "artifact-chunk") {
                const target = historyArtifacts.find((a) => a.id === ev.id);
                if (target) target.content += ev.text;
              }
            }
            const flushEvs = historyParser.flush();
            for (const ev of flushEvs) {
              if (ev.kind === "artifact-chunk") {
                const target = historyArtifacts.find((a) => a.id === ev.id);
                if (target) target.content += ev.text;
              }
            }
          }
        }
        if (historyArtifacts.length > 0) {
          setCanvas({
            artifacts: historyArtifacts,
            streamingId: null,
            open: true,
          });
        }
      }
    } catch {
      // jaringan offline — tampilkan kosong
    } finally {
      setLoading(false);
    }
  }, []);

  // Muat riwayat saat sesi aktif berubah (lewati saat sedang mengirim,
  // supaya placeholder streaming tidak tertimpa data setengah jalan).
  useEffect(() => {
    if (sessionId && !sendingRef.current) {
      loadMessages(sessionId);
      setStreaming(newStreaming());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions, sessionId]);

  const handleNew = useCallback(async () => {
    try {
      const res = await apiFetch("/api/assistant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: getUserId() }),
      });
      const data = (await res.json()) as { session?: { id: string } };
      if (data.session?.id) onSessionCreated?.(data.session.id);
    } catch {
      // abaikan
    }
  }, [onSessionCreated]);

  const sendTo = useCallback(
    async (targetSessionId: string, input: ChatSendInput) => {
      const userId = getUserId();
      if (!userId) return;

      // Link YouTube pada pesan → video aktif (embed + konteks transkrip AI).
      // Deteksi otomatis dari teks bila input belum membawanya.
      const videoUrl =
        input.videoUrl ?? findYoutubeLink(input.question)?.url ?? null;

      lastSendRef.current = input;
      stoppedRef.current = false;
      setSending(true);
      sendingRef.current = true;
      clearStreamBuffer();
      setStreaming(newStreaming());
      setClarification(null);

      // Optimis: tampilkan pesan user + placeholder asisten
      const nowIso = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        {
          id: "local-" + nowIso,
          sessionId: targetSessionId,
          role: "user",
          content: buildStoredQuestion(input),
          mentions: input.mentions,
          sources: [],
          model: null,
          createdAt: nowIso,
          attachmentName: input.attachment?.filename ?? null,
          videoUrl,
        },
        {
          id: "stream-" + nowIso,
          sessionId: targetSessionId,
          role: "assistant",
          content: "",
          mentions: [],
          sources: [],
          model: null,
          createdAt: nowIso,
        },
      ]);

      const { abort, completed } = await streamAssistantChat(
        {
          sessionId: targetSessionId,
          userId,
          question: input.question,
          mentions: input.mentions,
          webSearch: input.webSearch,
          attachment: input.attachment,
          speedMode: input.speedMode,
          videoUrl,
          clarifications: input.clarifications,
          clarificationsSkipped: input.clarificationsSkipped,
          reasoning: input.reasoning ?? true,
          model: input.model,
        },
        (ev) => {
          if (ev.type === "token") {
            // Artifact parser: pisahkan tag <artifact> dari teks chat.
            applyParserEvents(parserRef.current?.push(ev.text) ?? []);
          } else if (ev.type === "thinking") {
            queueStreamText("thinking", ev.text);
          } else if (ev.type === "sources") {
            flushStreamBuffer();
            setStreaming((s) => ({ ...s, sources: ev.sources }));
          } else if (ev.type === "meta") {
            flushStreamBuffer();
            if (ev.model) setStreaming((s) => ({ ...s, model: ev.model ?? null }));
          } else if (ev.type === "pipeline") {
            flushStreamBuffer();
            setStreaming((s) => ({ ...s, webStage: ev.stage }));
          } else if (ev.type === "web") {
            flushStreamBuffer();
            setStreaming((s) => ({
              ...s,
              webResults: ev.results,
              // Hasil sudah didapat → lanjut ke tahap menganalisis.
              webStage: s.webStage === "writing" ? s.webStage : "analyzing",
            }));
          } else if (ev.type === "error") {
            flushStreamBuffer();
            setStreaming((s) => ({
              ...s,
              error: ev.message,
              upgradeUrl: ev.upgradeUrl ?? null,
            }));
          } else if (ev.type === "clarification") {
            // Prompt ambigu: tampilkan kartu pertanyaan. Pesan optimis user +
            // placeholder dihapus (belum disimpan server), input disimpan untuk
            // dikirim ulang setelah user menjawab.
            pendingInputRef.current = input;
            pendingSessionRef.current = targetSessionId;
            setClarification(ev.questions);
            setMessages((prev) =>
              prev.filter(
                (m) => !m.id.startsWith("local-") && !m.id.startsWith("stream-")
              )
            );
            setSending(false);
            sendingRef.current = false;
          }
        }
      );
      abortRef.current = abort;

      try {
        await completed;
      } catch {
        // Pembatalan oleh user (Stop) bukan error.
        if (!stoppedRef.current) {
          setStreaming((s) => ({
            ...s,
            error: "Koneksi terputus. Coba lagi ya.",
          }));
        }
      }

      // Pastikan sisa buffer ikut tampil sebelum riwayat final dimuat.
      // Flush parser: tag artifact menggantung dilepas aman (PRD §7.3).
      applyParserEvents(parserRef.current?.flush() ?? []);
      parserRef.current = null;
      flushStreamBuffer();
      setSending(false);
      sendingRef.current = false;
      // Ambil ulang pesan tersimpan dari server (sumber + history final).
      await loadMessages(targetSessionId);
      await refreshSessions();
      // Judul sesi di-generate AI secara fire-and-forget di server — bisa
      // selesai SETELAH refresh di atas. Bila sesi ini masih berjudul
      // default, refresh sekali lagi beberapa detik kemudian agar judul
      // baru muncul di sidebar tanpa reload.
      const wasUntitled = !sessions.find(
        (s) => s.id === targetSessionId && s.title && s.title !== "Percakapan baru"
      );
      if (wasUntitled) {
        setTimeout(() => void refreshSessions(), 4000);
      }
    },
    [loadMessages, refreshSessions, queueStreamText, flushStreamBuffer, clearStreamBuffer, sessions, applyParserEvents]
  );

  // ── Kirim via Mode "Eureka Multi Agent" (/api/agents/loop) ──────────────
  // Satu request = satu fase loop; state persisten di server (tahan refresh).
  const sendLoop = useCallback(
    async (targetSessionId: string, input: ChatSendInput, turnToggleOn: boolean) => {
      const userId = getUserId();
      if (!userId) return;

      lastSendRef.current = input;
      stoppedRef.current = false;
      setSending(true);
      sendingRef.current = true;
      clearStreamBuffer();
      setStreaming(newStreaming());
      setClarification(null);
      // Parser artifact baru untuk respons ini (token-by-token, PRD §7.3).
      parserRef.current = new ArtifactStreamParser();
      // Step-log kosong di awal turn (event step datang dari backend saja).
      setStepLog([]);
      setTerminalLive("");

      // Optimis: tampilkan pesan user + placeholder asisten (pola sendTo).
      const nowIso = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        {
          id: "local-" + nowIso,
          sessionId: targetSessionId,
          role: "user",
          content: input.question,
          mentions: input.mentions,
          sources: [],
          model: null,
          createdAt: nowIso,
          attachmentName: input.attachment?.filename ?? null,
          videoUrl: null,
        },
        {
          id: "stream-" + nowIso,
          sessionId: targetSessionId,
          role: "assistant",
          content: "",
          mentions: [],
          sources: [],
          model: null,
          createdAt: nowIso,
        },
      ]);

      // Riwayat untuk konteks Socra/Kompas (12 pesan terakhir).
      const history = messages
        .filter((m) => m.content.trim().length > 0)
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const { abort, completed } = await streamAgentLoop(
        {
          sessionId: targetSessionId,
          userId,
          message: input.question,
          toggleOn: turnToggleOn,
          history,
          solveThenGuide: input.solveThenGuide === true,
        },
        (ev) => {
          if (ev.type === "token") {
            applyParserEvents(parserRef.current?.push(ev.text ?? "") ?? []);
          } else if (ev.type === "thinking") {
            queueStreamText("thinking", ev.text ?? "");
          } else if (ev.type === "loop_state") {
            flushStreamBuffer();
            setLoop((l) => ({
              ...l,
              iteration: ev.iteration ?? l.iteration,
              maxIterations: ev.maxIterations ?? l.maxIterations,
              status: (ev.status as LoopUiState["status"]) ?? null,
              decision: ev.decision ?? null,
            }));
          } else if (ev.type === "step") {
            // Step ASLI dari backend (PRD §8.4) — update/append by label.
            flushStreamBuffer();
            const label = ev.label ?? "";
            const status = (ev.status ?? "running") as StepLogEntry["status"];
            setStepLog((list) => {
              const idx = list.findIndex((s) => s.label === label);
              if (idx === -1) return [...list, { label, status }];
              const next = [...list];
              next[idx] = { label, status };
              return next;
            });
          } else if (ev.type === "terminal_output") {
            // stdout/stderr ASLI sandbox — baris demi baris.
            setTerminalLive((t) => (t ? t + "\n" : "") + (ev.line ?? ""));
          } else if (ev.type === "meta") {
            flushStreamBuffer();
            if (ev.model) setStreaming((s) => ({ ...s, model: ev.model ?? null }));
          } else if (ev.type === "error") {
            flushStreamBuffer();
            setStreaming((s) => ({ ...s, error: ev.message ?? "Terjadi kesalahan." }));
          }
          // done → buffer di-flush setelah await completed.
        }
      );
      abortRef.current = abort;

      try {
        await completed;
      } catch {
        if (!stoppedRef.current) {
          setStreaming((s) => ({
            ...s,
            error: "Koneksi terputus. Coba lagi ya.",
          }));
        }
      }

      applyParserEvents(parserRef.current?.flush() ?? []);
      parserRef.current = null;
      flushStreamBuffer();
      setSending(false);
      sendingRef.current = false;
      await loadMessages(targetSessionId);
      await refreshSessions();
    },
    [loadMessages, refreshSessions, queueStreamText, flushStreamBuffer, clearStreamBuffer, messages, applyParserEvents]
  );

  // Auto-kirim prompt dari /home — tunggu riwayat pertama selesai dimuat
  // agar pesan optimis tidak tertimpa oleh hasil load.
  useEffect(() => {
    if (initialSentRef.current) return;
    const pending = initialSendRef.current;
    if (!pending || !sessionId) return;
    if (loading) return; // tunggu loadMessages pertama selesai
    initialSentRef.current = true;
    initialSendRef.current = null;
    void sendTo(sessionId, pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, loading, sendTo]);

  const handleSend = useCallback(
    async (input: ChatSendInput) => {
      if (sendingRef.current) return;
      const userId = getUserId();
      if (!userId) return;

      let targetSessionId = sessionId;
      if (!targetSessionId) {
        // Mode chat baru: buat sesi dulu, baru kirim.
        try {
          const res = await apiFetch("/api/assistant/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          const data = (await res.json()) as { session?: { id: string } };
          if (!data.session?.id) return;
          targetSessionId = data.session.id;
          onSessionCreated?.(targetSessionId);
        } catch {
          return;
        }
      }
      // Toggle ON → jalur loop multi-agent; OFF → chat asisten biasa.
      // Catatan: toggle yang baru dimatikan tetap kirim via loop SEKALI
      // agar server menandai stop instan (status user_stopped).
      const turnToggleOn = loopRef.current.toggleOn;
      const wasActive =
        loopRef.current.status === "active" || loopRef.current.status === null;
      if (turnToggleOn || (loopRef.current.status === "active" && !turnToggleOn) || (wasActive && !turnToggleOn && loopRef.current.iteration > 0)) {
        await sendLoop(targetSessionId, input, turnToggleOn);
      } else {
        await sendTo(targetSessionId, input);
      }
    },
    [sessionId, onSessionCreated, sendTo, sendLoop]
  );

  const handleStop = useCallback(() => {
    stoppedRef.current = true;
    abortRef.current();
    clearStreamBuffer();
    setSending(false);
    sendingRef.current = false;
    setStreaming(newStreaming());
  }, [clearStreamBuffer]);

  const handleRetry = useCallback(() => {
    if (lastSendRef.current && sessionId) {
      sendTo(sessionId, lastSendRef.current);
    }
  }, [sessionId, sendTo]);

  // Kirim ulang prompt yang tadi ambigu dengan jawaban klarifikasi user.
  const answerClarification = useCallback(
    async (answers: { id: string; question?: string; answer: string }[]) => {
      const input = pendingInputRef.current;
      const target = pendingSessionRef.current;
      pendingInputRef.current = null;
      pendingSessionRef.current = null;
      if (!input || !target) return;
      await sendTo(target, { ...input, clarifications: answers });
    },
    [sendTo]
  );

  // Lewati klarifikasi: kirim ulang dengan penanda skip — server TIDAK
  // menilai ulang prompt (cegah loop klarifikasi), langsung menjawab.
  const skipClarification = useCallback(async () => {
    const input = pendingInputRef.current;
    const target = pendingSessionRef.current;
    pendingInputRef.current = null;
    pendingSessionRef.current = null;
    if (!input || !target) return;
    await sendTo(target, { ...input, clarifications: [], clarificationsSkipped: true });
  }, [sendTo]);

  const renameSession = useCallback(
    async (id: string, title: string) => {
      const res = await apiFetch(
        `/api/assistant/sessions/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: getUserId(), title }),
        }
      );
      if (res.ok) await refreshSessions();
    },
    [refreshSessions]
  );

  const deleteSession = useCallback(
    async (id: string): Promise<AssistantChatSession[]> => {
      const res = await apiFetch(
        `/api/assistant/sessions/${encodeURIComponent(id)}?userId=${encodeURIComponent(getUserId())}`,
        { method: "DELETE" }
      );
      if (!res.ok) return sessions;
      const remaining = sessions.filter((s) => s.id !== id);
      setSessions(remaining);
      return remaining;
    },
    [sessions]
  );

  const hasError = streaming.error !== null && streaming.error !== "";
  const renderedMessages: AssistantChatMessage[] = (() => {
    if (!sending) return messages;
    const list = [...messages];
    if (hasError) {
      // Gagal di tengah jalan: sembunyikan placeholder, tampilkan kartu error.
      return list.filter((m) => !m.id.startsWith("stream-"));
    }
    const last = list[list.length - 1];
    if (last && last.id.startsWith("stream-")) {
      list[list.length - 1] = {
        ...last,
        content: streaming.content,
        sources: streaming.sources,
        model: streaming.model,
      };
    }
    return list;
  })();

  return {
    sessions,
    messages,
    loading,
    sending,
    streaming,
    sessionsLoading,
    hasError,
    renderedMessages,
    refreshSessions,
    loadMessages,
    handleNew,
    handleSend,
    handleStop,
    handleRetry,
    renameSession,
    deleteSession,
    clarification,
    answerClarification,
    skipClarification,
    // Mode "Eureka Multi Agent"
    loop,
    setLoopToggle: (on: boolean) =>
      setLoop((l) => ({
        ...l,
        toggleOn: on,
        // Nyalakan ulang toggle setelah loop selesai → state bersih.
        ...(on ? { status: null, decision: null } : {}),
      })),
    // Artifact Canvas
    canvas,
    openCanvas,
    closeCanvas,
    saveArtifactEdit,
    // Step-log Solve-then-Guide
    stepLog,
    terminalLive,
  };
}
