"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import {
  streamAssistantChat,
  type ClarificationQuestion,
} from "@/lib/assistant-stream";
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
    .map((c) => `Q: ${c.question || c.id}\nA: ${c.answer}`)
    .join("\n");
  return `${input.question}\n\nKonteks tambahan dari jawaban pengguna (jadikan jawaban sesuai informasi ini):\n${qa}`;
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
      setMessages(data.messages ?? []);
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
            queueStreamText("content", ev.text);
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
    [loadMessages, refreshSessions, queueStreamText, flushStreamBuffer, clearStreamBuffer, sessions]
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
      await sendTo(targetSessionId, input);
    },
    [sessionId, onSessionCreated, sendTo]
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
  };
}
