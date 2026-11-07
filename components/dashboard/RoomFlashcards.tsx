"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Shuffle } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import type { Flashcard } from "@/lib/study-store";
import type { Note } from "@/lib/types";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import StudyDreaming from "./StudyDreaming";

type Deck = { cards: Flashcard[]; pending: number[]; ratings: Record<number, "again" | "known">; index: number };
const EMPTY: Deck = { cards: [], pending: [], ratings: {}, index: 0 };
function cardsFrom(value: unknown): Flashcard[] { return Array.isArray(value) ? value.filter(c => c && typeof c.front === "string" && c.front.trim() && typeof c.back === "string" && c.back.trim()).slice(0, 30).map((c, i) => ({ ...c, id: i + 1 })) : []; }
export default function RoomFlashcards({ note }: { note: Note }) {
  const [deck, setDeck] = useState<Deck>(EMPTY); const [flipped, setFlipped] = useState(false);
  const [animateFlip, setAnimateFlip] = useState(true);
  const [busy, setBusy] = useState(false); const [ready, setReady] = useState(false); const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null); const lock = useRef(false);
  const key = `eureka:v2:flashcards:${getUserId()}:${note.id}`;
  const revision = useMemo(() => JSON.stringify([note.title, note.chapters]), [note]);
  useEffect(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(key) || "null"); const cards = cardsFrom(cached?.deck?.cards);
      if (cached?.revision === revision && cards.length && cards.length === cached.deck.cards.length) {
        const ids = cards.map(c => c.id); const pending = Array.isArray(cached.deck.pending) ? [...new Set<number>(cached.deck.pending.filter((id: number) => ids.includes(id)))] : ids;
        const ratings: Deck["ratings"] = {};
        cards.forEach(c => { const rating = cached.deck.ratings?.[c.id]; if (rating === "again" || rating === "known") ratings[c.id] = rating; });
        const missing = ids.filter(id => !pending.includes(id) && !ratings[id]);
        setDeck({ cards, pending: [...pending, ...missing], ratings, index: Math.max(0, Math.min(Math.max(0, pending.length - 1), Math.floor(Number(cached.deck.index)) || 0)) });
      }
    } catch {}
    setReady(true); return () => request.current?.abort();
  }, [key, revision]);
  useEffect(() => { if (ready && deck.cards.length) { try { sessionStorage.setItem(key, JSON.stringify({ revision, deck })); } catch {} } }, [deck, key, ready, revision]);
  async function generate(fresh = false) {
    if (lock.current) return; lock.current = true; setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await apiFetch(`/api/notes/${note.id}/flashcards`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reuse: !fresh }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(150000)]) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Kartu belum bisa dibuat.");
      const cards = cardsFrom(data.cards); if (!cards.length) throw new Error("Kartu belum tersedia. Coba lagi.");
      if (!controller.signal.aborted) { setDeck({ cards, pending: cards.map(c => c.id), ratings: {}, index: 0 }); setFlipped(false); }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error && failure.name === "TimeoutError" ? "AI membutuhkan waktu lebih lama. Coba lagi sebentar." : failure instanceof TypeError ? "Koneksi terputus. Periksa koneksi, lalu coba lagi." : failure instanceof Error ? failure.message : "Kartu belum bisa disiapkan."); }
    finally { lock.current = false; setBusy(false); }
  }
  const card = deck.cards.find(c => c.id === deck.pending[deck.index]);
  const known = deck.cards.filter(c => deck.ratings[c.id] === "known").length;
  const hard = deck.cards.filter(c => deck.ratings[c.id] === "again").length;
  const finished = deck.cards.length > 0 && deck.pending.length === 0;
  function rate(rating: "again" | "known") {
    if (!card || !flipped) return;
    setDeck(current => { const pending = current.pending.filter(id => id !== card.id); return { ...current, ratings: { ...current.ratings, [card.id]: rating }, pending, index: Math.min(current.index, Math.max(0, pending.length - 1)) }; }); setFlipped(false);
  }
  function move(offset: number) { setDeck(current => ({ ...current, index: Math.max(0, Math.min(current.pending.length - 1, current.index + offset)) })); setFlipped(false); }
  function repeat(onlyHard: boolean) { setDeck(current => ({ ...current, pending: current.cards.filter(c => !onlyHard || current.ratings[c.id] === "again").map(c => c.id), index: 0, ratings: onlyHard ? current.ratings : {} })); setFlipped(false); }
  function shuffle() {
    setDeck(current => { const pending = [...current.pending]; const values = crypto.getRandomValues(new Uint32Array(pending.length)); for (let i = pending.length - 1; i > 0; i--) { const j = values[i] % (i + 1); [pending[i], pending[j]] = [pending[j], pending[i]]; } return { ...current, pending, index: 0 }; }); setFlipped(false);
  }
  return <section className="sp-page sp-flashcards"><div className="rm-feature-heading"><div><h1>Flashcard</h1><p>Ingat kembali, buka jawabannya, lalu nilai pemahamanmu.</p></div>{deck.cards.length > 0 && !finished && !busy && <button className="sp-text-button" onClick={shuffle}><Shuffle size={15} />Acak urutan</button>}</div><div className="sp-note-context"><span className="rm-nav-illustration" style={{ backgroundPosition: "0% 0%" }} aria-hidden="true" /><span><small>DARI CATATANMU</small><strong>{note.title}</strong></span></div>{error && <p className="rm-error" role="alert">{error}</p>}
    {busy ? <div className="sp-generation" aria-busy="true"><StudyDreaming paper title="Momo sedang merangkai kartu" detail="Memilih konsep penting dan menyusun pertanyaan singkat dari catatanmu." /><button className="sp-text-button" onClick={() => { request.current?.abort(); setBusy(false); }}>Hentikan pembuatan</button></div> : !deck.cards.length ? <div className="sp-setup"><span className="rm-nav-illustration sp-large-illustration" style={{ backgroundPosition: "50% 50%" }} aria-hidden="true" /><h2>Belajar sedikit, ingat lebih lama.</h2><p>Pikirkan jawaban sebelum membalik kartu. Tandai yang sudah kamu pahami dan ulangi bagian yang masih sulit.</p><div className="rf-setup-steps"><span>1. Coba ingat</span><span>2. Balik kartu</span><span>3. Nilai sendiri</span></div><button className="dv2-button" disabled={!ready} onClick={() => void generate()}>Mulai latihan <ArrowRight size={16} /></button><button className="sp-text-button" disabled={!ready} onClick={() => void generate(true)}>Buat kartu baru dengan AI</button></div> : finished ? <div className="sp-results"><div className="sr-momo"><MomoCompanion mode="fast" response={hard ? "Bagus, kamu sudah berlatih. Kita bisa mengulang bagian yang masih sulit." : "Hebat! Semua kartu sudah kamu pahami."} /></div><small>SESI LATIHAN SELESAI</small><h2>{hard ? "Kamu sudah tahu bagian yang perlu diulang." : "Semakin banyak yang kamu ingat."}</h2><div className="rf-result-stats"><div><strong>{known}</strong><span>Sudah paham</span></div><div><strong>{hard}</strong><span>Perlu diulang</span></div></div><div className="sp-result-actions">{hard > 0 && <button className="dv2-button" onClick={() => repeat(true)}><RotateCcw size={16} />Ulangi {hard} kartu sulit</button>}<button className={hard ? "sp-text-button" : "dv2-button"} onClick={() => repeat(false)}>Ulangi semua kartu</button><button className="sp-text-button" onClick={() => void generate(true)}>Buat kartu baru dengan AI</button></div></div> : card && <div className="rf-practice"><div className="sp-progress"><span>{deck.pending.length} kartu tersisa</span><progress value={deck.cards.length - deck.pending.length} max={deck.cards.length} aria-label="Progres latihan kartu" /></div><div className="rf-stage"><div className="rf-stage-heading"><span>KARTU {deck.index + 1} / {deck.pending.length}</span><span>{known} dipahami · {hard} perlu diulang</span></div><button className="rf-flip" aria-label={flipped ? "Balik kembali ke pertanyaan" : "Balik kartu untuk melihat jawaban"} aria-pressed={flipped} onClick={event => { setAnimateFlip(event.detail !== 0); setFlipped(value => !value); }}><span key={card.id} className={`rf-card-inner ${flipped ? "is-flipped" : ""} ${animateFlip ? "" : "is-instant"}`}><span className="rf-face rf-front" aria-hidden={flipped}><small>COBA INGAT KEMBALI</small><strong>{card.front}</strong><span>Klik untuk melihat jawaban <RotateCcw size={13} /></span></span><span className="rf-face rf-back" aria-hidden={!flipped}><small>JAWABAN</small><strong>{card.back}</strong><span>Seberapa yakin kamu sudah memahaminya?</span></span></span></button><div className="rf-navigation"><button className="sp-text-button" disabled={deck.index === 0} onClick={() => move(-1)}><ArrowLeft size={15} />Sebelumnya</button><span>{flipped ? "Nilai pemahamanmu di bawah" : "Pikirkan jawabanmu lebih dulu"}</span><button className="sp-text-button" disabled={deck.index === deck.pending.length - 1} onClick={() => move(1)}>Berikutnya<ArrowRight size={15} /></button></div><div className="rf-rating"><button disabled={!flipped} onClick={() => rate("again")}><RotateCcw size={17} /><span>Masih belajar<small>Ulangi lagi nanti</small></span></button><button disabled={!flipped} onClick={() => rate("known")}><Check size={18} /><span>Sudah paham<small>Lanjut ke kartu lain</small></span></button></div></div></div>}
    <p className="sp-device-hint">Penilaianmu tersimpan pada sesi browser ini. Ini latihan mandiri, bukan nilai ujian.</p>
  </section>;
}
