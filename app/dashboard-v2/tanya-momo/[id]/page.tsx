"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ChatPage from "@/app/chat/[id]/page";
import StudyConversation from "@/components/dashboard/StudyConversation";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import LoadingStatus from "@/components/ui/LoadingStatus";
import type { AssistantChatMessage } from "@/lib/assistant/types";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const explicit = params.get("mode") === "study";
  const [detected, setDetected] = useState<{ id: string; messages: AssistantChatMessage[]; title?: string; study: boolean } | null>(null);
  useEffect(() => {
    if (explicit) return;
    const controller = new AbortController();
    apiFetch("/api/assistant/sessions/" + encodeURIComponent(id) + "?userId=" + encodeURIComponent(getUserId()), { signal: controller.signal }).then(async response => {
      if (!response.ok) return { messages: [] };
      return response.json();
    }).then(data => {
      if (!controller.signal.aborted) setDetected({ id, title: data.session?.title, messages: data.messages || [], study: data.messages?.some((message: AssistantChatMessage) => message.model === "eureka-study") ?? false });
    }).catch(() => { if (!controller.signal.aborted) setDetected({ id, messages: [], study: false }); });
    return () => controller.abort();
  }, [id, explicit]);
  if (explicit) return <StudyConversation key={id} sessionId={id} />;
  if (detected?.id !== id) return <LoadingStatus stage="synchronizing" detail="Memuat percakapan" />;
  return detected.study ? <StudyConversation key={id} sessionId={id} initialMessages={detected.messages} initialTitle={detected.title} /> : <ChatPage />;
}
