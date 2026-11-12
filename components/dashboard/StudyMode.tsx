"use client";

import { useEffect, useRef, useState } from "react";
import ArrowUp from "kubai-icons-react/icons/arrow-up";
import ChevronDown from "kubai-icons-react/icons/chevron-down";
import BookOpen from "kubai-icons-react/icons/book-open";
import Timer from "kubai-icons-react/icons/timer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StudyArt from "@/components/dashboard/StudyArt";

import { useDashboardNotes } from "@/components/dashboard/useDashboardNotes";
import { openStudyChat } from "@/lib/study-chat-pending";
import { getUserId } from "@/lib/identity";

const examples = [
  { title: "Siap ulangan dalam 7 hari", body: "Susun bab, cari sumber, dan ulangi konsep yang masih sulit.", prompt: "Persiapan ulangan persamaan kuadrat", art: "map" },
  { title: "Belajar dari video", body: "Temukan bagian yang menjawab pertanyaanmu.", prompt: "Bantu aku mempelajari video YouTube. Minta tautan videonya terlebih dahulu.", art: "search" },
  { title: "Buat dokumen belajar", body: "Susun penjelasan dan sumber dalam DOCX.", prompt: "Buat dokumen belajar tentang energi terbarukan dengan contoh dan sumber.", art: "notebook" },
  { title: "Riset bersama teman", body: "Bagi bacaan dan bandingkan abstrak.", prompt: "Bantu aku mencari dan membandingkan paper untuk riset bersama teman.", art: "friends" },
] as const;

const focusLength = 25 * 60;

function focusKey() {
  return "eureka:study-focus:" + getUserId();
}
export default function StudyMode({ active }: { active: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLTextAreaElement>(null);
  const [goal, setGoal] = useState("");
  const [opening, setOpening] = useState(false);
  const openingRef = useRef(false);
  const imported = useRef(false);
  const [days, setDays] = useState(7);
  const [noteId, setNoteId] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [error, setError] = useState("");
  const [end, setEnd] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(focusLength);
  const { notes, loading, error: noteError, refresh } = useDashboardNotes(active && notesOpen);
  useEffect(() => {
    if (!active) return;
    if (!imported.current) {
      const prompt = new URL(location.href).searchParams.get("prompt");
      if (prompt) setGoal(prompt.slice(0, 2000));
      imported.current = true;
    }
    try {
      const storedEnd = Number(localStorage.getItem(focusKey()));
      if (storedEnd > 0 && Number.isFinite(storedEnd)) setEnd(storedEnd);
    } catch { /* Storage is optional. */ }
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

  async function submitGoal() {
    const prompt = goal.trim();
    if (!prompt || openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError("");
    try {
      const path = await openStudyChat(prompt + "\nTarget waktu belajar: " + days + " hari.", noteId || undefined);
      router.push(path);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Coba lagi.");
      openingRef.current = false;
      setOpening(false);
    }
  }

  return (
    <section hidden={!active} className="dv2-study-mode" aria-labelledby="dv2-study-title">
      <div className="dv2-study-workspace">
        <h1 id="dv2-study-title">Apa yang ingin kamu kuasai?</h1>
        <form className="dv2-study-composer" onSubmit={event => { event.preventDefault(); void submitGoal(); }}>
          <div className="dv2-study-input">
            <textarea ref={input} value={goal} onChange={event => { setGoal(event.target.value); setError(""); }} rows={3} maxLength={2000} minLength={1} required aria-label="Tujuan belajar" placeholder="Tulis tujuan, cari video, atau minta dokumen belajar…" />
            <div className="dv2-study-composer-actions">
              <label>Target <span className="dv2-study-select"><select aria-label="Target waktu belajar" value={days} onChange={event => setDays(Number(event.target.value))}>
                {[1, 3, 7, 14, 30].map(value => <option key={value} value={value}>{value} hari</option>)}
              </select><ChevronDown size={15} aria-hidden="true" /></span></label>
              <button className="dv2-study-send" type="submit" aria-label="Mulai percakapan belajar" title="Mulai percakapan belajar" disabled={!goal.trim() || opening}><ArrowUp size={20} aria-hidden="true" /></button>
            </div>
          </div>
          <div className="dv2-study-tools">
            <button type="button" aria-expanded={notesOpen} aria-label={noteId ? "Ganti catatan" : "Pakai catatan"} aria-controls="dv2-study-notes" onClick={() => setNotesOpen(open => !open)}><BookOpen size={16} aria-hidden="true" />{noteId ? "Catatan dipilih" : "Pakai catatan"}</button>
            <button type="button" onClick={() => { setGoal("Buatkan dokumen belajar yang rapi. Tanyakan dulu topik yang ingin kubahas."); input.current?.focus(); }}><StudyArt name="notebook" size={19} />Buat dokumen</button>
            <button type="button" onClick={toggleFocus} aria-label={end === null ? "Mulai fokus 25 menit" : "Hentikan sesi fokus"}><Timer size={16} aria-hidden="true" />{end === null ? "Fokus 25 mnt" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</button>
          </div>
          <div className="dv2-study-notes" id="dv2-study-notes" hidden={!notesOpen}>
            <label>Catatan untuk percakapan
              <span className="dv2-study-select"><select value={noteId} onChange={event => setNoteId(event.target.value)} disabled={loading}>
                <option value="">{loading ? "Memuat catatan..." : "Tanpa catatan"}</option>
                {notes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}
              </select><ChevronDown size={16} aria-hidden="true" /></span>
            </label>
            {noteError && <p role="alert">{noteError} <button type="button" onClick={refresh}>Muat ulang</button></p>}
          </div>
        </form>
        {error && <p role="alert" className="dv2-error">{error} <Link href="/dashboard-v2/misi">Buka Misi</Link></p>}
        {opening && <p className="flow-description" role="status">Membuka percakapan belajar…</p>}
        {seconds === 0 && <p role="status" className="dv2-study-finished">Sesi fokus selesai. Istirahat sebentar sebelum lanjut.</p>}
        <section className="dv2-study-examples" aria-labelledby="dv2-study-examples-title">
          <h2 id="dv2-study-examples-title">Coba cara belajar ini</h2>
          <div className="dv2-study-example-grid">
            {examples.map(example => {
              const label = <><StudyArt name={example.art} size={34} /><span><strong>{example.title}</strong><small>{example.body}</small></span></>;
              return <button key={example.title} type="button" onClick={() => { setGoal(example.prompt); setDays(7); setError(""); input.current?.focus(); }}>{label}</button>;
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
