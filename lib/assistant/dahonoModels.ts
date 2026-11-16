export const DAHONO_LOGO = "/images/ai-models/dahono.svg";
export const FLAGSHIP_STARTING_CREDITS = 100;
export const FLAGSHIP_PROMPT_COST = 15;

export interface DahonoModel {
  id: string;
  name: string;
  logo: string;
  vision: boolean;
  tier: "regular" | "flagship";
}

const featured: Omit<DahonoModel, "vision">[] = [
  { id: "dahono/mimo-v2.6-flash", name: "MiMo V2.6 Flash", logo: "/images/ai-models/mimo.png", tier: "regular" },
  { id: "dahono/kimi-k2.8", name: "Kimi K2.8", logo: "/images/ai-models/kimi.ico", tier: "regular" },
  { id: "dahono/mimo-v2.6-pro", name: "MiMo V2.6 Pro", logo: "/images/ai-models/mimo.png", tier: "regular" },
  { id: "dahono/gemini-4-argon", name: "Gemini 4 Argon", logo: "/images/ai-models/gemini-color.svg", tier: "flagship" },
  { id: "dahono/gpt-6-astra", name: "GPT-6 Astra", logo: "/images/ai-models/openai-color.svg", tier: "flagship" },
  { id: "dahono/deepseek-v4.1-flash-1017", name: "DeepSeek V4.1 Flash 1017", logo: "/images/ai-models/deepseek-official.svg", tier: "flagship" },
  { id: "dahono/gpt-6-luna", name: "GPT-6 Luna", logo: "/images/ai-models/openai-color.svg", tier: "flagship" },
];

export function selectDahonoModels(rows: unknown): DahonoModel[] {
  if (!Array.isArray(rows)) return [];
  return featured.flatMap(model => {
    const row = rows.find(item => item?.id === model.id && item.paygOnly !== true);
    if (!row || (model.tier === "regular" && row.vision !== true)) return [];
    return [{ ...model, vision: row.vision === true }];
  });
}

export function dahonoModelName(id: string): string | undefined {
  return featured.find(model => model.id === id)?.name;
}
