"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceRing } from "voice-ring";
import { ChevronDown, Headphones, Music2, Pause, Play } from "lucide-react";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import { apiFetch } from "@/lib/apiClient";
import { STORY_VOICES } from "@/lib/storyVoices";
import { activeStoryCue, type StoryCue } from "@/lib/storySubtitles";
import "./story-player.css";

type VoiceOption = { id: string; name: string; description: string; previewUrl: string | null };

export default function StoryPlayer({ noteId, noteTitle }: { noteId: string; noteTitle: string }) {
  const [story, setStory] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [stage, setStage] = useState<"idle" | "writing" | "voicing">("idle");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [cues, setCues] = useState<StoryCue[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [voiceId, setVoiceId] = useState<string>(STORY_VOICES[0].id);
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [previewId, setPreviewId] = useState("");
  const controller = useRef<AbortController | null>(null);
  const objectUrl = useRef("");
  const locked = useRef(false);
  const voiceRequest = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const samplesRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const level = useCallback(() => {
    const analyser = analyserRef.current;
    const samples = samplesRef.current;
    if (!analyser || !samples || !audioRef.current || audioRef.current.paused) return 0;
    analyser.getByteTimeDomainData(samples);
    let total = 0;
    for (const value of samples) total += ((value - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(total / samples.length) * 4);
  }, []);

  function beginPlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    previewRef.current?.pause();
    setPreviewId("");
    try {
      if (!contextRef.current) {
        const context = new AudioContext();
        const source = context.createMediaElementSource(audio);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        analyser.connect(context.destination);
        contextRef.current = context;
        analyserRef.current = analyser;
        samplesRef.current = new Uint8Array(analyser.fftSize);
      }
      void contextRef.current.resume();
    } catch {
      // Playback remains usable if the browser does not support audio analysis.
    }
    setPlaying(true);
  }

  useEffect(() => () => {
    controller.current?.abort();
    voiceRequest.current?.abort();
    previewRef.current?.pause();
    void contextRef.current?.close();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  async function prepare() {
    if (locked.current) return;
    locked.current = true;
    setLoading(true);
    setStage(story ? "voicing" : "writing");
    setError("");
    const request = new AbortController();
    controller.current = request;
    try {
      let narration = story;
      if (!narration) {
        const response = await apiFetch(`/api/notes/${encodeURIComponent(noteId)}/story`, { method: "POST", signal: request.signal });
        const result = await response.json();
        if (!response.ok || typeof result.story !== "string" || !result.story.trim()) throw new Error(result.error || "Cerita belum bisa disiapkan.");
        narration = result.story;
        setStory(narration);
      }
      setStage("voicing");
      const audio = await apiFetch(`/api/notes/${encodeURIComponent(noteId)}/story/audio`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: narration, voiceId, subtitles: true }), signal: request.signal,
      });
      if (!audio.ok) {
        const result = await audio.json().catch(() => null);
        throw new Error(result?.error || "Suara belum bisa disiapkan.");
      }
      const result = await audio.json();
      if (typeof result.audio !== "string" || !Array.isArray(result.cues)) throw new Error("Audio belum bisa disiapkan.");
      const bytes = Uint8Array.from(atob(result.audio), character => character.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      if (!blob.size) throw new Error("Audio kosong. Silakan coba lagi.");
      if (request.signal.aborted) return;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(blob);
      setCues(result.cues);
      setAudioUrl(objectUrl.current);
    } catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : "Cerita belum bisa disiapkan.");
    } finally {
      locked.current = false;
      if (!request.signal.aborted) { setLoading(false); setStage("idle"); }
    }
  }

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try { if (audio.paused) await audio.play(); else audio.pause(); }
    catch { setError("Audio belum bisa diputar. Silakan coba lagi."); }
  };
  const openVoices = async () => {
    if (voiceOpen) { setVoiceOpen(false); previewRef.current?.pause(); setPreviewId(""); return; }
    setVoiceOpen(true);
    if (voices || voiceLoading) return;
    setVoiceLoading(true); setVoiceError("");
    const request = new AbortController(); voiceRequest.current = request;
    try {
      const response = await apiFetch("/api/voices", { signal: request.signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.voices) || !data.voices.length) throw new Error(data.error || "Pilihan suara belum tersedia.");
      if (!request.signal.aborted) setVoices(data.voices);
    } catch (failure) { if (!request.signal.aborted) setVoiceError(failure instanceof Error ? failure.message : "Pilihan suara belum bisa dimuat."); }
    finally { if (!request.signal.aborted) setVoiceLoading(false); }
  };
  const chooseVoice = (id: string) => {
    if (id === voiceId) return;
    previewRef.current?.pause(); setPreviewId("");
    audioRef.current?.pause();
    void contextRef.current?.close(); contextRef.current = null; analyserRef.current = null; samplesRef.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = ""; setAudioUrl(""); setCues([]); setPlaying(false); setTime(0); setDuration(0); setError(""); setVoiceId(id);
  };
  const preview = async (voice: VoiceOption) => {
    const audio = previewRef.current;
    if (!audio || !voice.previewUrl) return;
    if (previewId === voice.id && !audio.paused) { audio.pause(); setPreviewId(""); return; }
    audioRef.current?.pause(); audio.src = voice.previewUrl;
    try { await audio.play(); setPreviewId(voice.id); } catch { setPreviewId(""); setVoiceError("Contoh suara belum bisa diputar."); }
  };

  return <section className="story-player" aria-label="Cerita suara Momo">
    <div className="story-player-header"><span className="story-player-icon"><Headphones size={19} aria-hidden="true" /></span><div><p className="story-player-label">CERITA SUARA</p><h2>Dengarkan bersama Momo</h2><p>Catatanmu, diceritakan dengan cara yang lebih santai.</p></div></div>
    <div className="story-player-stage">
      <div className="story-player-visual" aria-hidden="true">
        <VoiceRing size={176} state={loading ? "processing" : playing ? "speaking" : "idle"} level={level} emotion="calm" theme="light" paused={reducedMotion} />
        <div className="story-player-momo"><MomoCompanion thinking={loading} response={playing ? "Mari belajar bersama." : ""} /></div>
        {loading && <><Music2 className="story-dream story-dream-one" size={16} /><Music2 className="story-dream story-dream-two" size={13} /><Music2 className="story-dream story-dream-three" size={15} /></>}
      </div>
      <div className="story-player-copy">
        <span className="story-player-status"><span />{loading ? "MOMO SEDANG MENYIAPKAN" : playing ? "SEDANG DIPUTAR" : audioUrl ? "SIAP DIDENGARKAN" : "SIAP BERCERITA"}</span>
        <h3>{loading ? (stage === "writing" ? "Momo sedang merangkai cerita" : "Momo sedang menyiapkan suara") : audioUrl ? noteTitle : "Belajar lewat cerita"}</h3>
        {audioUrl ? <div className="story-caption" aria-label="Subtitle cerita"><span>SUBTITLE</span><p>{cues.length ? activeStoryCue(cues, time)?.text ?? "Tekan putar untuk mendengarkan cerita." : "Subtitle tidak tersedia untuk audio ini."}</p></div> : <p>{loading ? (stage === "writing" ? "Membaca catatan dan menyusun penjelasan…" : "Mengubah cerita menjadi suara Momo…") : "Hai, aku Momo! Aku akan membantu menjelaskan catatan ini lewat cerita."}</p>}
        {!audioUrl && <button type="button" className="story-primary" disabled={loading} onClick={() => void prepare()}>{loading ? <><Music2 size={16} /> Sedang disiapkan</> : <><Play size={16} fill="currentColor" /> {story ? "Buat audio dengan suara ini" : "Siapkan cerita"}</>}</button>}
        {loading && <p className="story-live" role="status" aria-live="polite">{stage === "writing" ? "Menyusun narasi dari catatan…" : "Membuat audio cerita…"}</p>}
      </div>
    </div>
    <div className="story-voices">
      <button type="button" className="story-voice-toggle" disabled={loading} aria-expanded={voiceOpen} onClick={() => void openVoices()}><span><Headphones size={16} /> Suara: <strong>{STORY_VOICES.find(voice => voice.id === voiceId)?.name ?? "Bella"}</strong></span><span>Ganti suara <ChevronDown size={15} /></span></button>
      {voiceOpen && <div className="story-voice-panel"><p>Semua suara mendukung narasi Bahasa Indonesia. Contoh bawaan ElevenLabs berbahasa Inggris.</p>{voiceLoading && <p role="status">Memuat pilihan suara…</p>}{voiceError && <p role="alert" className="story-error">{voiceError} <button type="button" onClick={() => { setVoiceOpen(false); setVoiceError(""); }}>Tutup dan coba lagi</button></p>}
        {voices && <div role="radiogroup" aria-label="Pilih suara Momo" className="story-voice-list">{voices.map(voice => <div className="story-voice-row" key={voice.id}><label><input type="radio" name="story-voice" checked={voiceId === voice.id} onChange={() => chooseVoice(voice.id)} /><span><strong>{voice.name}</strong><small>{voice.description}</small></span></label><button type="button" disabled={!voice.previewUrl} onClick={() => void preview(voice)} aria-label={`${previewId === voice.id ? "Jeda" : "Dengarkan"} contoh suara ${voice.name}`}>{previewId === voice.id ? <Pause size={14} /> : <Play size={14} />} Contoh</button></div>)}</div>}
        <audio ref={previewRef} preload="none" onEnded={() => setPreviewId("")} onError={() => { setPreviewId(""); setVoiceError("Contoh suara belum bisa diputar."); }} />
      </div>}
    </div>
    {audioUrl && <div className="story-controls">
      <audio ref={audioRef} preload="metadata" src={audioUrl} aria-label="Putar cerita Momo" onPlay={beginPlayback} onPause={() => setPlaying(false)} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onEnded={() => setPlaying(false)} onError={() => { void contextRef.current?.close(); contextRef.current = null; analyserRef.current = null; samplesRef.current = null; setPlaying(false); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = ""; setAudioUrl(""); setError("Audio belum bisa diputar. Silakan coba lagi."); }} />
      <button type="button" className="story-play" aria-label={playing ? "Jeda cerita" : "Putar cerita"} onClick={() => void togglePlayback()}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
      <div className="story-timeline"><div className="story-timeline-top"><strong>{playing ? "Momo sedang bercerita" : "Cerita Momo"}</strong><span>{formatTime(time)} / {formatTime(duration)}</span></div><input type="range" min={0} max={duration || 0} step="0.1" value={Math.min(time, duration || 0)} aria-label="Posisi cerita" disabled={!duration} onChange={event => { const value = Number(event.target.value); if (audioRef.current) audioRef.current.currentTime = value; setTime(value); }} /></div>
    </div>}
    {error && <p role="alert" className="story-error">{error}</p>}
  </section>;
}
