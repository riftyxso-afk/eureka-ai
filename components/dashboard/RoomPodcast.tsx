"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { PODCAST_HOSTS, type PodcastTurn } from "@/lib/podcastHosts";
import { podcastBatches, podcastWave } from "@/lib/podcastAudio";
import { activeStoryCue, type StoryCue } from "@/lib/storySubtitles";
import PodcastStudio, { PodcastPortrait } from "./PodcastStudio";

type Segment = { host: string; start: number; end: number };
const STYLES = ["Pelan-pelan, aku pemula", "Pakai contoh sehari-hari", "Buat seperti diskusi kelas", "Fokus persiapan ujian"];
const clock = (time: number) => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
export default function RoomPodcast({ noteId, title }: { noteId: string; title: string }) {
  const [hosts, setHosts] = useState<string[]>(["momo", "nara"]);
  const [seat, setSeat] = useState(0);
  const [setupStep, setSetupStep] = useState(0);
  const [style, setStyle] = useState("");
  const [duration, setDuration] = useState(3);
  const [language, setLanguage] = useState("id");
  const [stage, setStage] = useState<"idle" | "script" | "audio">("idle");
  const [turns, setTurns] = useState<PodcastTurn[]>([]);
  const [url, setUrl] = useState("");
  const [cues, setCues] = useState<StoryCue[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [preview, setPreview] = useState("");
  const [chunks, setChunks] = useState({ done: 0, total: 0 });
  const [reduced, setReduced] = useState(false);
  const request = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const objectUrl = useRef("");
  const audioParts = useRef<{ audio: string; cues: StoryCue[]; segments: Segment[]; duration: number }[]>([]);
  const audio = useRef<HTMLAudioElement>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);
  const previewRequest = useRef<AbortController | null>(null);
  const context = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const samples = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const busy = stage !== "idle";
  useEffect(() => { const media = matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReduced(media.matches); update(); media.addEventListener("change", update); return () => { media.removeEventListener("change", update); request.current?.abort(); previewRequest.current?.abort(); previewAudio.current?.pause(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); void context.current?.close(); }; }, []);
  const level = useCallback(() => { if (!analyser.current || !samples.current || audio.current?.paused) return 0; analyser.current.getByteTimeDomainData(samples.current); let sum = 0; for (const value of samples.current) sum += ((value - 128) / 128) ** 2; return Math.min(1, Math.sqrt(sum / samples.current.length) * 4); }, []);
  function reset() { previewRequest.current?.abort(); audio.current?.pause(); previewAudio.current?.pause(); void context.current?.close(); context.current = null; analyser.current = null; samples.current = null; audioParts.current = []; setChunks({ done: 0, total: 0 }); setPreview(""); setPlaying(false); setTurns([]); setCues([]); setSegments([]); setUrl(""); setTime(0); setLength(0); setError(""); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = ""; }
  function choose(id: string) { if (busy) return; const existing = hosts.indexOf(id); if (existing >= 0) { setSeat(existing); return; } reset(); setHosts(all => all.map((value, index) => index === seat ? id : value)); setSeat(value => value === 0 ? 1 : 0); }
  function stop() { request.current?.abort(); locked.current = false; setStage("idle"); setError("Pembuatan dihentikan. Bagian audio yang selesai tetap tersedia untuk dilanjutkan."); }
  async function sample(voiceId: string) {
    if (busy) return;
    previewRequest.current?.abort();
    if (preview === voiceId) { previewAudio.current?.pause(); setPreview(""); return; }
    const controller = new AbortController(); previewRequest.current = controller;
    setPreview(voiceId); setError(""); audio.current?.pause(); previewAudio.current?.pause();
    try {
      const response = await apiFetch("/api/voices", { signal: controller.signal }); const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Contoh suara belum tersedia.");
      const voice = data.voices?.find((v: { id: string }) => v.id === voiceId);
      if (!voice?.previewUrl) throw new Error("Contoh suara belum tersedia.");
      if (controller.signal.aborted) return;
      const player = new Audio(voice.previewUrl); previewAudio.current = player; player.onended = () => setPreview(""); await player.play();
    } catch (failure) { if (!controller.signal.aborted) { setPreview(""); setError(failure instanceof Error ? failure.message : "Contoh belum bisa diputar."); } }
  }
  async function generate() {
    if (locked.current || hosts.length !== 2) return;
    locked.current = true; setError(""); previewRequest.current?.abort(); previewAudio.current?.pause(); setPreview("");
    const controller = new AbortController(); request.current = controller;
    async function post(payload: object) { const response = await apiFetch(`/api/notes/${noteId}/podcast`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, hosts, language }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(180000)]) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Podcast belum dapat disiapkan."); return data; }
    try {
      let script = turns;
      if (!script.length) { setStage("script"); const data = await post({ action: "script", style, duration }); if (controller.signal.aborted) return; script = data.turns; setTurns(script); }
      setStage("audio"); const batches = podcastBatches(script);
      setChunks({ done: audioParts.current.length, total: batches.length });
      for (let i = audioParts.current.length; i < batches.length; i++) {
        if (controller.signal.aborted) return;
        const data = await post({ action: "audio", turns: batches[i] });
        if (controller.signal.aborted) return;
        if (typeof data.audio !== "string" || !Number.isFinite(data.duration) || data.duration <= 0) throw new Error("Audio podcast kosong.");
        audioParts.current.push({ audio: data.audio, cues: data.cues ?? [], segments: data.segments ?? [], duration: data.duration });
        setChunks({ done: i + 1, total: batches.length });
      }
      const combinedCues: StoryCue[] = []; const combinedSegments: Segment[] = []; let offset = 0;
      const pcm = audioParts.current.map(part => { combinedCues.push(...part.cues.map(c => ({ ...c, start: c.start + offset, end: c.end + offset }))); combinedSegments.push(...part.segments.map(s => ({ ...s, start: s.start + offset, end: s.end + offset }))); offset += part.duration; return Uint8Array.from(atob(part.audio), c => c.charCodeAt(0)); });
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(new Blob([podcastWave(pcm)], { type: "audio/wav" }));
      setUrl(objectUrl.current); setCues(combinedCues); setSegments(combinedSegments);
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error && failure.name === "TimeoutError" ? "Pembuatan podcast terlalu lama. Silakan coba lagi." : failure instanceof TypeError ? "Koneksi ke layanan podcast terputus. Periksa server lalu coba lagi." : failure instanceof Error ? failure.message : "Podcast belum dapat disiapkan."); }
    finally { if (request.current === controller) { locked.current = false; if (!controller.signal.aborted) setStage("idle"); } }
  }
  function onPlay() {
    previewAudio.current?.pause(); setPreview(""); setPlaying(true);
    try { if (!context.current && audio.current) { const ctx = new AudioContext(); const source = ctx.createMediaElementSource(audio.current); const node = ctx.createAnalyser(); node.fftSize = 1024; source.connect(node); node.connect(ctx.destination); context.current = ctx; analyser.current = node; samples.current = new Uint8Array(node.fftSize); } void context.current?.resume(); } catch { /* The audio is still playable without analysis. */ }
  }
  async function toggle() { try { if (audio.current?.paused) await audio.current.play(); else audio.current?.pause(); } catch { setError("Audio belum dapat diputar. Coba lagi."); } }
  const speaker = PODCAST_HOSTS.find(h => h.id === segments.find(s => time >= s.start && time < s.end)?.host) ?? PODCAST_HOSTS.find(h => h.id === hosts[0])!;
  const cue = activeStoryCue(cues, time);
  return <section className="rm-podcast"><div className="rm-feature-heading"><div><h1>Studio podcast <span className="rm-beta">Beta</span></h1><p>Dua teman bicara, satu materi yang lebih mudah dipahami.</p></div><span className="ps-heading-label">Dua suara · Satu cerita</span></div><div className="rm-podcast-source"><small>DARI CATATAN</small><strong>{title}</strong></div>
    <PodcastStudio hosts={hosts} activeHost={speaker.id} playing={playing} stage={stage} ready={!!url} level={level} reduced={reduced} editingSeat={seat} onSeatPick={!url && !busy ? index => { setSeat(index); setSetupStep(0); } : undefined} />
    {!url && !busy && <div className="rm-podcast-config ps-setup" data-step={setupStep}>
      <div className="ps-setup-progress" aria-label="Pengaturan podcast"><button type="button" aria-current={setupStep === 0 ? "step" : undefined} onClick={() => setSetupStep(0)}><span>1</span>Pilih host</button><button type="button" aria-current={setupStep === 1 ? "step" : undefined} onClick={() => setSetupStep(1)}><span>2</span>Atur obrolan</button></div>
      <section className="ps-setup-hosts"><div className="rm-field-heading"><h2>Siapa teman bicaramu?</h2></div><p className="ps-seat-help" role="status">Mengatur kursi {seat ? "kanan" : "kiri"}. Pilih karakter untuk mengganti {PODCAST_HOSTS.find(host => host.id === hosts[seat])?.name}.</p><div className="rm-hosts">{PODCAST_HOSTS.map(host => <div key={host.id} className={`rm-host ${hosts.includes(host.id) ? "is-selected" : ""} ${hosts[seat] === host.id ? "is-editing" : ""}`}><button disabled={busy} aria-pressed={hosts.includes(host.id)} onClick={() => choose(host.id)} aria-label={`Pilih host ${host.name}`}><span className="rm-host-check">{hosts.includes(host.id) && <Check size={13} />}</span><PodcastPortrait host={host.id} /><strong>{host.name}</strong><small>{host.role}</small></button><button disabled={busy} className="rm-host-preview" aria-label={`Dengarkan contoh suara ${host.name}`} onClick={() => void sample(host.voiceId)}><Volume2 size={12} />{preview === host.voiceId ? "Hentikan" : "Contoh suara"}</button></div>)}</div><p className="rm-local-label">Contoh bawaan suara berbahasa Inggris. Podcast mengikuti bahasa yang kamu pilih.</p>
      </section><section className="ps-setup-options"><h2>Atur cara bercerita</h2><label className="rm-style-field">Mau obrolannya seperti apa?<textarea disabled={busy} value={style} maxLength={200} onChange={e => { reset(); setStyle(e.target.value); }} placeholder="Contoh: jelaskan pelan-pelan, pakai analogi yang mudah, tetap sopan dan santai." /><small>{style.length}/200 · Opsional</small></label><div className="rm-style-chips">{STYLES.map(value => <button key={value} disabled={busy} aria-pressed={style === value} onClick={() => { reset(); setStyle(value); }}>{value}</button>)}</div>
      <div className="rm-podcast-options"><fieldset disabled={busy}><legend>Target durasi</legend>{[0.5, 3, 7].map(value => <button type="button" key={value} aria-pressed={duration === value} onClick={() => { reset(); setDuration(value); }}>{value === 0.5 ? "30 detik" : `±${value} menit`}</button>)}</fieldset><fieldset disabled={busy}><legend>Bahasa</legend>{[["id", "Indonesia"], ["en", "English"]].map(([value, name]) => <button type="button" key={value} aria-pressed={language === value} onClick={() => { reset(); setLanguage(value); }}>{name}</button>)}</fieldset></div>
      </section></div>}
    {(busy || url) && <div className="rm-podcast-stage ps-conversation"><div><small role="status">{busy ? "DARI RUANG PRODUKSI" : `${speaker.name.toUpperCase()} · ${playing ? "SEDANG BERBICARA" : "SIAP DIDENGARKAN"}`}</small><h2>{busy ? stage === "script" ? "Merangkai percakapan…" : `Menghidupkan suara · ${chunks.done}/${chunks.total} bagian` : "Belajar lewat percakapan."}</h2><p className="rm-podcast-caption">{busy ? stage === "script" ? "Membaca materi, memilih contoh, dan menyusun diskusi yang runtut." : "Membuat audio dan menyelaraskan subtitle dengan suara." : cue?.text || "Tekan putar untuk mendengarkan podcastmu."}</p>{busy && <><div className="ps-preparing-lines" aria-hidden="true"><i /><i /></div><ol className="rm-podcast-steps"><li className={stage === "audio" ? "is-done" : "is-active"}>1. Susun naskah</li><li className={stage === "audio" ? "is-active" : ""}>2. Buat suara</li></ol></>}</div></div>}
    {url && <div className="rm-podcast-player"><audio ref={audio} src={url} onPlay={onPlay} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={e => setTime(e.currentTarget.currentTime)} onLoadedMetadata={e => setLength(e.currentTarget.duration)} onError={() => setError("Audio belum dapat dimuat.")} /><button className="rm-play" aria-label={playing ? "Jeda podcast" : "Putar podcast"} onClick={() => void toggle()}>{playing ? <Pause size={20} /> : <Play size={20} />}</button><div><input aria-label="Posisi pemutaran podcast" type="range" min={0} max={length || 1} step={.1} value={Math.min(time, length || 1)} onChange={e => { if (audio.current) audio.current.currentTime = Number(e.target.value); setTime(Number(e.target.value)); }} /><small>{clock(time)} / {clock(length)}</small></div><select aria-label="Kecepatan podcast" onChange={e => { if (audio.current) audio.current.playbackRate = Number(e.target.value); }}>{[1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{value}×</option>)}</select><a href={url} download={`podcast-${title.slice(0, 70).replace(/[^\p{L}\p{N} -]/gu, "")}.wav`} aria-label="Unduh podcast"><Download size={18} /></a></div>}
    {error && <p className="rm-error" role="alert">{error}</p>}
    <div className="rm-podcast-footer ps-production-footer" data-step={setupStep}>{url ? <button onClick={() => { reset(); setSetupStep(0); }}><RotateCcw size={15} />Buat podcast lain</button> : busy ? <><p>Kamu bisa menghentikan proses. Bagian suara yang sudah selesai tidak perlu dibuat ulang.</p><button className="ps-stop" onClick={stop}>Hentikan pembuatan</button></> : <><p>{PODCAST_HOSTS.filter(host => hosts.includes(host.id)).map(host => host.name).join(" + ")} · {duration === .5 ? "30 detik" : `±${duration} menit`} · {language === "id" ? "Indonesia" : "English"}</p><button className="dv2-button ps-next-step" onClick={() => { setSetupStep(1); document.querySelector('.ps-setup')?.scrollIntoView({ block: "start" }); }}>Lanjut: atur obrolan →</button><button className="dv2-button ps-create-podcast" disabled={hosts.length !== 2} onClick={() => void generate()}>{turns.length ? "Lanjutkan pembuatan" : "Buat podcast"}</button></>}</div>
  </section>;
}
