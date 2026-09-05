/**
 * Konfigurasi AI terpusat — multi-provider (semuanya OpenAI-compatible).
 *
 * ATURAN ROUTING (juan-router-provider-split, 2026-09-04):
 * - SEMUA generate TEKS (chat, catatan, kuis, judul, prompt gambar,
 *   enrichment) → Juan Router utama, fallback darurat OpenRouter.
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
 * - JUANROUTER_MODEL        (default gemini-3.7-flash-low)
 * - OPENROUTER_API_KEY      (key openrouter.ai, awalan sk-or-…; fallback darurat teks)
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
 * - "fast"   → Kilat: glm-5.3-flash, gemini-3.8-flash-high, gemini-3.7-flash-low, nemotron-3.5-lightning
 * - "normal" → Seimbang: gpt-5.6-luna, minimax-m3, hy-4-preview, grok-4.5-high
 * - "deep"   → Mendalam: gpt-5.6-sol, gpt-5.6-terra, claude-opus-5, qwen3.8-max, grok-4.6-xhigh
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
import {
  MODEL_CATALOG,
  MODEL_CATALOG_IDS,
  SPEED_MODEL_LISTS,
  SPEED_MODEL_LISTS_PRO,
  type AiSpeedMode,
} from "./modelCatalog";
import { getAiPremiumContext } from "./aiContext";

/**
 * Model yang mengembalikan reasoning/thinking — disaring saat user mematikan
 * toggle reasoning (dan saat menyusun rantai fallback model terpilih).
 */
const THINKING_SET = new Set([
  "deepseek-v4-pro",
  "deepseek-v4-pro-0813",
  "qwen3.8-max",
  "grok-4.6",
  "claude-opus-5",
  "muse-spark-1.2",
]);

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
  process.env.JUANROUTER_BASE_URL ?? "https://router.juan.web.id/v1";

export const JUANROUTER_API_KEY = process.env.JUANROUTER_API_KEY ?? "";

export const JUANROUTER_MODEL =
  process.env.JUANROUTER_MODEL ?? "gemini-3.7-flash-low";

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

/** Peringatan sekali saat AI_FORCE_MODELS diisi tapi diabaikan untuk teks. */
let forceModelsWarned = false;
function warnOnceForceModelsIgnored() {
  if (forceModelsWarned) return;
  forceModelsWarned = true;
  console.warn(
    "[AI] AI_FORCE_MODELS diisi tapi DINONAKTIFKAN untuk teks (juan-router-provider-split): semua teks lewat Juan Router, OpenAgentic hanya text-to-image."
  );
}

/**
 * Rantai model yang dicoba berurutan sesuai mode kecepatan.
 * Setiap model di daftar menjadi satu entri terpisah → saat satu model error,
 * loop provider otomatis mencoba model berikutnya (fallback antar model),
 * lalu ke provider fallback (mis. OpenRouter bila key tersedia).
 *
 * Diekspor untuk diagnostik/probe (scripts/) — jangan dipakai untuk request
 * langsung; gunakan aiChat/aiChatStream.
 */
