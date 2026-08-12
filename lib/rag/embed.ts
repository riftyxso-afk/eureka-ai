/**
 * Embedding text → vektor.
 * Priority:
 * 1. SumoPod AI (text-embedding-3-small, 1536 dim) jika key tersedia
 * 2. OpenAI-compatible gateway (bge-m3, bge-large) 
 * 3. Local model @xenova/transformers multilingual-e5-small (384 dim) - non-serverless only
 */
import { getAiApiConfig, isOpenAICompatible } from "@/lib/ai";

const LOCAL_MODEL = "Xenova/multilingual-e5-small";
const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;
const SUMOPOD_URL = "https://ai.sumopod.com/v1";
const SUMOPOD_MODEL = "text-embedding-3-small"; // 1536 dimensions

interface EmbedResult {
  data: Float32Array;
  dims: number[];
}

type LocalExtractor = (texts: string[], opts: object) => Promise<EmbedResult>;

let extractorPromise: Promise<LocalExtractor> | null = null;

function getLocalExtractor(): Promise<LocalExtractor> {
  if (isServerless) {
    throw new Error("Local embedding model not available in serverless environment");
  }
  
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");
      env.allowLocalModels = false;
      const p = await pipeline("feature-extraction", LOCAL_MODEL);
      return p as unknown as LocalExtractor;
    })();
  }
  return extractorPromise;
}

export type EmbedPrefix = "passage" | "query";

export async function embedTexts(
  texts: string[],
  prefix: EmbedPrefix = "passage"
): Promise<number[][]> {
  if (!texts.length) return [];
  const prefixed = texts.map((t) => `${prefix}: ${t}`);

  // Priority 1: SumoPod AI (1536 dim, matches VECTOR(1536))
  const sumoKey = process.env.SUMOPOD_API_KEY;
  if (sumoKey && sumoKey.startsWith("sk-")) {
    try {
      const { OpenAI } = await import("openai");
      const client = new OpenAI({ baseURL: SUMOPOD_URL, apiKey: sumoKey });
      const res = await client.embeddings.create({
        model: SUMOPOD_MODEL,
        input: prefixed,
      });
      return res.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (e) {
      console.error("[embed] SumoPod embedding failed:", e);
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.warn(`[embed] Falling back to next provider. Reason: ${msg}`);
    }
  }

  // Priority 2: OpenAI-compatible gateway
  if (isOpenAICompatible()) {
    try {
      const cfg = getAiApiConfig();
      if (!cfg) throw new Error("Tidak ada konfigurasi AI.");
      const { OpenAI } = await import("openai");
      const client = new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });
      const res = await client.embeddings.create({
        model: "bge-m3", // Model universal yang supported oleh banyak gateway
        input: prefixed,
      });
      return res.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (e) {
      console.error("[embed] API embedding failed:", e);
      const msg = e instanceof Error ? e.message : "Unknown error";
      
      // In serverless, we can't fallback to local model
      if (isServerless) {
        throw new Error(`Embedding API failed and local model not available in serverless environment (${msg})`);
      }
      
      console.warn(`[embed] Falling back to local model. Reason: ${msg}`);
    }
  }

  // Only try local model if not in serverless environment
  if (isServerless) {
    throw new Error("No AI API key configured and local model not available in serverless environment");
  }

  const extractor = await getLocalExtractor();
  const output = await extractor(prefixed, { pooling: "mean", normalize: true });
  const dim = output.dims[output.dims.length - 1];
  const flat = output.data;

  const vectors: number[][] = [];
  for (let i = 0; i < prefixed.length; i++) {
    vectors.push(Array.from(flat.slice(i * dim, (i + 1) * dim)));
  }
  return vectors;
}
