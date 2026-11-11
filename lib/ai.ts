/**
 * Konfigurasi AI terpusat — multi-provider (semuanya OpenAI-compatible).
 *
 * ATURAN ROUTING (juan-router-provider-split, 2026-09-04):
 * - SEMUA generate TEKS (chat, catatan, kuis, judul, prompt gambar,
 *   enrichment) → tiga model Flash melalui Juan Router.
 * - OpenAgentic → KHUSUS text-to-image (lihat lib/image-gen.ts), TIDAK
 *   pernah dipakai untuk teks.
 * - Embedding & transkripsi → belum tersedia di Juan Router; tetap jalur
 *   lama via getAiApiConfig()/getProviderConfig() (lihat design.md).
 *
 * Mode unified 9Router (env AI_PROVIDER=9router) menimpa rantai teks di atas.
 *
 * Auth: Authorization: Bearer <key>; endpoint: POST /chat/completions.
 *
 * Env:
 * - JUANROUTER_API_KEY      (WAJIB untuk semua teks; key router.juan.web.id, awalan sk-…)
 * - JUANROUTER_BASE_URL     (default https://router.juan.web.id/v1)
 * - JUANROUTER_MODEL        (dipertahankan untuk konfigurasi lama; teks memakai katalog)
 * - OPENROUTER_API_KEY      (provider lama untuk embedding/transkripsi bila dipilih)
 * - OPENROUTER_BASE_URL     (default https://openrouter.ai/api/v1)
 * - OPENROUTER_MODEL        (default z-ai/glm-5.2:free)
 * - OPENAGENTIC_API_KEY     (KHUSUS text-to-image; key openagentic.id, awalan sk-…)
 * - OPENAGENTIC_BASE_URL    (default https://openagentic.id/api/v1)
 * - OPENAGENTIC_MODEL       (default deepseek-v4-flash-free)
 * - AI_PROVIDER             (default "openagentic"; dipakai embedding/transkripsi & getAiApiConfig)
 * - AI_API_KEY              (AIMurah; fallback ke OPENAI_API_KEY)
 * - AI_BASE_URL             (base URL AIMurah, default https://aimurah.my.id/api/v1)
 * - AI_MODEL                (model AIMurah, default deepseek-v4-flash-free)
 * - OPENAI_API_KEY          (OpenAI resmi)
 * - NINE_ROUTER_API_KEY     (key 9router, awalan sk-…; unified gateway; mode 9router)
 * - NINE_ROUTER_BASE_URL    (default http://localhost:20128/v1)
 * - NINE_ROUTER_MODEL       (default relay-combo)
 */
export type AiProvider = "aimurah" | "openai" | "openagentic" | "openrouter" | "9router";

/**
 * Kecepatan jawaban AI yang bisa dipilih user di composer (/home & /chat):
 * - Kilat, Seimbang, Mendalam mengatur prioritas dan reasoning effort.
 * - Model gagal atau lambat dialihkan tanpa mengulang model yang sama.
 *
 * Daftar definitif & metadata (logo, peringkat, deskripsi) ada di
 * lib/modelCatalog.ts (modul data murni, aman diimpor komponen client).
 * Urutan = prioritas (di depan di tier). Bila satu model error (400/404/503),
 * otomatis coba berikutnya, lalu provider fallback — tidak memutus chat.
 */
export type { AiSpeedMode, ModelCatalogEntry } from "./modelCatalog";
export {
  MODEL_CATALOG,
  MODEL_CATALOG_IDS,
  SPEED_MODEL_LISTS,
  SPEED_MODEL_LISTS_PRO,
} from "./modelCatalog";
import { SPEED_MODEL_LISTS, type AiSpeedMode } from "./modelCatalog";


/** Model free untuk OpenAgentic & AIMurah (terverifikasi live dari /models OpenAgentic). */
export const OPENAGENTIC_FREE_MODELS = [
  "deepseek-v4-flash-free",
  "hy3-free",
  "qwen3.8-flash-free",
  "muse-spark-1.3-free",
] as const;
export const AIMURAH_FREE_MODELS = ["deepseek-v4-flash-free", "hy3-free"] as const;

/** Model free untuk OpenRouter — hanya yang :free sesuai instruksi (urut ON di depan, 429/timeout di belakang). */
export const OPENROUTER_FREE_MODELS = [
  "nvidia/nemotron-3.5-lightning:free",
  "liquid/lfm-2.5-2.6b:free",
  "z-ai/glm-5.2:free",
  "poolside/laguna-s-2.1:free",
  "thinkingmachines/inkling-small:free",
] as const;

