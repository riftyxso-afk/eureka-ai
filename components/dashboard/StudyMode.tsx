"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, BookOpen, Timer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StudyArt from "@/components/dashboard/StudyArt";
import StudyAgentResult, { useStudyAgent } from "@/components/dashboard/StudyAgentResult";
import { useDashboardNotes } from "@/components/dashboard/useDashboardNotes";
import { STUDY_MISSION_DRAFT, type StudyMissionDraft } from "@/lib/study-mission-draft";
import { getUserId } from "@/lib/identity";

const examples = [
  { title: "Siap ulangan dalam 7 hari", body: "Susun bab, cari sumber, dan ulangi konsep yang masih sulit.", prompt: "Persiapan ulangan persamaan kuadrat", art: "map" },
  { title: "Belajar dari video", body: "Temukan bagian yang menjawab pertanyaanmu.", href: "/dashboard-v2/studio-belajar", art: "search" },
  { title: "Buat dokumen belajar", body: "Susun penjelasan dan sumber dalam DOCX.", prompt: "Buat dokumen belajar tentang energi terbarukan dengan contoh dan sumber.", art: "notebook" },
  { title: "Riset bersama teman", body: "Bagi bacaan dan bandingkan abstrak.", href: "/dashboard-v2/studio-belajar?alat=research", art: "friends" },
] as const;

const focusLength = 25 * 60;

