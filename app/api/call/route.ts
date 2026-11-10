import { aiChatStream, hasAiKey } from "@/lib/ai";
import { captureServerEvent } from "@/lib/serverAnalytics";
import { runAfter } from "@/lib/after";
import { requireAuth } from "@/lib/assistant/auth";
import { AI_SAFETY_GUARDRAIL } from "@/lib/prompts/safety";
import { momoPersona } from "@/lib/prompts/momoPersona";
import { checkRateLimit, ensureRateLimitPrune } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VOICE_SYSTEM = `${momoPersona()}
Ini percakapan suara yang santai. Ikuti bahasa pengguna. Jawab langsung dalam 1–3 kalimat pendek
yang terdengar natural saat dibaca, tanpa Markdown, emoji, daftar, atau sapaan berulang.
Jika pengguna membetulkan ucapannya dan menyebut maksud baru, tanggapi maksud yang terbaru.
Jika pengguna bilang ucapannya salah tetapi belum menyebut maksudnya, tanyakan dengan singkat apa maksudnya.
Gunakan riwayat untuk memahami pertanyaan lanjutan dan koreksi.
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
    if (body.stream === true) {
      const controller = new AbortController();
      const signal = AbortSignal.any([request.signal, controller.signal, AbortSignal.timeout(30_000)]);
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(output) {
          let text = "";
          let spoken = 0;
          let cancelled = false;
          const send = (message: object) => {
            if (signal.aborted || cancelled) return;
            try { output.enqueue(encoder.encode(JSON.stringify(message) + "\n")); }
            catch { cancelled = true; controller.abort(); }
          };
          try {
            const result = await aiChatStream({
              system: `${VOICE_SYSTEM}\n\n${AI_SAFETY_GUARDRAIL}`,
              user: question, history: readHistory(body.history),
              maxTokens: 180, reasoning: false, speedMode: "fast", signal,
            }, event => {
              if (event.type !== "token") return;
              text += event.text;
              send({ type: "text", text: event.text });
              // At most two speech requests: start the first complete sentence
              // early, then synthesize the remainder while that sentence plays.
              const boundary = !spoken ? [...text.matchAll(/[.!?](?=\s)/g)].find(match => match.index >= 10) : undefined;
              if (!spoken && boundary) {
                spoken = boundary.index + 1;
                send({ type: "speech", text: text.slice(0, spoken).trim() });
              }
            });
            if (!text) { text = result.content; send({ type: "text", text }); }
            const rest = text.slice(spoken).trim();
            if (!text.trim()) throw new Error("Empty voice response");
            if (rest) send({ type: "speech", text: rest });
            send({ type: "done" });
            if (!signal.aborted) runAfter(async () => { await captureServerEvent(auth.userId, "momo_call_answered"); });
          } catch {
            send({ type: "error", error: "Momo belum bisa menyelesaikan jawaban. Coba lagi." });
          } finally {
            if (!cancelled) { try { output.close(); } catch { /* Caller disconnected. */ } }
          }
        },
        cancel() { controller.abort(); },
      });
      return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
    }
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
    if (reply) {
      runAfter(async () => { await captureServerEvent(auth.userId, "momo_call_answered"); });
      return Response.json({ ok: true, reply });
    }
  } catch {
    // Keep upstream errors out of the call UI.
  }
  return Response.json({ error: "Momo belum bisa menjawab. Coba lagi." }, { status: 502 });
}
