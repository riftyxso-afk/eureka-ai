import { apiFetch } from "@/lib/apiClient";
export const LEVEL_UP_EVENT = "eureka-level-up";

export function announceLevelUp(level: number): void {
  if (typeof window === "undefined" || !level) return;
  window.dispatchEvent(
    new CustomEvent(LEVEL_UP_EVENT, { detail: { level } })
  );
}

export async function postProgress(
  body: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  try {
    const res = await apiFetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as Record<string, unknown>;
    if (payload?.levelUp) {
      const stats = payload.stats as { level?: number } | undefined;
      announceLevelUp(stats?.level ?? 0);
    }
    return payload;
  } catch {
    return null;
  }
}
