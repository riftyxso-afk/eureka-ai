/**
 * Kunci sessionStorage untuk prompt yang diteruskan dari /home
 * ke /chat/[id] (setelah animasi transisi kirim).
 */
import type { ChatAttachment } from "@/lib/assistant/types";

export const PENDING_PROMPT_KEY = "eureka_pending_prompt";

export interface PendingPrompt {
  prompt: string;
  mentions?: string[];
  webSearch?: boolean;
  attachment?: ChatAttachment | null;
  /** Kecepatan jawaban AI yang dipilih user (fast/normal/deep). */
  speedMode?: "fast" | "normal" | "deep";
  /** Model spesifik pilihan user (Model Store) — divalidasi ulang di server. */
  model?: string;
}
