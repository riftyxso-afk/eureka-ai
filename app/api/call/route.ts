import { aiChatStream, hasAiKey } from "@/lib/ai";
import { requireAuth } from "@/lib/assistant/auth";
import { AI_SAFETY_GUARDRAIL } from "@/lib/prompts/safety";
import { momoPersona } from "@/lib/prompts/momoPersona";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICE_SYSTEM = `${momoPersona()}
Ini percakapan suara. Ikuti bahasa pengguna. Jawab langsung dalam 1–3 kalimat yang mudah didengar,
tanpa Markdown, emoji, atau daftar. Gunakan riwayat untuk memahami pertanyaan lanjutan.
Jika pengguna butuh bantuan belajar, beri contoh atau petunjuk singkat yang relevan.`;

type Turn = { role: "user" | "assistant"; content: string };

function readHistory(value: unknown): Turn[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap(turn => {
    if ((turn?.role !== "user" && turn?.role !== "assistant") || typeof turn.content !== "string") return [];
    const content = turn.content.trim().slice(0, 2000);
    return content ? [{ role: turn.role, content }] : [];
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const auth = await requireAuth(request.headers.get("authorization"), typeof body?.userId === "string" ? body.userId.trim() : undefined);
  if (!auth.userId) return Response.json({ error: auth.error }, { status: auth.status ?? 401 });

  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 2000) : "";
  if (!question) return Response.json({ error: "Pertanyaan kosong." }, { status: 400 });
  if (!hasAiKey()) return Response.json({ error: "Momo belum bisa menjawab saat ini." }, { status: 503 });

  ensureRateLimitPrune();
  if (!checkRateLimit(`call-reply:${auth.userId}`, 60, 3_600_000).ok) {
    return Response.json({ error: "Batas percakapan suara tercapai. Coba lagi nanti." }, { status: 429 });
  }
  try {
    const { content } = await aiChatStream({
      system: `${VOICE_SYSTEM}\n\n${AI_SAFETY_GUARDRAIL}`,
      user: question,
      history: readHistory(body.history),
      maxTokens: 240,
      reasoning: false,
      speedMode: "fast",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    });
    const reply = content.trim();
    if (reply) return Response.json({ ok: true, reply });
  } catch {
    // Keep upstream errors out of the call UI.
  }
  return Response.json({ error: "Momo belum bisa menjawab. Coba lagi." }, { status: 502 });
}
