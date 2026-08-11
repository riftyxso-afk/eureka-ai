/**
 * Embedding text → vektor.
 * - Jika API key provider terpilih tersedia (AIMurah/OpenAI/OpenAgentic):
 *   coba API text-embedding-3-small (1536 dim).
 * - Jika gagal / tidak ada key: pakai model lokal
 *   @xenova/transformers multilingual-e5-small (384 dim).
 */
import { getAiApiConfig, isOpenAICompatible } from "@/lib/ai";

const LOCAL_MODEL = "Xenova/multilingual-e5-small";

interface EmbedResult {
  data: Float32Array;
  dims: number[];
}

type LocalExtractor = (texts: string[], opts: object) => Promise<EmbedResult>;

let extractorPromise: Promise<LocalExtractor> | null = null;

function getLocalExtractor(): Promise<LocalExtractor> {
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

  if (isOpenAICompatible()) {
    try {
      const cfg = getAiApiConfig();
      if (!cfg) throw new Error("Tidak ada konfigurasi AI.");
      const { OpenAI } = await import("openai");
      const client = new OpenAI({ baseURL: cfg.baseURL, apiKey: cfg.apiKey });
      const res = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: prefixed,
      });
      return res.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (e) {
      console.warn(
        "[embed] API embedding gagal, fallback ke model lokal:",
        e
      );
    }
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
