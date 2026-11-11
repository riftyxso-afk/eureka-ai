export const STUDY_CHAT_PENDING = "eureka:study-chat-pending";
export type StudyChatPending = { sessionId: string; prompt: string; noteId?: string };

export async function openStudyChat(prompt: string, noteId?: string) {
  const { apiFetch } = await import("@/lib/apiClient");
  const { getUserId } = await import("@/lib/identity");
  const response = await apiFetch("/api/assistant/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: getUserId() }),
  });
  const data = await response.json();
  if (!response.ok || typeof data.session?.id !== "string") throw new Error(data.error || "Percakapan belajar belum bisa dibuat.");
  const pending: StudyChatPending = { sessionId: data.session.id, prompt, noteId };
  sessionStorage.setItem(STUDY_CHAT_PENDING, JSON.stringify(pending));
  return "/dashboard-v2/tanya-momo/" + encodeURIComponent(data.session.id) + "?mode=study";
}
