export const STUDY_ROOM_TABS = ["learn", "notes", "mindmap", "quiz", "cards", "sources", "ask", "podcast", "scratch"] as const;
export type StudyRoomTab = typeof STUDY_ROOM_TABS[number];
export function studyRoomTab(value?: string): StudyRoomTab { return STUDY_ROOM_TABS.includes(value as StudyRoomTab) ? value as StudyRoomTab : "learn"; }

export async function readStudyEvents(response: Response, receive: (event: Record<string, unknown>) => void) {
  if (!response.body) throw new Error("Aliran hasil AI tidak tersedia.");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = "";
  try {
    while (true) {
      const { done, value } = await reader.read(); pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n"); pending = lines.pop() ?? "";
      if (done && pending.trim()) { lines.push(pending); pending = ""; }
      for (const line of lines) if (line.startsWith("data:")) {
        const data = line.slice(5).trim(); if (!data || data === "[DONE]") continue;
        const event = JSON.parse(data); if (event && typeof event === "object") receive(event);
      }
      if (done) break;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
