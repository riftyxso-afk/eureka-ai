"use client";
import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { ImageGeneration, type ImageGenerationStatus } from "@/components/ui/image-generation";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";

type Props = { prompt: string; history?: { role: string; content: string }[]; onClose: () => void };
export function ImageSketchBlock({ prompt, history = [], onClose }: Props) {
  const [status, setStatus] = useState<ImageGenerationStatus>("queued");
  const [statusText, setStatusText] = useState("Menyiapkan gambarmu...");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const historyRef = useRef(history);
  historyRef.current = history;
  useEffect(() => {
    const controller = new AbortController();
    // Defer the request so React Strict Mode can clean up its initial effect.
    const timer = window.setTimeout(async () => {
      setStatus("queued"); setStatusText("Menyiapkan gambarmu..."); setError(""); setImage("");
      try {
        const userId = getUserId();
        if (!userId) throw new Error("Masuk ke akunmu untuk membuat gambar.");
        const response = await apiFetch("/api/assistant/image", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ prompt, userId, history: historyRef.current, stream: true }),
        });
        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Gambar belum dapat dibuat.");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "", complete = false;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n"); buffer = events.pop() ?? "";
          for (const event of events) {
            const line = event.split("\n").find(line => line.startsWith("data: "));
            if (!line) continue;
            const data = JSON.parse(line.slice(6));
            if (data.status === "error") throw new Error(data.error || "Gambar belum dapat dibuat.");
            if (data.status === "complete" && data.dataUrl) {
              setImage(data.dataUrl); setStatus("complete"); setStatusText("Gambarmu siap"); complete = true;
            } else if (["queued", "generating", "refining"].includes(data.status)) {
              setStatus(data.status); setStatusText(data.message);
            }
          }
        }
        if (!complete) throw new Error("Koneksi terputus sebelum gambar selesai. Coba lagi.");
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Gambar belum dapat dibuat.");
        setStatus("error"); setStatusText("Gambar belum dapat dibuat");
      }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [prompt, retry]);
  return <section className="w-full max-w-[460px] text-clay-dark">
    <p className="mb-4 whitespace-pre-wrap break-words rounded-2xl bg-clay-beige px-4 py-3 text-sm leading-relaxed">{prompt}</p>
    <ImageGeneration status={status} statusText={statusText} size="fluid" onRetry={() => setRetry(value => value + 1)}>
      {image && <img src={image} alt={prompt} />}
    </ImageGeneration>
    {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-3">
      {image && <><a href={image} download="eureka-gambar.png" className="inline-flex min-h-11 items-center gap-2"><Download size={17} />Unduh</a><button type="button" onClick={() => setRetry(value => value + 1)} className="inline-flex min-h-11 items-center gap-2"><RefreshCw size={17} />Buat ulang</button></>}
      <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-2"><X size={17} />Tutup</button>
    </div>
  </section>;
}
