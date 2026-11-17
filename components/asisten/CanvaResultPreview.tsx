"use client";

import { useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { canvaPreviewSchema, type CanvaPreview } from "@/lib/connectors/events";

export default function CanvaResultPreview({ initial }: { initial: CanvaPreview }) {
  const [preview, setPreview] = useState(initial);
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const refreshed = useRef(false);
  const href = preview.editUrl ?? preview.viewUrl;

  async function refreshThumbnail() {
    if (refreshed.current) {
      setImageUnavailable(true);
      return;
    }
    refreshed.current = true;
    try {
      const response = await apiFetch(`/api/connectors/canva-preview?id=${encodeURIComponent(preview.id)}`, {
        signal: AbortSignal.timeout(15_000),
      });
      const result = canvaPreviewSchema.safeParse(response.ok ? (await response.json()).preview : null);
      if (result.success && result.data.thumbnail.url !== preview.thumbnail.url) {
        setPreview(result.data);
        return;
      }
    } catch {
      // Keep the link available if Canva cannot refresh this thumbnail.
    }
    setImageUnavailable(true);
  }

  const thumbnail = imageUnavailable
    ? <div className="canva-result-fallback">Pratinjau tidak tersedia</div>
    : <img className="canva-result-thumbnail" src={preview.thumbnail.url} alt={`Pratinjau ${preview.title}`}
        width={preview.thumbnail.width} height={preview.thumbnail.height} loading="lazy" decoding="async"
        referrerPolicy="no-referrer" onError={() => void refreshThumbnail()} />;

  return <figure className="canva-result-preview">
    {href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Buka ${preview.title} di Canva`}>{thumbnail}</a> : thumbnail}
    <figcaption>
      <strong>{preview.title}</strong>
      {href && <a href={href} target="_blank" rel="noopener noreferrer">{preview.editUrl ? "Edit di Canva" : "Buka Canva"} <ExternalLink size={13} aria-hidden="true" /></a>}
    </figcaption>
  </figure>;
}
