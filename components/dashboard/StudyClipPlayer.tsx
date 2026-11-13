"use client";
import "./study-clip.css";
import type { StudyVideo } from "@/lib/study-video";
export default function StudyClipPlayer({ video, quiet = false }: { video: StudyVideo; quiet?: boolean }) {
  return <section className="study-clip-player" aria-label="Bagian video yang dibahas">
    <strong>{video.title} · {Math.floor(video.seconds / 60)}:{String(video.seconds % 60).padStart(2, "0")}</strong>
    <iframe key={`${video.id}:${video.seconds}`} title={video.title} src={`https://www.youtube-nocookie.com/embed/${video.id}?start=${video.seconds}&autoplay=1&playsinline=1&rel=0${quiet ? "&mute=1" : ""}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    <small>{quiet ? "Video diputar tanpa suara agar penjelasan tutor terdengar. " : ""}Jika browser menahan pemutaran otomatis, ketuk tombol putar pada video.</small>
  </section>;
}
