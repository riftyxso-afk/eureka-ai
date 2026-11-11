"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Headphones, Pause, Sparkles, Square } from "lucide-react";
import { PipWizardSticker } from "stick-it-up";
import { DitherBook } from "@/components/amicro/DitherBook";
import LoadingStatus from "@/components/ui/LoadingStatus";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { STARTER_STORY, starterIllustration } from "@/lib/storybook-starter";
import type { Storybook } from "@/lib/storybook";
import type { Note, NoteChapter } from "@/lib/types";
import type { NoteImage } from "@/lib/note-images-store";

export default function StoryStudio() {
  const [story, setStory] = useState<Storybook>({ id: "", ...STARTER_STORY, scenes: STARTER_STORY.scenes.map((scene, index) => ({ ...scene, image: starterIllustration(index) })) });
  const [prompt, setPrompt] = useState("");
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [flipping, setFlipping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState<Pick<Note, "id" | "title">[]>([]);
  const [audioState, setAudioState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [deviceVoice, setDeviceVoice] = useState(false);
  const media = useRef<HTMLAudioElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  const audioController = useRef<AbortController | null>(null);
  const audioUrls = useRef(new Map<string, string>());
  const voiceRevision = useRef(0);
  const lock = useRef(false);
  const scene = story.scenes[index];
  function stopAudio() {
    voiceRevision.current++;
    audioController.current?.abort();
    if (media.current) { media.current.pause(); media.current = null; }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setAudioState("idle");
  }
  useEffect(() => {
    const request = new AbortController();
    const urls = audioUrls.current;
    void apiFetch(`/api/notes?userId=${encodeURIComponent(getUserId())}`, { signal: request.signal }).then(async response => {
      const body = await response.json(); if (response.ok && !request.signal.aborted && Array.isArray(body.notes)) setSaved(body.notes.filter((note: Note) => note.noteType === "dongeng"));
    }).catch(() => {});
    return () => {
      request.abort(); controller.current?.abort(); audioController.current?.abort();
      media.current?.pause();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      urls.forEach(url => URL.revokeObjectURL(url)); urls.clear();
    };
  }, []);
  function flip(delta: number) {
    const next = index + delta;
    if (flipping || next < 0 || next >= story.scenes.length) return;
    stopAudio(); setDirection(delta); setFlipping(true); setIndex(next);
  }
  function installStory(next: Storybook) {
    stopAudio(); setIndex(0); setFlipping(false); setStory(next);
    setSaved(current => [{ id: next.id, title: next.title }, ...current.filter(item => item.id !== next.id)]);
    window.dispatchEvent(new Event("note-ready"));
  }
  async function writeStory(preset = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice(""); stopAudio();
    const work = new AbortController(); controller.current = work;
    try {
      const response = await apiFetch("/api/library/story", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preset ? { preset: "benih-cahaya" } : { prompt }), signal: AbortSignal.any([work.signal, AbortSignal.timeout(115_000)]) });
      const body = await response.json(); if (!response.ok || !body.story?.id) throw new Error(body.error || "Cerita belum bisa dibuat.");
      if (work.signal.aborted) return;
      const next: Storybook = body.story;
      if (preset) next.scenes = next.scenes.map((part, position) => ({ ...part, image: starterIllustration(position) }));
      installStory(next); setNotice("Cerita tersimpan di koleksi catatanmu.");
      if (preset) return;
      setImageProgress(1);
      let failed = 0;
      for (let position = 0; position < next.scenes.length; position++) {
        if (work.signal.aborted) break;
        setImageProgress(position + 1);
        try {
          const imageResponse = await apiFetch("/api/assistant/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: getUserId(), prompt: next.scenes[position].imagePrompt }), signal: work.signal });
          const image = await imageResponse.json();
          if (!imageResponse.ok || typeof image.dataUrl !== "string" || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(image.dataUrl)) throw new Error("Ilustrasi belum tersedia");
          if (work.signal.aborted) break;
          setStory(current => current.id === next.id ? { ...current, scenes: current.scenes.map((part, i) => i === position ? { ...part, image: image.dataUrl } : part) } : current);
          const blob = await (await fetch(image.dataUrl)).blob();
          const form = new FormData(); form.set("file", new File([blob], `scene-${position + 1}.png`, { type: blob.type })); form.set("chapterId", String(position + 1)); form.set("caption", next.scenes[position].title);
          const uploaded = await apiFetch(`/api/notes/${encodeURIComponent(next.id)}/images`, { method: "POST", body: form, signal: work.signal });
          if (!uploaded.ok) throw new Error("Gambar belum tersimpan");
        } catch { if (work.signal.aborted) break; failed++; }
      }
      if (!work.signal.aborted && failed) setNotice(`${failed} ilustrasi belum berhasil dibuat atau disimpan. Teks dongeng tetap tersimpan; kamu bisa melanjutkan membaca.`);
    } catch (cause) { if (!work.signal.aborted) setError(cause instanceof Error ? cause.message : "Dongeng belum tersedia."); }
    finally { if (controller.current === work) { lock.current = false; setBusy(false); setImageProgress(0); } }
  }
  async function openSaved(id: string) {
    if (!id || busy) return;
    controller.current?.abort(); const work = new AbortController(); controller.current = work;
    stopAudio(); setBusy(true); setError(""); setNotice(""); lock.current = true;
    try {
      const [noteResponse, imagesResponse] = await Promise.all([apiFetch(`/api/notes/${encodeURIComponent(id)}`, { signal: work.signal }), apiFetch(`/api/notes/${encodeURIComponent(id)}/images`, { signal: work.signal })]);
      const body = await noteResponse.json(); const imageBody = imagesResponse.ok ? await imagesResponse.json() : { images: [] };
      const note = body.note;
      if (!noteResponse.ok || !Array.isArray(note?.chapters) || !note.chapters.length) throw new Error(body.error || "Dongeng ini belum memiliki halaman.");
      if (work.signal.aborted) return;
      installStory({ id, title: note.title, scenes: note.chapters.map((chapter: NoteChapter) => ({ title: chapter.title, text: chapter.content, imagePrompt: "", image: (imageBody.images as NoteImage[]).find(image => image.chapterId === chapter.id)?.url })) });
    } catch (cause) { if (!work.signal.aborted) setError(cause instanceof Error ? cause.message : "Dongeng belum bisa dibuka."); }
    finally { if (controller.current === work) { lock.current = false; setBusy(false); } }
  }
  async function narrate() {
    if (audioState === "playing") { if (deviceVoice) window.speechSynthesis.pause(); else media.current?.pause(); setAudioState("paused"); return; }
    if (audioState === "paused") {
      try { if (deviceVoice) window.speechSynthesis.resume(); else await media.current?.play(); setAudioState("playing"); }
      catch { setAudioState("idle"); setError("Audio belum bisa diputar. Coba lagi."); }
      return;
    }
    stopAudio(); setError("");
    if (deviceVoice) {
      if (!("speechSynthesis" in window)) { setError("Peramban ini belum mendukung narasi perangkat."); return; }
      const voices = window.speechSynthesis.getVoices(); const voice = voices.find(item => /^id(?:-|_)/i.test(item.lang));
      if (!voice) { setError("Suara Bahasa Indonesia belum tersedia di perangkat ini. Pilih suara Momo."); return; }
      const utterance = new SpeechSynthesisUtterance(`${scene.title}. ${scene.text}`); utterance.lang = "id-ID"; utterance.voice = voice; utterance.rate = .92;
      const revision = voiceRevision.current;
      utterance.onend = () => { if (revision === voiceRevision.current) setAudioState("idle"); }; utterance.onerror = () => { if (revision === voiceRevision.current) { setAudioState("idle"); setError("Narasi perangkat terhenti. Coba putar kembali."); } };
      setAudioState("playing"); window.speechSynthesis.speak(utterance); return;
    }
    if (!story.id) { setNotice("Simpan dongeng pilihan ini terlebih dahulu untuk mendengarkannya dengan Momo."); return; }
    const work = new AbortController(); audioController.current = work; setAudioState("loading");
    try {
      const key = `${story.id}:${index}`; let url = audioUrls.current.get(key);
      if (!url) {
        const response = await apiFetch(`/api/notes/${encodeURIComponent(story.id)}/story/audio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `${scene.title}. ${scene.text}` }), signal: work.signal });
        if (!response.ok) { const body = await response.json(); throw new Error(body.error || "Narator belum tersedia."); }
        const blob = await response.blob(); if (work.signal.aborted) return;
        url = URL.createObjectURL(blob); audioUrls.current.set(key, url);
      }
      if (work.signal.aborted) return;
      const audio = new Audio(url); media.current = audio;
      audio.onended = () => { if (!work.signal.aborted) setAudioState("idle"); }; audio.onerror = () => { if (!work.signal.aborted) { setAudioState("idle"); setError("Audio belum bisa diputar."); } };
      await audio.play(); if (!work.signal.aborted) setAudioState("playing"); else audio.pause();
    } catch (cause) { if (!work.signal.aborted) { setAudioState("idle"); setError(cause instanceof Error ? cause.message : "Suara belum bisa dibuat. Kamu bisa mencoba suara perangkat."); } }
  }
  const pages = story.scenes.flatMap((part, position) => [{ id: `${position}-art`, title: part.title, src: part.image, content: part.image ? undefined : imageProgress ? "Ilustrasi sedang disiapkan. Kamu sudah bisa membaca ceritanya." : "Ilustrasi belum tersedia untuk adegan ini." }, { id: `${position}-text`, title: part.title, content: part.text }]);
  return <div className="story-studio">
    <div className="story-intro"><span aria-hidden="true"><PipWizardSticker size={80} peel /></span><div><h2>Ceritamu punya dunianya sendiri.</h2><p>Tulis satu ide. Momo membuat dongeng orisinal, ilustrasi, dan membacakannya untukmu.</p></div></div>
    <form className="story-prompt" onSubmit={event => { event.preventDefault(); void writeStory(); }}><label htmlFor="story-idea">Ide dongengmu</label><textarea id="story-idea" maxLength={700} minLength={10} required rows={2} placeholder="Seekor kelinci kecil belajar menjaga laut bersama teman-temannya…" value={prompt} onChange={event => setPrompt(event.target.value)} disabled={busy} /><button className="library-primary" disabled={busy || prompt.trim().length < 10}><Sparkles size={17} />{busy ? "Momo sedang berkarya…" : "Buat buku dongeng"}</button></form>
    {busy && <div className="story-loading"><LoadingStatus stage={imageProgress ? "combining" : "thinking"} detail={imageProgress ? `Membuat dan menyimpan ilustrasi ${imageProgress}/${story.scenes.length}` : "Menyiapkan halaman dongeng…"} /><button onClick={() => { controller.current?.abort(); setNotice("Proses tampilan dihentikan. Cerita yang sudah tersimpan tetap ada di koleksimu."); setBusy(false); lock.current = false; }}>Hentikan</button></div>}
    {error && <p role="alert" className="library-warning">{error}</p>}{notice && <p role="status" className="story-notice">{notice}</p>}
    <div className="story-book-heading"><div><small>{story.id ? "Tersimpan di catatanmu" : "Dongeng pilihan Eureka"}</small><h2>{story.title}</h2></div>{saved.length > 0 && <label className="story-saved">Buka dongeng<select value={story.id} disabled={busy} onChange={event => void openSaved(event.target.value)}><option value="">Pilih dari koleksimu</option>{saved.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>}</div>
    <div className="story-book-stage" data-speaking={audioState === "playing"}><DitherBook key={story.id || "starter"} pages={pages} currentIndex={index * 2 + 1} direction={direction} onFlipComplete={() => setFlipping(false)} settings={{ padding: 14, imageRadius: 3, creaseOpacity: 14, paperColor: "#f4efe5", shadowIntensity: 12 }} onPrevPage={() => flip(-1)} onNextPage={() => flip(1)} /></div>
    <div className="story-controls"><button aria-label="Adegan sebelumnya" disabled={index === 0 || flipping} onClick={() => flip(-1)}><ArrowLeft size={20} /></button><span>Adegan {index + 1} dari {story.scenes.length}</span><button aria-label="Adegan berikutnya" disabled={index === story.scenes.length - 1 || flipping} onClick={() => flip(1)}><ArrowRight size={20} /></button></div>
    <div className="story-narrator"><label>Narator<select value={deviceVoice ? "device" : "momo"} onChange={event => { stopAudio(); setDeviceVoice(event.target.value === "device"); }}><option value="momo">Momo</option><option value="device">Suara perangkat (Indonesia)</option></select></label><button className="library-primary" disabled={audioState === "loading"} onClick={() => void narrate()}>{audioState === "playing" ? <Pause size={17} /> : <Headphones size={17} />}{audioState === "loading" ? "Menyiapkan suara…" : audioState === "playing" ? "Jeda" : audioState === "paused" ? "Lanjutkan" : "Dengarkan adegan"}</button>{audioState !== "idle" && <button aria-label="Hentikan narasi" onClick={stopAudio}><Square size={17} /></button>}</div>
    <article className="story-reading" aria-live="polite"><h3>{scene.title}</h3><p>{scene.text}</p></article>
    <footer className="story-footer">{story.id ? <Link href={`/dashboard-v2/note/${encodeURIComponent(story.id)}`}>Buka seluruh dongeng di catatan</Link> : <button className="library-primary" disabled={busy} onClick={() => void writeStory(true)}>Simpan dongeng ini ke catatan</button>}<small>Narasi diputar per adegan. Balik halaman untuk melanjutkan cerita.</small></footer>
  </div>;
}
