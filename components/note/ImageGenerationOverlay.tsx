"use client";
import { useEffect, useRef } from "react";
import { ImageSketchBlock } from "@/components/chat/ImageSketchBlock";
export default function ImageGenerationOverlay({ open, prompt, history, onClose }: {
  open: boolean; prompt: string; history?: { role: "user" | "assistant"; content: string }[]; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open) dialog.current?.close();
  }, [open]);
  return <dialog ref={dialog} onClose={onClose} className="m-auto max-h-[90dvh] w-[min(94vw,510px)] overflow-y-auto rounded-2xl bg-clay-cream p-5 text-clay-dark backdrop:bg-black/40" aria-label="Membuat gambar">
    {open && <ImageSketchBlock key={prompt} prompt={prompt} history={history} onClose={() => { dialog.current?.close(); onClose(); }} />}
  </dialog>;
}
export { ImageGenerationOverlay };
