"use client";

import { useState } from "react";
import { extractYoutubeVideoId } from "@/lib/assistant/videoUrl";
import type { StudySource } from "@/lib/study-sources-types";

export default function StudyVideoCards({ sources }: { sources: StudySource[] }) {
  const [active, setActive] = useState<string | null>(null);
  const unique = new Map<string, { source: StudySource; seconds: number }>();
  for (const source of sources) {
    const videoId = extractYoutubeVideoId(source.url);
    if (!videoId || unique.has(videoId)) continue;
    const url = new URL(source.url);
    const rawTime = url.searchParams.get("t") || "";
    const seconds = /^\d+s?$/.test(rawTime) ? Math.min(86400, parseInt(rawTime, 10)) : 0;
    unique.set(videoId, { source, seconds });
  }
  if (!unique.size) return null;
  return <div className="study-chat-videos">
    {[...unique].slice(0, 4).map(([id, { source, seconds }]) => <article key={id}>
      {active === id ? (
        <iframe
          title={source.title}
          src={`https://www.youtube-nocookie.com/embed/${id}?start=${seconds}&autoplay=1&playsinline=1&rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : <button type="button" onClick={() => setActive(id)} aria-label={"Putar " + source.title}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Public YouTube thumbnail, loaded without exposing a server fetch endpoint. */}
        <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
        <span>▶ Putar video</span>
      </button>}
      <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
      <small>Jika pemutaran dibatasi pemilik video, buka tautan YouTube.</small>
    </article>)}
  </div>;
}
