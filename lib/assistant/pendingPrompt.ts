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
}
