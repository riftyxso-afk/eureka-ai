export type ReactionMode = "fast" | "normal" | "deep";
export function chooseMomoLook(question: string, response: string, mode?: ReactionMode): string;
export function chooseMomoMood(response: string, state?: { thinking?: boolean; error?: boolean }): "concerned" | "thinking" | "neutral" | "happy";