export const SPEED_LABELS: Record<AiSpeedMode, string> = {
  fast: "Kilat",
  normal: "Seimbang",
  deep: "Mendalam",
};

export const AI_PROVIDER: AiProvider =
  (process.env.AI_PROVIDER as AiProvider) ?? "openagentic";

export const AI_BASE_URL =
  process.env.AI_BASE_URL ?? "https://aimurah.my.id/api/v1";

export const AI_MODEL = process.env.AI_MODEL ?? "deepseek-v4-flash-free";

export const AI_API_KEY =
  process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

export const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

export const OPENAGENTIC_BASE_URL =
  process.env.OPENAGENTIC_BASE_URL ?? "https://openagentic.id/api/v1";

export const OPENAGENTIC_API_KEY = process.env.OPENAGENTIC_API_KEY ?? "";

export const OPENAGENTIC_MODEL =
  process.env.OPENAGENTIC_MODEL ?? "deepseek-v4-flash-free";

export const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "z-ai/glm-5.2:free";

export const JUANROUTER_BASE_URL =
  process.env.JUANROUTER_BASE_URL ?? "https://api.juanrouter.com/v1";

export const JUANROUTER_API_KEY = process.env.JUANROUTER_API_KEY ?? "";

export const JUANROUTER_MODEL =
  process.env.JUANROUTER_MODEL ?? "deepseek-v4.1-flash";

export const NINE_ROUTER_BASE_URL =
  process.env.NINE_ROUTER_BASE_URL ?? "http://localhost:20128/v1";

export const NINE_ROUTER_API_KEY = process.env.NINE_ROUTER_API_KEY ?? "";

export const NINE_ROUTER_MODEL =
  process.env.NINE_ROUTER_MODEL ?? "relay-combo";

interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  /** Model asli dari env — dipakai sebagai fallback bila model mode gagal. */
  defaultModel: string;
  name: string;
}

function getProviderConfig(): ProviderConfig | null {
  if (AI_PROVIDER === "openagentic") {
    if (!OPENAGENTIC_API_KEY) {
      console.error('[AI Error] OPENAGENTIC_API_KEY is not set in environment variables');
      return null;
    }
    console.log('[AI] Using OpenAgentic provider');
    return {
      baseURL: OPENAGENTIC_BASE_URL,
      apiKey: OPENAGENTIC_API_KEY,
      model: OPENAGENTIC_MODEL,
      defaultModel: OPENAGENTIC_MODEL,
      name: "OpenAgentic",
    };
  }
  if (AI_PROVIDER === "openai") {
    if (!AI_API_KEY) {
      console.error('[AI Error] AI_API_KEY is not set for OpenAI provider');
      return null;
    }
    console.log('[AI] Using OpenAI provider');
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    return {
      baseURL: process.env.OPENAI_BASE_URL ?? OPENAI_BASE_URL,
      apiKey: AI_API_KEY,
      model,
      defaultModel: model,
      name: "OpenAI",
    };
  }
  if (AI_PROVIDER === "openrouter") {
    if (!OPENROUTER_API_KEY) {
      console.error(
        "[AI Error] OPENROUTER_API_KEY is not set for OpenRouter provider"
      );
      return null;
    }
    console.log("[AI] Using OpenRouter provider");
    return {
      baseURL: OPENROUTER_BASE_URL,
      apiKey: OPENROUTER_API_KEY,
      model: OPENROUTER_MODEL,
      defaultModel: OPENROUTER_MODEL,
      name: "OpenRouter",
    };
  }
  if (AI_PROVIDER === "9router") {
    if (!NINE_ROUTER_API_KEY) {
      console.error(
        "[AI Error] NINE_ROUTER_API_KEY is not set for 9Router provider"
      );
      return null;
    }
    console.log("[AI] Using 9Router provider");
    return {
      baseURL: NINE_ROUTER_BASE_URL,
      apiKey: NINE_ROUTER_API_KEY,
      model: NINE_ROUTER_MODEL,
      defaultModel: NINE_ROUTER_MODEL,
      name: "9Router",
    };
  }
  if (!AI_API_KEY) {
    console.error('[AI Error] AI_API_KEY is not set for AIMurah provider');
    return null;
  }
  console.log('[AI] Using AIMurah provider');
  return {
    baseURL: AI_BASE_URL,
    apiKey: AI_API_KEY,
    model: AI_MODEL,
    defaultModel: AI_MODEL,
    name: "AIMurah",
  };
}

