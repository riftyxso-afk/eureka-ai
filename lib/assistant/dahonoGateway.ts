import { selectDahonoModels, type DahonoModel } from "./dahonoModels";

export const DAHONO_BASE_URL = "https://gateway.dahono.com/v1";

export function dahonoApiKey(): string {
  return process.env.DAHONO_API_KEY?.trim() || "";
}

let cache: { models: DahonoModel[]; expires: number } | undefined;
let pending: Promise<DahonoModel[]> | undefined;

export function getDahonoModels(): Promise<DahonoModel[]> {
  if (cache && cache.expires > Date.now()) return Promise.resolve(cache.models);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(`${DAHONO_BASE_URL}/models`, { signal: AbortSignal.timeout(3500), cache: "no-store" });
        if (!response.ok) throw new Error("Dahono catalog unavailable");
        const payload = await response.json();
        const models = selectDahonoModels(payload.data);
        cache = { models, expires: Date.now() + 300_000 };
        return models;
      } catch {
        cache = { models: [], expires: Date.now() + 15_000 };
        return [];
      } finally {
        pending = undefined;
      }
    })();
  }
  return pending;
}
