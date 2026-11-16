export const DAHONO_LOGO = "/images/ai-models/dahono.svg";

export interface DahonoModel {
  id: string;
  name: string;
  logo: string;
  vision: true;
}

const featured = [
  { id: "dahono/mimo-v2.6-flash", name: "MiMo V2.6 Flash", logo: "/images/ai-models/mimo.png" },
  { id: "dahono/kimi-k2.8", name: "Kimi K2.8", logo: "/images/ai-models/kimi.ico" },
  { id: "dahono/mimo-v2.6-pro", name: "MiMo V2.6 Pro", logo: "/images/ai-models/mimo.png" },
];

export function selectDahonoVisionModels(rows: unknown): DahonoModel[] {
  if (!Array.isArray(rows)) return [];
  return featured.flatMap(model => rows.some(row => row && row.id === model.id && row.vision === true && row.paygOnly !== true)
    ? [{ ...model, vision: true as const }] : []);
}

export function dahonoModelName(id: string): string | undefined {
  return featured.find(model => model.id === id)?.name;
}