export function hasAiKey(): boolean {
  // Rantai teks baru (juan-router-provider-split): terisi bila kunci Juan
  // Router ATAU OpenRouter tersedia (atau NINE_ROUTER_API_KEY di mode 9router).
  return getProviderChain("normal", true, true).length > 0;
}

/** Semua provider OpenAI-compatible → embedding & transkripsi tersedia bila ada key. */
export function isOpenAICompatible(): boolean {
  return hasAiKey();
}


/**
 * Rantai model yang dicoba berurutan sesuai mode kecepatan.
 * Setiap model di daftar menjadi satu entri terpisah → saat satu model error,
 * loop provider otomatis mencoba model berikutnya (fallback antar model),
 * dengan batas tunggu token pertama dan batas jeda selama streaming.
 *
 * Diekspor untuk diagnostik/probe (scripts/) — jangan dipakai untuk request
 * langsung; gunakan aiChat/aiChatStream.
 */
export function getProviderChain(speedMode: AiSpeedMode = "normal", _forChat = false, _reasoning = true, _preferredModel?: string, _premiumOverride?: boolean): ProviderConfig[] {
  void [_forChat, _reasoning, _preferredModel, _premiumOverride];
  // Effort determines priority; stale clients cannot pin an obsolete model.
  const models = SPEED_MODEL_LISTS[speedMode] ?? SPEED_MODEL_LISTS.normal;
  const gateway = AI_PROVIDER === "9router"
    ? { baseURL: NINE_ROUTER_BASE_URL, apiKey: NINE_ROUTER_API_KEY, name: "9Router" }
    : { baseURL: JUANROUTER_BASE_URL, apiKey: JUANROUTER_API_KEY, name: "JuanRouter" };
  if (!gateway.apiKey) return [];
  return models.map(id => {
    const model = AI_PROVIDER === "9router" ? "jr/" + id : id;
    return { ...gateway, model, defaultModel: model };
  });
}

/** Config {baseURL, apiKey} provider terpilih untuk SDK openai (embedding/transkripsi). */
export function getAiApiConfig(): { baseURL: string; apiKey: string } | null {
  const cfg = getProviderConfig();
  return cfg ? { baseURL: cfg.baseURL, apiKey: cfg.apiKey } : null;
}

export interface AiChatOptions {
  system?: string;
  signal?: AbortSignal;
  user: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Kecepatan jawaban (fast/normal/deep) — default "normal". */
  speedMode?: AiSpeedMode;
  /**
   * Gambar lampiran → dikirim sebagai image_url (vision) bila model
   * mendukungnya. Bila provider menolak gambar, dicoba ulang tanpa gambar.
   */
  visionImage?: { dataUrl: string; filename: string } | null;
  /** Riwayat label lama: dulu membedakan rantai chat vs catatan. Kini tidak mengubah provider (semua teks → Juan Router), dipertahankan untuk kompatibilitas pemanggil. */
  forChat?: boolean;
  reasoning?: boolean;
  /**
   * Model spesifik pilihan user (Model Store) — percobaan pertama di rantai,
   * fallback ke tier normal. Id di luar katalog diabaikan.
   */
  model?: string;
  /**
   * Status premium pemanggil — menentukan rantai model (Pro: semua model,
   * pintar di depan; free: hanya model murah). Default: baca konteks
   * AsyncLocalStorage (runWithPremium); false bila di luar bungkus.
   */
  premium?: boolean;
}

