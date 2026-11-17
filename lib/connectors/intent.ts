import { CONNECTORS } from "./catalog";
/** Routing hint only. The server still verifies ownership and granted permissions. */
export function connectorForPrompt(prompt: string) {
  const aliases: Record<string, RegExp> = {
    drive: /\b(?:google\s*drive|gdrive|drive)\b/i,
    docs: /\bgoogle\s*docs\b/i,
    sheets: /\bgoogle\s*sheets\b/i,
    slides: /\bgoogle\s*slides\b/i,
    calendar: /\bgoogle\s*calendar\b/i,
    teams: /\b(?:microsoft\s*)?teams\b/i,
    microsoft: /\bmicrosoft\s*365\b/i,
  };
  return CONNECTORS.find(provider => (aliases[provider.id] || new RegExp("\\b" + provider.name + "\\b", "i")).test(prompt))?.id;
}
