"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Download from "kubai-icons-react/icons/download";
import DocumentLogo from "@/components/ui/DocumentLogo";
import { apiFetch } from "@/lib/apiClient";
import type { StudyFile } from "@/lib/study-file-types";

function FileCard({ file, sessionId }: { file: StudyFile; sessionId: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const objectUrl = useRef("");
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  const image = /^image\/(png|jpeg|webp)$/.test(file.mime);

  const load = useCallback(async () => {
    if (objectUrl.current) return objectUrl.current;
    if (active.current) return;
    active.current = true; setBusy(true); setError("");
    const request = new AbortController(); controller.current = request;
    try {
      const response = await apiFetch("/api/study-files", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, fileId: file.id }), signal: request.signal,
      });
      if (!response.ok) throw new Error("File belum bisa dimuat. Coba lagi.");
      const blob = await response.blob();
      if (request.signal.aborted) return;
      objectUrl.current = URL.createObjectURL(new Blob([blob], { type: file.mime }));
      setUrl(objectUrl.current);
      return objectUrl.current;
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Coba lagi."); }
    finally { active.current = false; if (!request.signal.aborted) setBusy(false); }
  }, [sessionId, file.id, file.mime]);
  useEffect(() => {
    return () => { controller.current?.abort(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); };
  }, []);

  useEffect(() => {
    if (!image || !card.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void load(); }
    }, { rootMargin: "150px" });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [image, load]);

  return <article className="study-file-card" ref={card}>
    {image && (url ? <button type="button" className="study-file-image" aria-label={"Perbesar " + file.name} onClick={() => dialog.current?.showModal()}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Private authenticated file rendered from a local blob. */}
      <img src={url} alt={file.name} />
    </button> : <button type="button" className="study-file-preview" disabled={busy} onClick={() => void load()}>{busy ? "Memuat gambar…" : "Lihat gambar"}</button>)}
    <div className="study-file-description"><DocumentLogo name={file.name} /><div><strong>{file.name}</strong><small>{file.name.split(".").at(-1)?.toUpperCase()} · {file.size < 1024 * 1024 ? Math.ceil(file.size / 1024) + " KB" : (file.size / 1024 / 1024).toFixed(1) + " MB"}</small></div>
      <button type="button" disabled={busy} aria-label={"Unduh " + file.name} onClick={async () => {
        const target = await load();
        if (!target) return;
        const link = document.createElement("a"); link.href = target; link.download = file.name;
        document.body.appendChild(link); link.click(); link.remove();
      }}><Download size={19} aria-hidden="true" /></button>
    </div>
    {error && <p role="alert">{error}</p>}
    {image && <dialog ref={dialog} className="study-image-dialog" aria-label={file.name} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}><button type="button" onClick={() => dialog.current?.close()}>Tutup</button>
      {/* eslint-disable-next-line @next/next/no-img-element -- Private blob preview. */}
      {url && <img src={url} alt={file.name} />}
    </dialog>}
  </article>;
}

export default function StudyFileCards({ files, errors, sessionId }: { files: StudyFile[]; errors: string[]; sessionId: string }) {
  return <div className="study-file-results">{files.map(file => <FileCard key={file.id} file={file} sessionId={sessionId} />)}{errors.map(error => <p className="study-chat-error" role="alert" key={error}>{error}</p>)}</div>;
}
