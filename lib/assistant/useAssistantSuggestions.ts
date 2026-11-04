"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { parseAssistantSuggestions } from "@/lib/assistant/suggestions";
import type { AssistantChatMessage, AssistantSuggestion } from "@/lib/assistant/types";

export function useAssistantSuggestions(sessionId: string, messages: AssistantChatMessage[], sending: boolean, hasError: boolean) {
  const [items, setItems] = useState<AssistantSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map<string, AssistantSuggestion[]>());
  const request = useRef(0);
  const latest = messages[messages.length - 1];
  const messageId = !sending && !hasError && latest?.role === "assistant" && latest.content.trim() ? latest.id : null;

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++request.current;
    if (!sessionId || !messageId) {
      setItems([]);
      setLoading(false);
      return () => controller.abort();
    }
    const key = `${sessionId}:${messageId}`;
    const cached = cache.current.get(key);
    if (cached) {
      setItems(cached);
      setLoading(false);
      return () => controller.abort();
    }
    setItems([]);
    setLoading(true);
    void apiFetch("/api/assistant/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, userId: getUserId(), messageId }),
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error("Saran tidak tersedia");
      const suggestions = parseAssistantSuggestions(body);
      if (suggestions.length !== 3) throw new Error("Saran tidak valid");
      return suggestions;
    }).then((suggestions) => {
      if (request.current !== requestId || controller.signal.aborted) return;
      cache.current.set(key, suggestions);
      setItems(suggestions);
      setLoading(false);
    }).catch(() => {
      // Auxiliary suggestions never turn into a chat error or a generic fallback.
      if (request.current !== requestId || controller.signal.aborted) return;
      setItems([]);
      setLoading(false);
    });
    return () => controller.abort();
  }, [sessionId, messageId]);

  return { items, loading: loading && !!messageId };
}
