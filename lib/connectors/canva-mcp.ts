import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { readSseData } from "../assistant/sse";
import type { ConnectorCall } from "./events";
import { accessToken, seal, unseal } from "./server";

const endpoint = "https://api.canva.com/connect/v1/mcp";
const canvaLink = z.string().max(8192).url().refine(value => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && ["www.canva.com", "canva.com"].includes(url.hostname)
    && !url.username && !url.password;
});
const pollState = z.object({
  id: z.string().min(1).max(512),
  token: z.string().min(1).max(16000),
  pollAfter: z.number(),
  title: z.string().max(160),
});
type SavedCanvaJob = { sessionId: string; state: string };
type Progress = (label: string, update: string) => void;
type JobResult = {
  job: { status: "success" | "in_progress" | "failed" };
  actionLabel: string;
  message: string;
  design?: { id: string; title: string; urls: { edit_url?: string; view_url?: string } };
  canvaResume?: SavedCanvaJob;
};

async function connectCanva(userId: string, signal: AbortSignal) {
  const token = await accessToken(userId, "canva", true);
  let protocolVersion = "2025-06-18";
  let sessionId: string | null = null;
  let sequence = 0;

  async function send(method: "initialize" | "notifications/initialized" | "tools/call", params?: unknown) {
    const notification = method === "notifications/initialized";
    const id = ++sequence;
    const response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        ...(method === "initialize" ? {} : { "MCP-Protocol-Version": protocolVersion }),
        ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", ...(!notification ? { id } : {}), method, params }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(25_000)]),
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error("Canva MCP belum memberi izin. Aktifkan Canva MCP pada aplikasi Eureka di Canva Developer Portal, lalu hubungkan ulang Canva.");
    }
    if (!response.ok) throw new Error(`Canva MCP menolak permintaan (${response.status}).`);
    if (method === "initialize") sessionId = response.headers.get("Mcp-Session-Id");
    if (notification) {
      await response.body?.cancel().catch(() => {});
      return;
    }
    if (response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
      for await (const event of readSseData(response.body)) {
        const reply = JSON.parse(event);
        if (reply.id !== id) continue;
        if (reply.error) throw new Error("Canva MCP belum bisa menjalankan aksi ini.");
        return reply.result;
      }
      throw new Error("Canva MCP tidak mengembalikan hasil.");
    }
    const reply = await response.json();
    if (reply.error || reply.id !== id) throw new Error("Canva MCP belum bisa menjalankan aksi ini.");
    return reply.result;
  }

  const init = await send("initialize", {
    protocolVersion, capabilities: {}, clientInfo: { name: "Eureka", version: "1.0.0" },
  });
  if (typeof init?.protocolVersion !== "string") throw new Error("Sesi Canva MCP belum bisa dimulai.");
  protocolVersion = init.protocolVersion;
  await send("notifications/initialized");
  return async (name: "create-design" | "get-create-design-async-job", args: Record<string, string>) => {
    const result = await send("tools/call", { name, arguments: args });
    if (result?.isError) throw new Error("Canva menolak pembuatan atau pemeriksaan desain. Periksa izin Canva.");
    if (result?.structuredContent) return result.structuredContent;
    const content = result?.content?.find((item: { type?: string }) => item.type === "text")?.text;
    if (typeof content !== "string") throw new Error("Hasil desain dari Canva belum tersedia.");
    return JSON.parse(content);
  };
}

export async function generateCanvaDesign(input: {
  userId: string; sessionId: string; brief: string; title: string; signal: AbortSignal;
  progress: Progress; savePending: (result: JobResult) => Promise<void>; resume?: SavedCanvaJob;
}): Promise<JobResult> {
  const { userId, sessionId, signal, progress, savePending, resume } = input;
  if (resume && resume.sessionId !== sessionId) throw new Error("Pekerjaan Canva berasal dari percakapan lain.");
  let state = resume ? pollState.parse(unseal(resume.state)) : undefined;
  const deadline = Date.now() + 65_000;
  const call = await connectCanva(userId, signal);
  let payload = state ? null : await call("create-design", { brief: input.brief });
  let pending: JobResult | undefined;

  while (true) {
    if (payload?.status === "completed") {
      const design = payload.design;
      const edit = canvaLink.safeParse(design?.edit_url);
      const view = canvaLink.safeParse(design?.url);
      const id = z.string().regex(/^[\w-]{1,100}$/).parse(design?.id);
      if (!edit.success && !view.success) throw new Error("Canva belum mengembalikan tautan desain yang bisa dibuka.");
      return {
        job: { status: "success" }, actionLabel: "Desain Canva siap",
        message: "Desain ini dibuat di Canva dan bisa dibuka melalui tautan yang tersedia.",
        design: { id, title: String(design.title || state?.title || input.title || "Desain Canva").slice(0, 160),
          urls: { edit_url: edit.success ? edit.data : undefined, view_url: view.success ? view.data : undefined } },
      };
    }
    if (payload?.status === "failed") return {
      job: { status: "failed" }, actionLabel: "Canva gagal membuat desain",
      message: "Canva melaporkan pekerjaan gagal. Desain yang bisa dibuka belum tersedia.",
    };
    if (payload) {
      if (!["pending", "in_progress", "polled_too_early"].includes(payload.status)) {
        throw new Error("Status pembuatan desain Canva tidak dikenali.");
      }
      const providedWait = Number(payload.polling_policy?.wait_seconds);
      const waitSeconds = Number.isFinite(providedWait) && providedWait > 0 ? Math.max(2, providedWait) : 15;
      state = pollState.parse({
        id: payload.job_id ?? state?.id,
        token: payload.continuation_token ?? state?.token,
        pollAfter: Date.now() + waitSeconds * 1000,
        title: state?.title ?? input.title.slice(0, 160),
      });
    }
    if (!state) throw new Error("Canva belum memberikan status pekerjaan.");
    pending = {
      job: { status: "in_progress" }, actionLabel: "Canva sedang membuat desain",
      message: "Pekerjaan Canva berjalan. Pengguna bisa mengecek statusnya dari tombol di chat.",
      canvaResume: { sessionId, state: seal(state) },
    };
    await savePending(pending);
    if (!resume && payload?.status === "pending") {
      progress("Canva sedang membuat desain…", "Canva sudah menerima brief dan sedang mengerjakan desainnya.");
    }
    if (state.pollAfter > deadline) return pending;
    try {
      await delay(Math.max(0, state.pollAfter - Date.now()), undefined, { signal });
      payload = await call("get-create-design-async-job", { job_id: state.id, continuation_token: state.token });
    } catch {
      // Canva already accepted the brief. A later check can resume this job.
      return pending;
    }
  }
}

export function canvaJobCheck(prompt: string, calls: ConnectorCall[]) {
  if (!/^\s*(?:tolong\s+)?(?:cek|periksa) status desain Canva[.!?]?\s*$/i.test(prompt)) return undefined;
  return calls.findLast(call => call.canvaJob)?.canvaJob;
}

export function wantsNewCanvaDesign(prompt: string) {
  return /^\s*(?:(?:tolong|bantu|mohon|bisakah|please|coba)\s+)*(?:(?:aku|saya)\s+(?:mau|ingin|minta)\s+)?(?:buat(?:kan)?|bikin|rancang|generate|create|desainkan)\b/i.test(prompt)
    && !/\b(template|autofill|salin(?:an)?|duplikat)\b|https?:\/\/(?:[^/]+\.)?canva\.com\/(?:d|design)\//i.test(prompt);
}
