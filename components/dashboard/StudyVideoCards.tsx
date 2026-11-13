"use client";

import Play from "kubai-icons-react/icons/play";
import { useState } from "react";
import type { studySourceVideos } from "@/lib/study-video";
import StudyClipPlayer from "./StudyClipPlayer";

export default function StudyVideoCards({ videos, clipId }: { videos: ReturnType<typeof studySourceVideos>; clipId?: string }) {
  const [active, setActive] = useState<string | null>(null);
  if (!videos.length) return null;
  return <div className={`study-chat-videos${videos.length === 1 ? " is-single" : ""}`}>
    {videos.slice(0, 4).map(video => {
      const { id, title, url, seconds } = video;
      if (id === clipId) return <StudyClipPlayer key={id} video={video} />;
      return <article key={id}>
        {active === id ? (
          <iframe
            title={title}
            src={`https://www.youtube-nocookie.com/embed/${id}?start=${seconds}&autoplay=1&playsinline=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : <button type="button" onClick={() => setActive(id)} aria-label={"Putar " + title}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Public YouTube thumbnail, loaded without exposing a server fetch endpoint. */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
          <span><Play size={14} aria-hidden="true" /> Putar video</span>
        </button>}
        <a href={url} target="_blank" rel="noopener noreferrer">{title}</a>
        <small>Jika pemutaran dibatasi pemilik video, buka tautan YouTube.</small>
      </article>;
    })}
  </div>;
}
