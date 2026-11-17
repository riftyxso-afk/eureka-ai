"use client";

import { useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { canvaPreviewSchema, type CanvaPreview } from "@/lib/connectors/events";

export default function CanvaResultPreview({ initial, onPrompt }: { initial: CanvaPreview; onPrompt?: (prompt: string) => void }) {
  const [preview, setPreview] = useState(initial);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const refreshed = useRef(false);
  const template = preview.kind === "brand_template";
  const href = preview.viewUrl ?? preview.createUrl ?? preview.editUrl;
  const actionUrl = preview.createUrl ?? preview.editUrl ?? preview.viewUrl;

  async function refreshThumbnail() {
    if (refreshed.current) {
      setImageUnavailable(true);
      return;
    }
    refreshed.current = true;
    try {
      const query = new URLSearchParams({ id: preview.id, kind: preview.kind ?? "design" });
      const response = await apiFetch(`/api/connectors/canva-preview?${query}`, {
        signal: AbortSignal.timeout(15_000),
      });
      const result = canvaPreviewSchema.safeParse(response.ok ? (await response.json()).preview : null);
      if (result.success && result.data.thumbnail && result.data.thumbnail.url !== preview.thumbnail?.url) {
        setPreview(result.data);
        return;
      }
    } catch {
      // Keep the link available if Canva cannot refresh this thumbnail.
    }
    setImageUnavailable(true);
  }

  const thumbnail = imageUnavailable || !preview.thumbnail
    ? <div className="canva-result-fallback">Pratinjau tidak tersedia</div>
    : <img className="canva-result-thumbnail" src={preview.thumbnail.url} alt={`Pratinjau ${preview.title}`}
        width={preview.thumbnail.width} height={preview.thumbnail.height} loading="lazy" decoding="async"
        referrerPolicy="no-referrer" onError={() => void refreshThumbnail()} />;

  return <figure className="canva-result-preview">
    {href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${preview.title} di Canva`}>{thumbnail}</a> : thumbnail}
    <figcaption>
      <strong>{preview.title}</strong>
      {template && onPrompt && <button type="button" className="canva-chat-action"
        onClick={() => onPrompt(`Lihat kolom template Canva ${preview.id}`)}>Pilih template</button>}
      {actionUrl && <a href={actionUrl} target="_blank" rel="noopener noreferrer">
        {preview.createUrl ? "Gunakan di Canva" : preview.editUrl ? "Edit di Canva" : "Buka Canva"}
        <ExternalLink size={13} aria-hidden="true" />
      </a>}
    </figcaption>
  </figure>;
}
