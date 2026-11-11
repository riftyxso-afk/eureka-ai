"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { useDashboardNotes } from "@/components/dashboard/useDashboardNotes";
import LoadingStatus from "@/components/ui/LoadingStatus";
import MarkdownView from "@/components/asisten/MarkdownView";
import "./mission-learning.css";
type Course = { token: string; title: string; index: number; passes: number; question: string; feedback: string; chapters: {title:string;material:string}[] };
export default function Page() {
  const [course, setCourse] = useState<Course | null>(null);
  const [selected, setSelected] = useState(0);
  const [title, setTitle] = useState("");
  const [material, setMaterial] = useState("");
  const [noteId, setNoteId] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const { notes } = useDashboardNotes(true);
  useEffect(() => {
    try { const saved = localStorage.getItem("eureka:mission-learning:" + getUserId()); if (saved) { const value = JSON.parse(saved); if (value.token && Array.isArray(value.chapters)) { setCourse(value); setSelected(Math.min(value.index, value.chapters.length - 1)); } } } catch { /* Empty or unavailable storage. */ }
    return () => controller.current?.abort();
  }, []);
  async function submit(action: "create" | "answer") {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const request = new AbortController(); controller.current = request;
    try {
      const res = await apiFetch("/api/missions/learn", { method:"POST", headers:{"Content-Type":"application/json"}, signal:request.signal, body:JSON.stringify(action === "create" ? {action,title,material,noteId:noteId || undefined} : {action,token:course?.token,answer}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Misi belum bisa diproses.");
      setCourse(data); setSelected(Math.min(data.index, data.chapters.length - 1)); setAnswer("");
      try { localStorage.setItem("eureka:mission-learning:" + getUserId(), JSON.stringify(data)); } catch { setError("Misi tersedia, tetapi progres belum tersimpan di perangkat. Jangan tutup halaman ini."); }
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Coba lagi."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <V2FeaturePage title="Misi belajar" art={3} guide="missions"><main className="mission-learning">
    <header className="mission-learning-header"><div><h1>Tujuan besar, satu langkah dulu.</h1><p>Susun materi bersama Momo, jelaskan pemahamanmu, lalu lanjut ke tantangan berikutnya.</p></div><Image src="/images/momo-mission.webp" alt="Momo membawa bendera misi belajar" width={180} height={120} /></header>
    {!course && !busy && <form className="mission-learning-form" onSubmit={event => {event.preventDefault(); void submit("create");}}>
      <h2>Mau mencapai apa?</h2><p>Pilih tujuan dan materi yang ingin kamu kuasai.</p><div className="mission-goals">{["Persiapan ulangan", "Latihan UTBK", "Persiapan SNBP", "Kejar IPK"].map(value => <button type="button" key={value} onClick={() => setTitle(value)} aria-pressed={title === value}>{value}</button>)}</div>
      <label>Tujuan belajarmu<input required minLength={5} maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="Misalnya ulangan persamaan kuadrat minggu depan" /></label>
      <label>Gunakan materi dari catatan<select value={noteId} onChange={event => setNoteId(event.target.value)}><option value="">Minta rekomendasi materi Momo</option>{notes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}</select></label>
      <label>Materi atau bagian yang masih sulit<textarea value={material} maxLength={16000} onChange={event => setMaterial(event.target.value)} placeholder="Tempel materi atau ceritakan kebutuhanmu. Boleh dikosongkan untuk rekomendasi Momo." /></label>
      <Link href="/dashboard-v2?mode=note">Unggah dokumen sebagai catatan terlebih dahulu</Link>
      <button className="mission-start" disabled={busy}>Susun jalur belajar</button>
    </form>}
    {busy && <div className="mission-loading" role="status"><Image src="/images/momo-mission.webp" alt="" width={150} height={150}/><h2>{course ? "Momo membaca jawabanmu" : "Merancang perjalanan belajarmu"}</h2><p>Materi dan pertanyaan disesuaikan dengan tujuanmu.</p><div className="mission-loading-track"><i/></div><LoadingStatus stage="thinking" detail={course ? "Momo meninjau alasan dan pemahamanmu…" : "Menyusun materi dan pertanyaan bertahap…"} /></div>}
    {error && <p role="alert">{error}</p>}
    {course && <><h2>{course.title}</h2><p>Progres tersimpan di perangkat ini. Dua jawaban beralasan yang tepat membuka materi berikutnya.</p><div className="mission-learning-grid"><ol className="mission-learning-path">{course.chapters.map((chapter,index) => <li key={index} data-complete={index < course.index}><span className="mission-node-number">{index < course.index ? "✓" : index + 1}</span><div><h3>{chapter.title}</h3><button disabled={index > course.index || busy} onClick={() => setSelected(index)}>{index > course.index ? "Terkunci" : index < course.index ? "Pelajari ulang" : "Mulai"}</button></div></li>)}</ol><section className="mission-lesson" aria-live="polite"><h2>{course.chapters[selected]?.title}</h2><MarkdownView content={course.chapters[selected]?.material || ""} />{course.feedback && <p className="mission-feedback">{course.feedback}</p>}{selected === course.index && <form onSubmit={event => {event.preventDefault(); void submit("answer");}}><h3>Mari pikirkan bersama</h3><p>{course.question}</p><label>Jelaskan dengan kata-katamu<textarea required minLength={3} maxLength={4000} value={answer} disabled={busy} onChange={event => setAnswer(event.target.value)} /></label><small>{course.passes}/2 bukti pemahaman pada materi ini</small><button className="mission-start" disabled={busy}>Diskusikan dengan Momo</button></form>}{course.index === course.chapters.length && <p role="status">Semua materi selesai. Kamu sudah menjelaskan konsep dan menerapkannya pada pertanyaan lanjutan.</p>}</section></div><button disabled={busy} onClick={() => { if (window.confirm("Mulai misi baru? Progres misi ini di perangkat akan diganti.")) { setCourse(null); localStorage.removeItem("eureka:mission-learning:" + getUserId()); } }}>Buat misi lain</button></>}
  </main></V2FeaturePage>;
}
