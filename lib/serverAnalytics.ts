/** Server-only analytics. Only verified account IDs and numeric metrics are sent. */
export async function captureServerEvent(userId: string, event: "note_created" | "momo_call_answered", properties: Record<string, number> = {}) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!token || !userId) return;
  try {
    await fetch(new URL("/capture/", process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: token, event, properties: { distinct_id: userId, ...properties } }),
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* Analytics failures must not interrupt learning. */ }
}
