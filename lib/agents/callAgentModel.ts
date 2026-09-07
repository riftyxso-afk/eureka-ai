/**
 * callAgentModel — satu-satunya pintu pemanggilan model dari semua agent.
 *
 * Men-resolve config dari lib/agents/catalog.ts lalu memanggil rantai
 * provider existing di lib/ai.ts (Juan Router → fallback) dengan override
 * model agent di depan. Tidak ada agent yang boleh memanggil provider
 * secara langsung.
 *
 * Setiap panggilan tercatat ke agent_call_logs (agent, model, durasi,
 * token in/out, user, iterasi) — reuse Supabase admin client existing.
 * Rate limit per agent diterapkan di sini (key agent:{id}:user:{userId}).
 */
import {
  aiChat,
  aiChatStream,
  type AiStreamEvent,
} from "../ai";
import {
  AGENT_CATALOG,
  resolveAgentModel,
  type AgentConfig,
  type AgentId,
} from "./catalog";
import { logAgentCall } from "./agentLog";
import { checkRateLimit, ensureRateLimitPrune } from "../rateLimit";

export interface AgentModelContext {
  /** User pemanggil (untuk rate limit & log); null untuk job background sistem. */
  userId?: string | null;
  /** Iterasi loop aktif (bila pemanggilan terjadi di dalam loop multi-agent). */
  iteration?: number | null;
  /** Id sesi loop (bila ada) untuk atribusi log. */
  loopSessionId?: string | null;
  /** Fitur pemicu (mis. "multi-agent-loop", "solve-then-guide") untuk log. */
  source?: string;
}

export interface AgentModelOverrides {
  /** Timpa suhu default persona (mis. assessment butuh lebih deterministik). */
  temperature?: number;
  /** Timpa batas token output. */
  maxTokens?: number;
  /** Timpa model agent (mis. Socra naik kelas ke Astra kondisional). */
  model?: string;
  /** Status premium pemanggil — memengaruhi rantai model (lib/ai.ts). */
  premium?: boolean;
  /** Mode reasoning (default ON). */
  reasoning?: boolean;
}

export interface AgentChatResult {
  text: string;
  model: string;
  durationMs: number;
}

/** Error saat rate limit agent tercapai — tangani dengan pesan ramah. */
export class AgentRateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(agentName: string, retryAfterMs: number) {
    super(
      `${agentName} sedang istirahat sebanyak. Coba lagi dalam ${Math.ceil(
        retryAfterMs / 60000
      )} menit ya.`
    );
    this.name = "AgentRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Resolusi config + model + cek rate limit. Melempar AgentRateLimitError. */
function prepare(
  agentId: AgentId,
  ctx: AgentModelContext | undefined
): AgentConfig {
  const cfg = AGENT_CATALOG[agentId];
  if (ctx?.userId) {
    ensureRateLimitPrune();
    const rl = checkRateLimit(
      `agent:${agentId}:user:${ctx.userId}`,
      cfg.rateLimit.max,
      cfg.rateLimit.windowMs
    );
    if (!rl.ok) throw new AgentRateLimitError(cfg.name, rl.retryAfterMs);
  }
  return cfg;
}

/**
 * Panggilan NON-streaming. Return teks final + metadata routing.
 * Melempar error bila seluruh rantai provider gagal — pemanggil (agent)
 * yang menentukan fallback UI, bukan layer ini.
 */
export async function callAgentModel(
  agentId: AgentId,
  prompt: { system?: string; user: string; json?: boolean },
  ctx?: AgentModelContext,
  overrides?: AgentModelOverrides
): Promise<AgentChatResult> {
  const cfg = prepare(agentId, ctx);
  // Override model (mis. Astra) > env > katalog.
  const model = overrides?.model ?? resolveAgentModel(agentId);

  const started = Date.now();
  try {
    const text = await aiChat({
      system: prompt.system,
      user: prompt.user,
      json: prompt.json,
      model: model ?? undefined,
      speedMode: cfg.tier,
      temperature: overrides?.temperature ?? cfg.temperature,
      maxTokens: overrides?.maxTokens ?? cfg.maxTokens,
      reasoning: overrides?.reasoning ?? true,
      premium: overrides?.premium,
    });
    const durationMs = Date.now() - started;
    void logAgentCall(agentId, {
      model: model ?? cfg.tier,
      durationMs,
      source: ctx?.source,
      userId: ctx?.userId ?? null,
      loopSessionId: ctx?.loopSessionId ?? null,
      iteration: ctx?.iteration ?? null,
      ok: true,
    });
    return { text, model: model ?? cfg.tier, durationMs };
  } catch (e) {
    void logAgentCall(agentId, {
      model: model ?? cfg.tier,
      durationMs: Date.now() - started,
      source: ctx?.source,
      userId: ctx?.userId ?? null,
      loopSessionId: ctx?.loopSessionId ?? null,
      iteration: ctx?.iteration ?? null,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export interface AgentStreamResult {
  /** Promise yang selesai saat stream selesai; resolve meta model terpakai. */
  done: Promise<{ model: string; durationMs: number }>;
}

/**
 * Panggilan STREAMING. Event token/thinking diteruskan ke onEvent pemanggil;
 * event meta dipakai internal untuk log. Error tetap dilempar ke pemanggil.
 */
export async function callAgentModelStream(
  agentId: AgentId,
  prompt: {
    system?: string;
    user: string;
    history?: { role: "user" | "assistant"; content: string }[];
  },
  onEvent: (event: AiStreamEvent) => void,
  ctx?: AgentModelContext,
  overrides?: AgentModelOverrides
): Promise<AgentStreamResult> {
  const cfg = prepare(agentId, ctx);
  // Override model (mis. Astra) > env > katalog.
  const model = overrides?.model ?? resolveAgentModel(agentId);

  const started = Date.now();
  let resolvedModel: string | null = null;

  const done = new Promise<{ model: string; durationMs: number }>(
    (resolve, reject) => {
      void aiChatStream(
        {
          system: prompt.system,
          user: prompt.user,
          history: prompt.history,
          model: model ?? undefined,
          speedMode: cfg.tier,
          temperature: overrides?.temperature ?? cfg.temperature,
          maxTokens: overrides?.maxTokens ?? cfg.maxTokens,
          reasoning: overrides?.reasoning ?? true,
          premium: overrides?.premium,
        },
        (event: AiStreamEvent) => {
          if (event.type === "meta") {
            // Model efektif tercatat lebih awal — dipakai log bila stream gugur.
            resolvedModel = event.model;
          }
          onEvent(event);
        }
      )
        .then((final) => {
          const durationMs = Date.now() - started;
          // final.model = model efektif rantai (bisa beda dari model utama
          // bila fallback aktif) — pakai itu untuk log yang akurat.
          void logAgentCall(agentId, {
            model: final.model ?? model ?? cfg.tier,
            durationMs,
            source: ctx?.source,
            userId: ctx?.userId ?? null,
            loopSessionId: ctx?.loopSessionId ?? null,
            iteration: ctx?.iteration ?? null,
            ok: true,
          });
          resolve({ model: final.model ?? model ?? cfg.tier, durationMs });
        })
        .catch((e) => {
          void logAgentCall(agentId, {
            model: resolvedModel ?? model ?? cfg.tier,
            durationMs: Date.now() - started,
            source: ctx?.source,
            userId: ctx?.userId ?? null,
            loopSessionId: ctx?.loopSessionId ?? null,
            iteration: ctx?.iteration ?? null,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          });
          reject(e);
        });
    }
  );

  return { done };
}