/** Ekstrak objek JSON dari teks AI (toleran terhadap ```markdown fence & trailing comma). */
export function extractJsonObject<T = Record<string, unknown>>(
  raw: string
): T {
  const clean = raw.replace(/```(?:json)?/gi, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Respons AI tidak mengandung objek JSON.");
  }
  const candidate = clean.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch (e) {
    // Model thinking kadang menambahkan koma berlebih → perbaiki lalu coba lagi
    const fixed = candidate.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(fixed) as T;
    } catch {
      throw e instanceof Error
        ? new Error(`Respons AI bukan JSON valid: ${e.message}`)
        : e;
    }
  }
}

/**
 * Ekstrak teks jawaban dari respons Chat Completions — baik JSON biasa,
 * JSON dengan sisa SSE, maupun respons SSE murni (beberapa gateway seperti
 * Juan Router memaksa format `data: {...}` walau diminta stream:false).
 * Mengembalikan string kosong bila tidak ada konten yang bisa dibaca.
 */
export function extractContentFromResponse(resText: string): string {
  // Kasus 1: JSON biasa (choices[0].message.content) — standar.
  try {
    const parsed = JSON.parse(resText) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const c = parsed?.choices?.[0]?.message?.content;
    if (typeof c === "string" && c.trim().length > 0) return c;
  } catch {
    // bukan JSON murni — lanjut ke kasus berikutnya
  }

  // Kasus 2: respons SSE (stream) — gabungkan choices[].delta.content.
  // Dipakai untuk gateway yang mengirim stream walau request non-stream.
  // Thinking models: abaikan reasoning_content, ambil content saja.
  const sseParts: string[] = [];
  let hasSse = false;
  for (const line of resText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") {
      if (payload) hasSse = true;
      continue;
    }
    try {
      const parsed = JSON.parse(payload) as {
        choices?: { delta?: { content?: unknown; reasoning_content?: unknown }; message?: { content?: unknown } }[];
      };
      const delta = parsed?.choices?.[0]?.delta;
      const message = parsed?.choices?.[0]?.message?.content;
      // Ambil content (bukan reasoning_content) — thinking models
      // mengirim reasoning_content di SSE tapi content tetap JSON yang diminta.
      const part = typeof delta?.content === "string" ? delta.content : typeof message === "string" ? message : "";
      if (part.length > 0) {
        sseParts.push(part);
        hasSse = true;
      }
    } catch {
      // baris SSE rusak — abaikan
    }
  }
  if (hasSse && sseParts.length > 0) {
    return sseParts.join("");
  }

  // Kasus 3: JSON mengambang di dalam teks (markdown/komentar model).
  try {
    const obj = extractJsonObject<{
      choices?: { message?: { content?: unknown } }[];
    }>(resText);
    const c = obj?.choices?.[0]?.message?.content;
    if (typeof c === "string" && c.trim().length > 0) return c;
  } catch {
    // tidak ada JSON valid
  }

  return "";
}

/**
 * Error khusus saat provider AI sibuk / kehabisan kuota (429/5xx).
 * Dipakai pemroses materi untuk menghentikan job dengan pesan jelas,
 * bukan diam-diam jatuh ke parsing manual (subtitle mentah).
 */
export class AiBusyError extends Error {
  codes: number[];
  constructor(codes: number[]) {
    super(
      `Server AI sedang sibuk (kode ${codes.join(", ")}). Coba lagi dalam beberapa menit.`
    );
    this.name = "AiBusyError";
    this.codes = codes;
  }
}

/** Apakah error berasal dari AI sibuk/kuota (429/5xx)? */
export function isAiBusyError(e: unknown): boolean {
  return e instanceof AiBusyError;
}

/** Pesan error saat rantai provider teks kosong — Juan Router wajib untuk teks. */
function noTextProviderError(): Error {
  return new Error(
    "Konfigurasi AI teks belum lengkap. Isi JUANROUTER_API_KEY di .env.local (router.juan.web.id) — semua generate teks memakai Juan Router."
  );
}

/**
 * Panggil Chat Completions (OpenAI-compatible) → kembalikan teks jawaban.
 * - Teks dikumpulkan dari streaming agar memiliki batas tunggu token pertama;
 * - Model yang gagal dialihkan ke model Flash berikutnya;
 * - Mendukung mode JSON (response_format), dengan retry tanpa response_format
 *   bila provider tidak mendukungnya.
 */
export async function aiChat(options: AiChatOptions): Promise<string> {
  // Buffered callers can safely restart even after a partial upstream response.
  const result = await aiChatStream({ ...options, onReset: () => {} });
  return result.content;
}

export interface AiStreamMeta {
  provider: string;
  model: string;
}

export type AiStreamEvent =
  | { type: "meta"; provider: string; model: string }
  | { type: "token"; text: string }
  | { type: "thinking"; text: string }
  | { type: "error"; message: string };

export interface AiChatStreamOptions extends AiChatOptions {
  /** Abort an interactive generation when its caller stops or leaves. */
  signal?: AbortSignal;
  /** Opt in only when the consumer can discard already emitted text. */
  onReset?: () => void;
  /** Riwayat percakapan sebelum pesan user saat ini (role user/assistant). */
  history?: { role: "user" | "assistant"; content: string }[];
  /** Panggil callback per kejadian (meta/token/error). */
  onEvent?: (event: AiStreamEvent) => void;
  /**
   * Gambar lampiran → dikirim sebagai image_url (vision) bila model
   * mendukungnya. Bila SEMUA provider menolak gambar, otomatis dicoba
   * ulang teks saja (dengan catatan kecil bahwa gambar tak terbaca).
   */
  visionImage?: { dataUrl: string; filename: string } | null;
}

/**
 * Chat Completions STREAMING (SSE) — dipakai chat asisten agar terasa
 * seperti ChatGPT/Claude.
 *
 * - Body `stream: true`, parse baris `data: {...}` → `choices[0].delta.content`.
 * - Memakai rantai tiga model Flash yang sama dengan aiChat.
 * - Bila stream terputus SEBELUM token pertama dikirim (fetch error / 5xx),
 *   coba ulang ke attempt/provider berikutnya. Bila gugur SETELAH token
 *   mulai mengalir, lemparkan error (token parsial dibuang) agar UI menampilkan
 *   kartu error yang jelas.
 */
export async function aiChatStream(
  options: AiChatStreamOptions,
  onEvent?: (event: AiStreamEvent) => void
): Promise<{ provider: string; model: string; content: string }> {
  const emit = onEvent ?? options.onEvent ?? (() => {});
  const publishesTokens = Boolean(onEvent ?? options.onEvent);
  const mode = options.speedMode ?? "normal";
  const providers = getProviderChain(mode);
  if (!providers.length) throw noTextProviderError();
  const effort = options.reasoning === false || mode === "fast" ? "low" : mode === "deep" ? "high" : "medium";
  const firstTokenMs = mode === "fast" ? 10_000 : mode === "deep" ? 22_000 : 14_000;
  const codes = new Set<number>();
  let exposed = false;
  let visionRejected = 0;

  const run = async (withVision: boolean) => {
    for (const provider of providers) {
      options.signal?.throwIfAborted();
      const abort = new AbortController();
      const signal = options.signal ? AbortSignal.any([options.signal, abort.signal]) : abort.signal;
      let deadline = setTimeout(() => abort.abort(new DOMException("Model belum mulai menjawab.", "TimeoutError")), firstTokenMs);
      const overall = setTimeout(() => abort.abort(new DOMException("Generasi melewati batas waktu.", "TimeoutError")), mode === "deep" ? 180_000 : 120_000);
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      const pieces: string[] = [];
      let began = false;
      let completed = false;
      let finishReason: string | null = null;
      const touch = () => {
        clearTimeout(deadline);
        deadline = setTimeout(() => abort.abort(new DOMException("Aliran jawaban terhenti.", "TimeoutError")), 15_000);
      };
      const token = (text: unknown) => {
        if (typeof text !== "string" || !text) return;
        // Whitespace and reasoning alone must not keep a stalled model alive.
        if (!began && !text.trim()) { pieces.push(text); return; }
        if (!began) { began = true; touch(); }
        else touch();
        pieces.push(text);
        exposed = publishesTokens;
        emit({ type: "token", text });
      };
      const body: Record<string, unknown> = {
        model: provider.model, stream: true,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 2048,
        reasoning_effort: effort,
        messages: [
          ...(options.system ? [{ role: "system", content: options.system }] : []),
          ...(options.history ?? []),
          { role: "user", content: withVision && options.visionImage
            ? [{ type: "text", text: options.user }, { type: "image_url", image_url: { url: options.visionImage.dataUrl } }]
            : options.visionImage ? `${options.user}\n[Gambar ${options.visionImage.filename} tidak dapat dibaca. Jangan menebak isinya; minta pengguna menjelaskan gambar.]` : options.user },
        ],
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      };
      try {
        emit({ type: "meta", provider: provider.name, model: provider.model });
        const request = () => fetch(`${provider.baseURL.replace(/\/$/, "")}/chat/completions`, {
          method: "POST", headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body), signal,
        });
        let response = await request();
        // Retry only explicit parameter incompatibility, within the same deadline.
        if (response.status === 400) {
          const detail = await response.text();
          if (/response_format|json_object|reasoning_effort/i.test(detail)) {
            if (/response_format|json_object/i.test(detail)) delete body.response_format;
            if (/reasoning_effort/i.test(detail)) delete body.reasoning_effort;
            response = await request();
          } else {
            if (withVision && /image|vision|multimodal/i.test(detail)) visionRejected++;
            throw new Error("AI API error 400");
          }
        }
        if (!response.ok) {
          codes.add(response.status);
          await response.body?.cancel();
          throw new Error(`AI API error ${response.status}`);
        }
        if (!response.body) throw new Error("AI mengembalikan respons kosong.");
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const isJson = response.headers.get("content-type")?.includes("application/json");
        const line = (raw: string) => {
          if (!raw.trim().startsWith("data:")) return;
          const data = raw.trim().slice(5).trim();
          if (data === "[DONE]") { completed = true; return; }
          if (!data) return;
          let chunk;
          try { chunk = JSON.parse(data); } catch { return; }
          if (chunk.error) throw new Error("Provider gagal menyelesaikan jawaban.");
          const choice = chunk.choices?.[0];
          const delta = choice?.delta ?? choice?.message;
          const thinking = delta?.reasoning_content ?? delta?.reasoning;
          if (typeof thinking === "string" && thinking) emit({ type: "thinking", text: thinking });
          token(delta?.content);
          if (choice?.finish_reason) { finishReason = choice.finish_reason; completed = true; }
        };
        while (!completed) {
          const { done, value } = await reader.read();
          if (done) { buffer += decoder.decode(); break; }
          buffer += decoder.decode(value, { stream: true });
          if (!isJson) {
            const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
            for (const entry of lines) line(entry);
          }
        }
        if (isJson) {
          const result = JSON.parse(buffer);
          if (result.error) throw new Error("Provider gagal menyelesaikan jawaban.");
          token(result.choices?.[0]?.message?.content);
          finishReason = result.choices?.[0]?.finish_reason ?? null;
          completed = true;
        } else if (buffer.trim()) line(buffer);
        if (!began || !pieces.join("").trim()) throw new Error("AI mengembalikan respons kosong.");
        if (!completed || finishReason === "content_filter" || finishReason === "tool_calls") throw new Error("Jawaban AI belum lengkap.");
        const content = pieces.join("");
        if (options.json) {
          if (finishReason === "length") throw new Error("JSON AI terpotong.");
          extractJsonObject(content);
        }
        return { provider: provider.name, model: provider.model, content };
      } catch (error) {
        options.signal?.throwIfAborted();
        if (exposed) {
          // Text/audio consumers cannot silently concatenate a second answer.
          if (!options.onReset) throw error;
          options.onReset(); exposed = false;
        }
        console.warn(`[AI] Beralih dari ${provider.model}:`, error instanceof Error ? error.message : "upstream gagal");
      } finally {
        clearTimeout(deadline); clearTimeout(overall);
        abort.abort();
        await reader?.cancel().catch(() => {});
        reader?.releaseLock();
      }
    }
    const busy = [...codes].filter(code => code === 429 || code >= 500);
    if (busy.length) throw new AiBusyError(busy);
    throw new Error("Model AI belum dapat menjawab. Silakan coba kembali.");
  };
  try {
    try { return await run(Boolean(options.visionImage)); }
    catch (error) {
      options.signal?.throwIfAborted();
      // Do not spend another full chain on rate limits or a slow vision request.
      if (!options.visionImage || exposed || visionRejected !== providers.length) throw error;
      return await run(false);
    }
  } catch (error) {
    emit({ type: "error", message: error instanceof Error ? error.message : "Generasi AI gagal." });
    throw error;
  }
}

/**
 * Panggil AI lalu parse JSON-nya. Jika output bukan JSON valid (model thinking
 * sering merusak JSON multi-baris, mis. nilai menyatu tanpa koma), coba sekali
 * lagi dengan instruksi STRICT: JSON satu baris, properti dipisah koma.
 */
export async function aiChatJson<T>(
  options: AiChatOptions,
  parse: (raw: string) => T
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const callOptions: AiChatOptions =
      attempt === 0
        ? options
        : {
            ...options,
            system: `${options.system ?? ""}\n\nPENTING: Output harus JSON VALID dalam SATU BARIS (tanpa baris baru di dalam objek/array). Setiap properti WAJIB dipisah tanda koma. Nilai string WAJIB diapit tanda kutip ganda. Jangan satukan dua nilai tanpa koma. Jangan tambahkan teks apa pun di luar JSON.`,
          };
    const raw = await aiChat(callOptions);
    try {
      return parse(raw);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Respons AI bukan JSON valid.");
}