export function getProviderChain(speedMode: AiSpeedMode = "normal", _forChat: boolean = false, reasoning: boolean = true, preferredModel?: string, premiumOverride?: boolean): ProviderConfig[] {
  const chain: ProviderConfig[] = [];

  const pushProvider = (
    baseURL: string,
    apiKey: string,
    name: string,
    models: string[]
  ) => {
    for (const model of models) {
      chain.push({ baseURL, apiKey, name, model, defaultModel: model });
    }
  };

  // ── Override via env AI_FORCE_MODELS: DINONAKTIFKAN untuk teks ───────
  // (juan-router-provider-split, 2026-09-04) Semua generate teks kini WAJIB
  // lewat Juan Router; OpenAgentic dikhususkan text-to-image (lib/image-gen.ts).
  // Env & variabel dipertahankan agar mudah dikembalikan — cukup aktifkan lagi
  // pushProvider di bawah ini bila aturan split dicabut.
  const forcedModels = (process.env.AI_FORCE_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (forcedModels.length > 0) {
    warnOnceForceModelsIgnored();
  }

  // Mode unified 9Router: hanya 9Router yang aktif, semua provider lain dinonaktifkan (tidak dihapus)
  // Kecepatan dipetakan ke model spesifik via 9Router untuk latensi optimal (bench: fast 5.7s < deep 8.1s < relay-combo 12s)
  if (AI_PROVIDER === "9router") {
    if (!NINE_ROUTER_API_KEY) return chain;
    const speedModel: Record<AiSpeedMode, string> = {
      fast: "jr/gemini-3.5-flash-lite",
      normal: "jr/deepseek-v4-flash",
      deep: "jr/gemini-3.7-flash-high",
    };
    const m = speedModel[speedMode] ?? NINE_ROUTER_MODEL;
    pushProvider(NINE_ROUTER_BASE_URL, NINE_ROUTER_API_KEY, "9Router", [m]);
    return chain;
  }

  const juanKey = JUANROUTER_API_KEY;
  const openRouterKey = OPENROUTER_API_KEY;

  // SEMUA generate teks (chat, catatan, kuis, judul, prompt gambar,
  // enrichment) → Juan Router utama + OpenRouter fallback darurat
  // (juan-router-provider-split). OpenAgentic TIDAK pernah masuk rantai
  // teks — hanya untuk text-to-image di lib/image-gen.ts.
  // Parameter _forChat dipertahankan demi kompatibilitas pemanggil, tapi
  // tidak lagi membedakan provider.
  if (!juanKey) {
    console.warn(
      "[AI] JUANROUTER_API_KEY tidak diisi — konfigurasi AI teks belum lengkap; rantai hanya berisi OpenRouter darurat."
    );
  }
  // Rantai model mengikuti status premium (konteks AsyncLocalStorage dari
  // titik masuk request): Pro → semua model (pintar di depan per tier);
  // free → hanya model murah. Tier deep untuk free berisi model murah
  // terbaik yang tersedia (semua model pintar deep = premiumOnly) →
  // fallback ke daftar normal-tier free bila kosong.
  const premium = premiumOverride ?? getAiPremiumContext() === true;
  const lists = premium ? SPEED_MODEL_LISTS_PRO : SPEED_MODEL_LISTS;
  let tierModels = lists[speedMode];
  if (tierModels.length === 0) tierModels = lists.normal;
  // Jika reasoning OFF, pakai model tanpa thinking di semua tier.
  // (Probe live 2026-09-05: model baru di katalog TIDAK mengembalikan
  // reasoning_content — hanya qwen3.8-max & claude-opus-5 yang thinking.)
  if (reasoning === false) {
    tierModels = tierModels.filter((m) => !THINKING_SET.has(m));
    if (tierModels.length === 0) {
      tierModels = ["gemini-3.7-flash-low", "gemini-3.5-flash-lite"];
    }
  }
  // Model spesifik pilihan user (Model Store) → percobaan PERTAMA, disusul
  // sisa daftar TIER MILIK MODEL ITU (bukan tier mode kecepatan aktif —
  // mis. pilih Claude Opus 5 lalu gagal → fallback ke model Mendalam lain,
  // bukan ke model Kilat). Id di luar katalog diabaikan (aman untuk klien
  // lama / request asing); model premiumOnly tak bisa dipakai free (route
  // sudah menolak 402 — di sini disaring lagi sebagai pertahanan lapis dua).
  const preferredEntry =
    preferredModel && MODEL_CATALOG_IDS.has(preferredModel)
      ? MODEL_CATALOG.find((m) => m.id === preferredModel)
      : undefined;
  const preferred = preferredEntry && (!preferredEntry.premiumOnly || premium) ? preferredEntry.id : "";
  if (preferred) {
    const preferredTier = preferredEntry?.tier ?? speedMode;
    const tierList = lists[preferredTier];
    const filtered = reasoning === false ? tierList.filter((m) => !THINKING_SET.has(m)) : tierList;
    tierModels = [preferred, ...filtered.filter((m) => m !== preferred)];
    if (tierModels.length === 0) {
      tierModels = [preferred];
    }
  }
  if (juanKey) {
    pushProvider(JUANROUTER_BASE_URL, juanKey, "JuanRouter", tierModels);
  }
  // Fallback darurat: OpenRouter free models — hanya dicapai bila SEMUA
  // model Juan gagal (429/503/timeout). Bukan pengganti Juan saat key kosong.
  if (openRouterKey) {
    pushProvider(OPENROUTER_BASE_URL, openRouterKey, "OpenRouter", [...OPENROUTER_FREE_MODELS]);
  }
  return chain;
}

/** Config {baseURL, apiKey} provider terpilih untuk SDK openai (embedding/transkripsi). */
export function getAiApiConfig(): { baseURL: string; apiKey: string } | null {
  const cfg = getProviderConfig();
  return cfg ? { baseURL: cfg.baseURL, apiKey: cfg.apiKey } : null;
}

export interface AiChatOptions {
  system?: string;
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
        choices?: { delta?: { content?: unknown }; message?: { content?: unknown } }[];
      };
      const delta = parsed?.choices?.[0]?.delta?.content;
      const message = parsed?.choices?.[0]?.message?.content;
      const part = typeof delta === "string" ? delta : typeof message === "string" ? message : "";
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
 * - Retry otomatis untuk error transien (429, 5xx, timeout/putus jaringan);
 * - Fallback darurat ke OpenRouter bila seluruh Juan Router gagal;
 * - Mendukung mode JSON (response_format), dengan retry tanpa response_format
 *   bila provider tidak mendukungnya.
 */
export async function aiChat(options: AiChatOptions): Promise<string> {
  const providers = getProviderChain(options.speedMode ?? "normal", !!options.forChat, options.reasoning ?? true, options.model, options.premium);
  
  console.log('[AI] aiChat called with options:', {
    hasSystem: !!options.system,
    userLength: options.user?.length || 0,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  });
  console.log('[AI] Provider chain length:', providers.length);
  
  if (providers.length === 0) {
    console.error('[AI Error] No providers available in chain');
    throw noTextProviderError();
  }

  const body: Record<string, unknown> = {
    stream: false,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    messages: [
      ...(options.system ? [{ role: "system", content: options.system }] : []),
      {
        role: "user",
        content: options.visionImage
          ? [
              { type: "text", text: options.user },
              {
                type: "image_url",
                image_url: { url: options.visionImage.dataUrl },
              },
            ]
          : options.user,
      },
    ],
  };

  const doRequest = async (provider: ProviderConfig): Promise<string> => {
    body.model = provider.model;
    console.log('[AI] Making request to:', provider.name, provider.baseURL);
    console.log('[AI] Using model:', provider.model);

    // Bila model mode (fast/deep) tidak dikenal provider (400/404), jatuh
    // ke model default — sekali coba ulang, lalu lanjut seperti biasa.
    let triedFallback = false;
    for (let round = 0; round < 2; round++) {
      const res = await fetch(`${provider.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
          ...(provider.name === "OpenRouter"
            ? { "X-Title": "Eureka.AI", "HTTP-Referer": "https://eureka-ai.app" }
            : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      console.log('[AI] Response status:', res.status, res.statusText);

      if (
        !res.ok &&
        (res.status === 400 || res.status === 404) &&
        provider.model !== provider.defaultModel &&
        !triedFallback
      ) {
        triedFallback = true;
        console.warn(
          `[AI] Model ${provider.model} ditolak ${provider.name} → pakai default ${provider.defaultModel}`
        );
        body.model = provider.defaultModel;
        continue;
      }

      if (!res.ok) {
        codesSeen.add(res.status);
        let detail = "";
        try {
          const errText = await res.text();
          const err = extractJsonObject(errText) as {
            error?: { message?: string };
          };
          detail = err?.error?.message ?? "";
          console.error('[AI Error] API error details:', err);
        } catch {
          // abaikan
        }
        throw new Error(
          `${provider.name} API error ${res.status}${detail ? `: ${detail}` : ""}`
        );
      }

      // Sebagian gateway (mis. OpenAgentic) menambahkan sisa SSE seperti
      // "data: [DONE]" setelah body JSON → parse manual agar tidak gagal.
      // Beberapa gateway lain (mis. Juan Router) memaksa format SSE walau
      // diminta stream:false → parse baris `data:` dan gabungkan tokennya.
      const resText = await res.text();
      let content = extractContentFromResponse(resText);

      // Model tertentu (deepseek-v4-pro, kimi-k2.7, MiniMax, qwen3.8-max di
      // Juan Router) TIDAK mengembalikan konten saat stream:false — hanya
      // chunk usage + [DONE]. Bila respons berformat SSE tapi kosong, retry
      // sekali dengan stream:true lalu gabungkan delta.content.
      if ((!content || !content.trim()) && resText.includes("data:")) {
        console.warn(
          `[AI] ${provider.model} kosong saat stream:false → retry stream:true`
        );
        try {
          const streamBody = { ...body, stream: true };
          const sres = await fetch(`${provider.baseURL}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              "Content-Type": "application/json",
              ...(provider.name === "OpenRouter"
                ? { "X-Title": "Eureka.AI", "HTTP-Referer": "https://eureka-ai.app" }
                : {}),
            },
            body: JSON.stringify(streamBody),
            signal: AbortSignal.timeout(60_000),
          });
          if (sres.ok) {
            const streamText = await sres.text();
            content = extractContentFromResponse(streamText);
          }
        } catch (e) {
          console.warn(`[AI] Retry stream ${provider.model} gagal:`, e);
        }
      }

      if (typeof content !== "string" || content.trim().length === 0) {
        console.error('[AI Error] Empty response from API');
        throw new Error("AI mengembalikan respons kosong.");
      }
      console.log('[AI] Response received, length:', content.length);
      return content;
    }
    throw new Error(`${provider.name}: gagal memproses respons.`);
  };

  const isRetryable = (e: unknown): boolean => {
    if (e instanceof Error) {
      if (e.name === "TimeoutError" || e.name === "AbortError") return true;
      if (/fetch failed|terminated|ECONNRESET|UndiciError/i.test(e.message))
        return true;
      const m = e.message.match(/API error (\d{3})/);
      // 429 (kuota/rate limit) TIDAK di-retry: biasanya kuota harian habis
      // dengan retry_after panjang — menunggu hanya membuang waktu user.
      if (m) return ["500", "502", "503", "504"].includes(m[1]);
    }
    return false;
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Coba tiap provider secara berurutan: utama dulu, lalu fallback (OpenRouter).
  // Error transien (502/saturasi) ditangani retry di dalam loop attempt.
  const attemptsPerProvider = 4;
  const tried: string[] = [];
  // Kode HTTP yang pernah gagal — dipakai untuk pesan error "server sibuk".
  const codesSeen = new Set<number>();
  // Provider pertama yang dicoba — penanda "fallback darurat" saat panggilan
  // akhirnya dilayani provider lain (mis. Juan → OpenRouter).
  const firstProviderName = providers[0]?.name ?? "";
  for (const provider of providers) {
    tried.push(`${provider.name}/${provider.model}`);
    const darurat = provider.name !== firstProviderName;
    let useJsonFormat = Boolean(options.json);
    for (let attempt = 1; attempt <= attemptsPerProvider; attempt++) {
      if (useJsonFormat) body.response_format = { type: "json_object" };
      else delete body.response_format;

      try {
        const content = await doRequest(provider);
        console.log(
          `[AI] Rute akhir: ${provider.name}/${provider.model}${darurat ? " (FALLBACK DARURAT dari " + firstProviderName + ")" : ""}`
        );
        return content;
      } catch (e) {
        const retryable = isRetryable(e);
        if (retryable && attempt < attemptsPerProvider) {
          // 5xx/timeout → upstream sibuk: tunggu sebentar lalu ulangi
          await sleep(2_000);
          continue;
        }
        // Gagal (error apa pun, termasuk 401/403 key invalid): coba sekali
        // tanpa response_format (bila mode JSON), lalu pindah ke provider lain.
        if (Boolean(options.json) && useJsonFormat) {
          useJsonFormat = false;
          try {
            const content = await doRequest(provider);
            console.log(
              `[AI] Rute akhir: ${provider.name}/${provider.model}${darurat ? " (FALLBACK DARURAT dari " + firstProviderName + ")" : ""}`
            );
            return content;
          } catch {
            // jatuh ke provider berikutnya
          }
        }
        break;
      }
    }
  }
  // Provider sibuk/kuota habis (429/5xx) → error khusus agar diproses
  // sebagai "server sedang sibuk" di UI, bukan fallback subtitle mentah.
  const busyCodes = [...new Set(codesSeen)].filter(
    (c) => c === 429 || (c >= 500 && c <= 599)
  );
  if (busyCodes.length > 0) {
    throw new AiBusyError(busyCodes);
  }
  throw new Error(
    `Semua provider AI gagal (${tried.join(" → ")}). Coba lagi nanti.`
  );
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
 * - Memakai rantai provider yang sama dengan aiChat (Juan Router → OpenRouter darurat).
 * - Bila stream terputus SEBELUM token pertama dikirim (fetch error / 5xx),
 *   coba ulang ke attempt/provider berikutnya. Bila gugur SETELAH token
 *   mulai mengalir, lemparkan error (token parsial dibuang) agar UI menampilkan
 *   kartu error yang jelas.
 */
export async function aiChatStream(
  options: AiChatStreamOptions,
  onEvent?: (event: AiStreamEvent) => void
): Promise<{ provider: string; model: string; content: string }> {
  const emit = (e: AiStreamEvent) => {
    if (onEvent) onEvent(e);
    else if (options.onEvent) options.onEvent(e);
  };

  const providers = getProviderChain(options.speedMode ?? "normal", !!options.forChat, options.reasoning ?? true, options.model, options.premium);
  if (providers.length === 0) {
    throw noTextProviderError();
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // 2 percobaan per provider (bukan 3) + timeout 45 detik (bukan 120) agar
  // user TIDAK menunggu lama saat model down — cepat pindah ke provider
  // berikutnya / menyerah dengan pesan error yang jelas.
  const attemptsPerProvider = 2;

  const isRetryable = (e: unknown): boolean => {
    if (e instanceof Error) {
      if (e.name === "TimeoutError" || e.name === "AbortError") return true;
      if (/fetch failed|terminated|ECONNRESET|UndiciError/i.test(e.message))
        return true;
      const m = e.message.match(/API error (\d{3})/);
      // 429 = kuota/rate limit → jangan retry, langsung pindah provider
      if (m) return ["500", "502", "503", "504"].includes(m[1]);
    }
    return false;
  };

  // Lacak apakah token sudah sempat mengalir — penting untuk fallback vision
  // yang aman (jangan ulang bila jawaban parsial sudah tampil di UI).
  let emittedAnyToken = false;
  const chainEmit = (e: AiStreamEvent) => {
    if (e.type === "token") emittedAnyToken = true;
    emit(e);
  };

  /** Isi pesan user: teks polos, atau array teks+gambar (vision). */
  const buildUserContent = (withVision: boolean): unknown => {
    if (withVision && options.visionImage) {
      return [
        { type: "text", text: options.user },
        { type: "image_url", image_url: { url: options.visionImage.dataUrl } },
      ];
    }
    if (options.visionImage && !withVision) {
      return `${options.user}\n\n[User melampirkan gambar: ${options.visionImage.filename}. Model ini tidak bisa membaca gambar — jawab tanpa gambar, atau minta user menjelaskan isinya.]`;
    }
    return options.user;
  };

  /** Coba seluruh rantai provider (Juan Router → OpenRouter darurat) dengan satu mode konten. */
  const runChain = async (
    withVision: boolean
  ): Promise<{ provider: string; model: string; content: string }> => {
    const body: Record<string, unknown> = {
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      // Aktifkan thinking hanya jika reasoning true (default true, OFF pakai model non-thinking)
      ...(options.reasoning === false ? {} : options.speedMode === "fast" ? { reasoning: { effort: "low" }, reasoning_effort: "low" } : {}),
      messages: [
        ...(options.system ? [{ role: "system", content: options.system }] : []),
        ...(options.history ?? []),
        { role: "user", content: buildUserContent(withVision) },
      ],
    };

    const doStream = async (
      provider: ProviderConfig
    ): Promise<{ provider: string; model: string; content: string }> => {
      body.model = provider.model;

      // Bila model mode (fast/deep) tidak dikenal provider (400/404), jatuh
      // ke model default — sekali coba ulang sebelum pindah provider.
      for (let round = 0; round < 2; round++) {
        let res: Response;
        try {
          res = await fetch(`${provider.baseURL}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              "Content-Type": "application/json",
              ...(provider.name === "OpenRouter"
                ? { "X-Title": "Eureka.AI", "HTTP-Referer": "https://eureka-ai.app" }
                : {}),
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(45_000),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "fetch gagal";
          throw new Error(`[aiChatStream] ${provider.name}: ${msg}`);
        }

        if (
          !res.ok &&
          (res.status === 400 || res.status === 404) &&
          provider.model !== provider.defaultModel &&
          round === 0
        ) {
          console.warn(
            `[aiChatStream] Model ${provider.model} ditolak ${provider.name} → pakai default ${provider.defaultModel}`
          );
          body.model = provider.defaultModel;
          continue;
        }

        if (!res.ok) {
          let detail = "";
          try {
            const errText = await res.text();
            const err = extractJsonObject(errText) as {
              error?: { message?: string };
            };
            detail = err?.error?.message ?? "";
          } catch {
            // abaikan — body bukan JSON
          }
          throw new Error(
            `${provider.name} API error ${res.status}${detail ? `: ${detail}` : ""}`
          );
        }

        if (!res.body) {
          throw new Error(`${provider.name}: respon tanpa body streaming.`);
        }

        chainEmit({ type: "meta", provider: provider.name, model: provider.model });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const tokens: string[] = [];
      let buffer = "";
      let emitted = false;

      const handleLine = (line: string): boolean => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) return false;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") return false;
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          return false;
        }
        const choice = Array.isArray(parsed.choices)
          ? (parsed.choices[0] as Record<string, unknown> | undefined)
          : undefined;
        const delta = choice?.delta as Record<string, unknown> | undefined;
        // Real thinking/reasoning dari model (DeepSeek, Claude, dll.) — kirim sebagai thinking event, bukan token jawaban
        const thinking =
          (delta?.reasoning_content as string | undefined) ??
          (delta?.reasoning as string | undefined) ??
          (choice?.message as Record<string, unknown> | undefined)?.reasoning_content;
        if (typeof thinking === "string" && thinking.length > 0) {
          chainEmit({ type: "thinking", text: thinking });
          return true;
        }
        const text = delta?.content;
        if (typeof text === "string" && text.length > 0) {
          emitted = true;
          tokens.push(text);
          chainEmit({ type: "token", text });
        }
        return true;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          try {
            handleLine(line);
          } catch {
            // Line malformed — abaikan
          }
        }
      }

        if (emitted) {
          return {
            provider: provider.name,
            model: provider.model,
            content: tokens.join(""),
          };
        }
        throw new Error(`${provider.name}: stream berakhir tanpa token.`);
      }
      // Tidak akan tercapai — setiap iterasi mengembalikan hasil atau melempar.
      throw new Error(`${provider.name}: stream berakhir tanpa hasil.`);
    };

    const tried: string[] = [];
    const firstProviderName = providers[0]?.name ?? "";
    for (const provider of providers) {
      tried.push(`${provider.name}/${provider.model}`);
      for (let attempt = 1; attempt <= attemptsPerProvider; attempt++) {
        try {
          const result = await doStream(provider);
          console.log(
            "[aiChatStream] selesai:",
            provider.name,
            "tokens:",
            result.content.length,
            provider.name !== firstProviderName
              ? `(FALLBACK DARURAT dari ${firstProviderName})`
              : ""
          );
          return result;
        } catch (e) {
          console.warn(
            `[aiChatStream] ${provider.name} attempt ${attempt} gagal:`,
            e instanceof Error ? e.message : e
          );
          if (attempt >= attemptsPerProvider) break;
          if (isRetryable(e)) {
            await sleep(1_500);
            continue;
          }
          break;
        }
      }
    }
    throw new Error(
      `Semua provider AI gagal streaming (${tried.join(" → ")}). Coba lagi nanti.`
    );
  };

  const errMsg = (e: unknown): string =>
    e instanceof Error ? e.message : "Terjadi kesalahan.";

  // 1) Ada gambar → coba vision dulu. Bila SEMUA provider menolak gambar
  //    (dan belum ada token yang mengalir), fallback otomatis ke teks saja.
  if (options.visionImage) {
    try {
      return await runChain(true);
    } catch (firstErr) {
      if (emittedAnyToken) {
        // Jawaban parsial sudah tampil — jangan ulang (hindari duplikat).
        emit({ type: "error", message: errMsg(firstErr) });
        throw firstErr;
      }
      try {
        return await runChain(false);
      } catch (secondErr) {
        const msg = `${errMsg(secondErr)} (termasuk mencoba membaca gambar).`;
        emit({ type: "error", message: msg });
        throw secondErr;
      }
    }
  }

  // 2) Tanpa gambar — alur biasa.
  try {
    return await runChain(false);
  } catch (e) {
    emit({ type: "error", message: errMsg(e) });
    throw e;
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
