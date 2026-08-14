"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { streamAssistantChat } from "@/lib/assistant-stream";
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
}

export interface StreamingState {
  content: string;
  sources: AssistantChatMessage["sources"];
  error: string | null;
  /** Link upgrade (402 premium) — tampilkan tombol ke /pricing. */
  upgradeUrl: string | null;
  model: string | null;
  /** Pipeline web search (tool globe) — loading bertahap. */
  webStage: WebSearchStage | null;
  /** Hasil pencarian web yang ditampilkan dengan logo situs. */
  webResults: WebSearchItem[];
}

function newStreaming(): StreamingState {
  return {
    content: "",
    sources: [],
    error: null,
    upgradeUrl: null,
    model: null,
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

      lastSendRef.current = input;
      stoppedRef.current = false;
      setSending(true);
      sendingRef.current = true;
      setStreaming(newStreaming());

      // Optimis: tampilkan pesan user + placeholder asisten
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
        },
        (ev) => {
          if (ev.type === "token") {
            setStreaming((s) => ({
              ...s,
              content: s.content + ev.text,
              // Token mulai mengalir → tahap terakhir pipeline: menyusun jawaban.
              webStage: s.webStage ? "writing" : s.webStage,
            }));
          } else if (ev.type === "sources") {
            setStreaming((s) => ({ ...s, sources: ev.sources }));
          } else if (ev.type === "meta") {
            if (ev.model) setStreaming((s) => ({ ...s, model: ev.model ?? null }));
          } else if (ev.type === "pipeline") {
            setStreaming((s) => ({ ...s, webStage: ev.stage }));
          } else if (ev.type === "web") {
            setStreaming((s) => ({
              ...s,
              webResults: ev.results,
              // Hasil sudah didapat → lanjut ke tahap menganalisis.
              webStage: s.webStage === "writing" ? s.webStage : "analyzing",
            }));
          } else if (ev.type === "error") {
            setStreaming((s) => ({
              ...s,
              error: ev.message,
              upgradeUrl: ev.upgradeUrl ?? null,
            }));
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

      setSending(false);
      sendingRef.current = false;
      // Ambil ulang pesan tersimpan dari server (sumber + history final).
      await loadMessages(targetSessionId);
      await refreshSessions();
    },
    [loadMessages, refreshSessions]
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
    setSending(false);
    sendingRef.current = false;
    setStreaming(newStreaming());
  }, []);

  const handleRetry = useCallback(() => {
    if (lastSendRef.current && sessionId) {
      sendTo(sessionId, lastSendRef.current);
    }
  }, [sessionId, sendTo]);

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
  };
}
