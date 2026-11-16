"use client";
import { ImageSketchBlock } from "@/components/chat/ImageSketchBlock";
export default function ImageGenerationOverlay({ open, prompt, history, onClose, showPrompt = true }: {
  open: boolean; prompt: string; history?: { role: "user" | "assistant"; content: string }[]; onClose: () => void; showPrompt?: boolean;
}) {
  if (!open) return null;
  return <div className="my-6 w-full min-w-0" aria-label="Gambar dalam percakapan">
    <ImageSketchBlock key={prompt} prompt={prompt} history={history} onClose={onClose} showPrompt={showPrompt} />
  </div>;
}
export { ImageGenerationOverlay };