function focusKey() {
  return "eureka:study-focus:" + getUserId();
}
export default function StudyMode({ active }: { active: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLTextAreaElement>(null);
  const [goal, setGoal] = useState("");
  const [action, setAction] = useState<"auto" | "mission" | "work">("auto");
  const agent = useStudyAgent();
  const needsTools = /\b(cari(?:kan)?|telusuri|carikan|bandingkan|riset|analisis|dokumen|makalah|modul|laporan|abstrak|paper|preprint|idx|berita|transkrip|youtube)\b/i.test(goal) || /youtu\.be\//i.test(goal);
  const runAgent = action === "work" || (action === "auto" && needsTools);
  const [days, setDays] = useState(7);
  const [noteId, setNoteId] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [end, setEnd] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(focusLength);
  const { notes, loading, error: noteError, refresh } = useDashboardNotes(active && notesOpen);
  useEffect(() => {
    if (!active) return;
    try {
      const data = JSON.parse(localStorage.getItem("eureka:mission-learning:" + getUserId()) || "null");
      setSaved(typeof data?.title === "string" && data.token ? data.title : "");
      const storedEnd = Number(localStorage.getItem(focusKey()));
      if (storedEnd > 0 && Number.isFinite(storedEnd)) setEnd(storedEnd);
    } catch { setSaved(""); }
  }, [active]);

  useEffect(() => {
    if (end === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) {
        setEnd(null);
        try { localStorage.removeItem(focusKey()); } catch { /* Timer remains available in this tab. */ }
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [end]);

  function toggleFocus() {
    const next = end === null ? Date.now() + focusLength * 1000 : null;
    setSeconds(focusLength);
    setEnd(next);
    try {
      if (next === null) localStorage.removeItem(focusKey());
      else localStorage.setItem(focusKey(), String(next));
    } catch {
      // The timer can still run while this workspace is open.
    }
  }

  function submitGoal() {
    const title = goal.trim();
    if (title.length < 5 || agent.busy) return;
    setError("");
    if (runAgent) {
      void agent.run(title);
      return;
    }
    if (title.length > 160) {
      setError("Ringkas tujuan misi menjadi maksimal 160 karakter.");
      return;
    }
    const draft: StudyMissionDraft = { owner: getUserId(), title, days, noteId };
    try {
      sessionStorage.setItem(STUDY_MISSION_DRAFT, JSON.stringify(draft));
      router.push("/dashboard-v2/misi?draf=belajar");
    } catch {
      setError("Tujuan belum bisa dibawa ke Misi. Buka Misi untuk menuliskannya langsung.");
    }
  }

  return (
    <section hidden={!active} className="dv2-study-mode" data-has-result={agent.busy || !!agent.text || !!agent.error} aria-labelledby="dv2-study-title">
      <div className="dv2-study-workspace">
        <h1 id="dv2-study-title">Apa yang ingin kamu kuasai?</h1>
        <form className="dv2-study-composer" onSubmit={event => { event.preventDefault(); submitGoal(); }}>
          <div className="dv2-study-input">
            <textarea ref={input} value={goal} onChange={event => { setGoal(event.target.value); setError(""); }} rows={3} maxLength={2000} minLength={5} required aria-label="Tujuan belajar" placeholder="Tulis tujuan, cari video, atau minta dokumen belajar…" />
            <div className="dv2-study-composer-actions">
              <label><span className="sr-only">Aksi Mode Belajar</span><select value={action} onChange={event => setAction(event.target.value as typeof action)}>
                <option value="auto">Otomatis</option>
                <option value="mission">Susun misi</option>
                <option value="work">Cari &amp; kerjakan</option>
              </select></label>
              {!runAgent && <label>Target <select aria-label="Target waktu belajar" value={days} onChange={event => setDays(Number(event.target.value))}>
                {[1, 3, 7, 14, 30].map(value => <option key={value} value={value}>{value} hari</option>)}
              </select></label>}
              <button className="dv2-study-send" type="submit" aria-label={runAgent ? "Jalankan tugas belajar" : "Tinjau misi"} title={runAgent ? "Jalankan tugas belajar" : "Tinjau misi"} disabled={goal.trim().length < 5 || agent.busy}><ArrowUp size={20} aria-hidden="true" /></button>
            </div>
          </div>
          <div className="dv2-study-tools">
            <button type="button" disabled={runAgent} aria-expanded={notesOpen && !runAgent} aria-controls="dv2-study-notes" onClick={() => setNotesOpen(open => !open)}><BookOpen size={16} aria-hidden="true" />{noteId ? "Catatan dipilih" : "Pakai catatan"}</button>
            <Link href="/dashboard-v2/studio-belajar"><StudyArt name="notebook" size={19} />Studio Belajar</Link>
            <button type="button" onClick={toggleFocus} aria-label={end === null ? "Mulai fokus 25 menit" : "Hentikan sesi fokus"}><Timer size={16} aria-hidden="true" />{end === null ? "Fokus 25 mnt" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</button>
          </div>
          <div className="dv2-study-notes" id="dv2-study-notes" hidden={!notesOpen || runAgent}>
            <label>Catatan untuk misi
              <select value={noteId} onChange={event => setNoteId(event.target.value)} disabled={loading}>
                <option value="">{loading ? "Memuat catatan..." : "Tanpa catatan"}</option>
                {notes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}
              </select>
            </label>
            {noteError && <p role="alert">{noteError} <button type="button" onClick={refresh}>Muat ulang</button></p>}
          </div>
        </form>
        {error && <p role="alert" className="dv2-error">{error} <Link href="/dashboard-v2/misi">Buka Misi</Link></p>}
        <StudyAgentResult agent={agent} />
        {seconds === 0 && <p role="status" className="dv2-study-finished">Sesi fokus selesai. Istirahat sebentar sebelum lanjut.</p>}
        {saved && <Link className="dv2-study-resume" href="/dashboard-v2/misi"><StudyArt name="map" size={32} /><span><small>Lanjutkan misi</small><strong>{saved}</strong></span><span aria-hidden="true">›</span></Link>}
        <section className="dv2-study-examples" aria-labelledby="dv2-study-examples-title">
          <h2 id="dv2-study-examples-title">Coba cara belajar ini</h2>
          <div className="dv2-study-example-grid">
            {examples.map(example => {
              const label = <><StudyArt name={example.art} size={34} /><span><strong>{example.title}</strong><small>{example.body}</small></span></>;
              return "href" in example
                ? <Link key={example.title} href={example.href}>{label}</Link>
                : <button key={example.title} type="button" onClick={() => { setGoal(example.prompt); setAction(example.art === "map" ? "mission" : "work"); setDays(7); setError(""); input.current?.focus(); }}>{label}</button>;
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
