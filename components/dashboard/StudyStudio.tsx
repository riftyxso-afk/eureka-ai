"use client";

import { useEffect, useRef, useState } from "react";
import StudyArt from "@/components/dashboard/StudyArt";
import StudyFlowNav from "@/components/dashboard/StudyFlowNav";
import ResearchStudio from "@/components/dashboard/ResearchStudio";
import { studioRequest } from "@/components/dashboard/studio-request";
import type { StudyFeedback, StudySeries, StudySource } from "@/lib/study-sources-types";

const sections = [
  { id: "video", label: "Tanya Video", icon: <StudyArt name="search" /> },
  { id: "debate", label: "Debat Bukti", icon: <StudyArt name="target" /> },
  { id: "data", label: "Lab Data", icon: <StudyArt name="notebook" /> },
  { id: "research", label: "Riset Kelompok", icon: <StudyArt name="friends" /> },
] as const;
type Section = typeof sections[number]["id"];
type VideoResult = { answer: string; moments: { seconds: number; url: string }[] };
type DebateResult = { sources: StudySource[]; observations: { text: string; sourceIds: number[] }[]; question: string };

function timestamp(seconds: number) {
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function SeriesChart({ series }: { series: StudySeries }) {
  const values = series.points.map(point => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const format = (n: number) => n.toLocaleString("id-ID");
  const coordinates = values.map((value, index) => `${10 + (index / (values.length - 1)) * 580},${138 - (max === min ? 62 : ((value - min) / (max - min)) * 125)}`).join(" ");
  return (
    <figure className="studio-chart">
      <figcaption><strong>{series.code} · {series.name}</strong><br />Harga penutupan harian (Rp) · Bursa Efek Indonesia</figcaption>
      <div className="studio-chart-label"><span>Terendah Rp{format(min)}</span><span>Tertinggi Rp{format(max)}</span></div>
      <svg viewBox="0 0 600 150" role="img" aria-label={`Harga awal Rp${format(values[0])}, harga akhir Rp${format(values[values.length - 1])}`}>
        <polyline points={coordinates} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="studio-chart-label"><span>{series.points[0].date}</span><span>{series.points[series.points.length - 1].date}</span></div>
      <details className="studio-details"><summary>Lihat data harian</summary>
        <table><thead><tr><th scope="col">Tanggal</th><th scope="col">Harga penutupan (Rp)</th></tr></thead>
          <tbody>{series.points.map(point => <tr key={point.date}><td>{point.date}</td><td>{format(point.close)}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}

function SourceActivity({ section, enabled, initialVideo }: { section: Exclude<Section, "research">; enabled: boolean | null; initialVideo: string }) {
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState(initialVideo);
  const [code, setCode] = useState("BBCA");
  const [video, setVideo] = useState<VideoResult | null>(null);
  const [debate, setDebate] = useState<(DebateResult & { topic: string }) | null>(null);
  const [series, setSeries] = useState<StudySeries | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<StudyFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function run(evaluate = false) {
    if (active.current || enabled === false) return;
    const request = new AbortController();
    active.current = request;
    const requestOptions = { signal: request.signal };
    setBusy(true);
    setError("");
    setFeedback(null);
    try {
      if (evaluate) {
        const body = section === "data" ? { action: "seriesFeedback", code: series?.code, answer }
          : { action: "debateFeedback", query: debate?.topic, question: debate?.question, answer };
        setFeedback(await studioRequest<StudyFeedback>("study-sources", { ...requestOptions, body }));
      } else {
        setAnswer("");
        setVideo(null);
        setDebate(null);
        setSeries(null);
        if (section === "video") {
          setVideo(await studioRequest<VideoResult>("study-sources", { ...requestOptions, body: { action: "video", url, query } }));
        } else if (section === "debate") {
          const result = await studioRequest<DebateResult>("study-sources", { ...requestOptions, body: { action: "debate", query } });
          setDebate({ ...result, topic: query.trim() });
        } else {
          const result = await studioRequest<{ series: StudySeries }>("study-sources", { ...requestOptions, body: { action: "series", code } });
          setSeries(result.series);
        }
      }
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Coba lagi.");
    } finally {
      if (!request.signal.aborted) setBusy(false);
      active.current = null;
    }
  }

  return (
    <div className="studio-activity">
      <p className="flow-description">
        {section === "video" ? "Tanyakan bagian tertentu dan buka menit yang mendukung jawaban." : section === "debate" ? "Bandingkan cuplikan dari beberapa sumber, lalu bangun argumenmu." : "Latih cara membaca grafik dengan riwayat harga saham IDX."}
      </p>
      <form className="flow-form" onSubmit={event => { event.preventDefault(); void run(); }}>
        {section === "video" && <label>Tautan YouTube<input type="url" required maxLength={500} value={url} onChange={event => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label>}
        {section === "data" ? (
          <label>Kode saham IDX<input required pattern="[A-Za-z]{4}" maxLength={4} value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="BBCA" /></label>
        ) : (
          <label>{section === "video" ? "Pertanyaanmu" : "Topik debat"}
            <input required minLength={3} maxLength={240} value={query} onChange={event => setQuery(event.target.value)} placeholder={section === "video" ? "Kapan contoh ini dijelaskan?" : "Misalnya, dampak plastik sekali pakai"} />
          </label>
        )}
        <div className="flow-actions">
          <button className="flow-button" disabled={busy || enabled === false} type="submit">{section === "video" ? "Tanya Momo" : section === "debate" ? "Bandingkan sumber" : "Tampilkan grafik"}</button>
        </div>
      </form>
      {video && <section className="studio-output">
        <h3>Jawaban Momo</h3><p>{video.answer}</p>
        {video.moments.length > 0 && <div className="studio-moments">{video.moments.map(moment => <a className="flow-button secondary" href={moment.url} key={moment.url} target="_blank" rel="noopener noreferrer">Buka {timestamp(moment.seconds)}</a>)}</div>}
      </section>}
      {debate && <section className="studio-output">
        <h3>Perbandingan cuplikan</h3>
        <ul className="studio-observations">{debate.observations.map((item, index) => <li key={index}>{item.text} {[...new Set(item.sourceIds)].map(id => <a key={id} href={debate.sources[id - 1].url} target="_blank" rel="noopener noreferrer" aria-label={"Buka sumber " + id}>[{id}]</a>)}</li>)}</ul>
        <details className="studio-details"><summary>Lihat sumber dan cuplikan</summary>
          <ol className="studio-references">{debate.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a><p>{source.excerpt}</p></li>)}</ol>
        </details>
      </section>}
      {series && <SeriesChart series={series} />}
      {(series || debate) && <form className="flow-form studio-output" onSubmit={event => { event.preventDefault(); void run(true); }}>
        <h3>{series ? "Tantangan membaca grafik" : "Susun argumenmu"}</h3>
        <p>{series ? "Bandingkan harga penutupan hari pertama dan terakhir. Hitung perubahan persentasenya dan jelaskan berdasarkan data." : debate?.question}</p>
        <label>Jawaban<textarea required minLength={8} maxLength={3000} value={answer} onChange={event => setAnswer(event.target.value)} /></label>
        <div className="flow-actions"><button className="flow-button" disabled={busy} type="submit">Minta masukan</button></div>
      </form>}
      {busy && <p className="flow-description" role="status">Studio sedang memproses permintaan...</p>}
      {error && <p className="flow-error" role="alert">{error}</p>}
      {feedback && <section className="studio-output" aria-live="polite"><h3>Masukan Momo</h3><p>{feedback.feedback}</p>{feedback.question && <p>{feedback.question}</p>}</section>}
    </div>
  );
}

export default function StudyStudio() {
  const [section, setSection] = useState<Section>("video");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [initialVideo, setInitialVideo] = useState("");
  useEffect(() => {
    const params = new URL(location.href).searchParams;
    setInitialVideo(params.get("video")?.slice(0, 500) || "");
    const tool = sections.find(item => item.id === params.get("alat"));
    if (tool) setSection(tool.id);
    const request = new AbortController();
    studioRequest<{ enabled: boolean }>("study-sources", { signal: request.signal }).then(result => {
      if (!request.signal.aborted) setEnabled(result.enabled);
    }).catch(() => {});
    return () => request.abort();
  }, []);

  return (
    <main className="study-flow studio-flow">
      <header className="flow-heading"><h1 className="study-flow-title"><StudyArt name="notebook" size={46} />Studio Belajar<small>Beta</small></h1><p>Uji ide lewat video, data, sumber web, atau proyek bersama.</p></header>
      <div className="flow-layout">
        <StudyFlowNav label="Aktivitas studio" items={sections} current={section} onChange={setSection} />
        <section className="flow-panel" id="flow-panel" aria-labelledby="studio-title">
          <h2 id="studio-title">{sections.find(item => item.id === section)?.label}</h2>
          {enabled === false && <p className="studio-notice" role="status">Sumber publik belum diaktifkan.</p>}
          {section === "research" ? <ResearchStudio sourcesEnabled={enabled !== false} /> : <SourceActivity key={section + initialVideo} section={section} enabled={enabled} initialVideo={initialVideo} />}
        </section>
      </div>
    </main>
  );
}
