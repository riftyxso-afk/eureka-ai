"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import "./SubjectPractice.css";

type Card = { id: string; front: string; back: string };
export type SubjectPracticeProps = {
  subjectId: string;
  noteId: string;
  noteTitle: string;
  onClose: () => void;
  onComplete: () => void;
};

async function practiceRequest(url: string, signal: AbortSignal, body?: object) {
  const response = await apiFetch(url, {
    method: body ? "POST" : "GET", signal, cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Permintaan belum berhasil. Coba lagi.");
  return result;
}

export default function SubjectPractice({ subjectId, noteId, noteTitle, onClose, onComplete }: SubjectPracticeProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const completed = useRef(false);
  const generated = useRef<{ front: string; back: string }[] | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const endpoint = `/api/subjects/${encodeURIComponent(subjectId)}/practice`;

  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    busy.current = true;
    completed.current = false;
    generated.current = null;
    setLoading(true);
    setWorking(false);
    setSaved(false);
    setError("");
    setCards([]);
    setSeen(new Set());
    setIndex(0);
    setFlipped(false);
    try {
      const data = await practiceRequest(`${endpoint}?noteId=${encodeURIComponent(noteId)}`, request.signal);
      if (!request.signal.aborted) setCards(data.cards);
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Kartu belum bisa dimuat.");
    } finally {
      if (!request.signal.aborted) { busy.current = false; setLoading(false); }
    }
  }, [endpoint, noteId]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);

  const prepare = async () => {
    if (busy.current || completed.current) return;
    busy.current = true;
    setWorking(true);
    setError("");
    const request = new AbortController();
    controller.current = request;
    try {
      // Recheck saved cards before spending generation work, including after a failed save.
      const existing = await practiceRequest(`${endpoint}?noteId=${encodeURIComponent(noteId)}`, request.signal);
      if (request.signal.aborted) return;
      if (existing.cards.length) { setCards(existing.cards); return; }
      if (!generated.current) {
        const response = await apiFetch(`/api/notes/${encodeURIComponent(noteId)}/flashcards`, { method: "POST", signal: request.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Kartu belum berhasil dibuat.");
        if (request.signal.aborted) return;
        generated.current = data.cards;
      }
      const data = await practiceRequest(endpoint, request.signal, { action: "prepare", noteId, cards: generated.current });
      if (!request.signal.aborted) { setCards(data.cards); generated.current = null; }
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Kartu belum berhasil disimpan.");
    } finally {
      if (!request.signal.aborted) { busy.current = false; setWorking(false); }
    }
  };

  const finish = async () => {
    if (busy.current || completed.current || !cards.length || !cards.every((card) => seen.has(card.id))) return;
    busy.current = true;
    setWorking(true);
    setError("");
    const request = new AbortController();
    controller.current = request;
    try {
      await practiceRequest(endpoint, request.signal, { action: "review", noteId, cardIds: cards.map((card) => card.id) });
      if (request.signal.aborted) return;
      completed.current = true;
      setSaved(true);
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Aktivitas belum berhasil disimpan.");
    } finally {
      if (!request.signal.aborted) { busy.current = false; setWorking(false); }
    }
  };

  const card = cards[index];
  const allSeen = cards.length > 0 && cards.every((item) => seen.has(item.id));
  const move = (next: number) => { setIndex(next); setFlipped(false); };
  const close = () => {
    controller.current?.abort();
    if (completed.current) { completed.current = false; onComplete(); }
    onClose();
  };

  return (
    <dialog ref={dialog} className="sj-practice" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const targets = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
        if (!targets?.length) return;
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <div className="sj-practice-heading">
        <div><p className="sj-practice-eyebrow">Latihan kartu</p><h2 id={titleId}>{noteTitle}</h2></div>
        <button type="button" className="sj-practice-close" onClick={close} aria-label="Tutup latihan">×</button>
      </div>
      <p id={descriptionId} className="sj-practice-description">Ingat jawabannya, lalu buka kartu. Latihan ini mencatat aktivitas, bukan nilai atau XP.</p>
      <div role="status" className="sj-practice-status">{loading ? "Memuat kartu tersimpan…" : working ? cards.length ? "Menyimpan aktivitas…" : "Menyiapkan kartu tersimpan…" : saved ? "Aktivitas tersimpan. Jadwal review berikutnya 24 jam lagi." : cards.length ? `${seen.size} dari ${cards.length} jawaban sudah dibuka` : "Belum ada kartu tersimpan untuk catatan ini."}</div>
      {error && <p className="sj-practice-error" role="alert">{error}</p>}
      {!loading && saved ? (
        <div className="sj-practice-result"><h3>Latihan selesai</h3><p>Kamu sudah membuka seluruh {cards.length} jawaban. Tidak ada XP yang diberikan.</p><button type="button" className="sj-practice-primary" onClick={close}>Kembali ke perjalanan</button></div>
      ) : !loading && card ? (
        <>
          <div className="sj-practice-position">Kartu {index + 1} / {cards.length}{seen.has(card.id) ? " · Jawaban pernah dibuka" : ""}</div>
          <div className="sj-practice-card"><p className="sj-practice-eyebrow">{flipped ? "Jawaban" : "Pertanyaan"}</p><p className="sj-practice-card-text" aria-live="polite">{flipped ? card.back : card.front}</p></div>
          <button type="button" className="sj-practice-flip" disabled={working} aria-pressed={flipped} onClick={() => {
            if (!flipped) setSeen((previous) => new Set(previous).add(card.id));
            setFlipped(!flipped);
          }}>{flipped ? "Lihat pertanyaan" : "Buka jawaban"}</button>
          <div className="sj-practice-navigation"><button type="button" disabled={index === 0 || working} onClick={() => move(index - 1)}>Sebelumnya</button><button type="button" disabled={index === cards.length - 1 || working} onClick={() => move(index + 1)}>Berikutnya</button></div>
          <div className="sj-practice-footer"><p>{allSeen ? "Semua jawaban sudah dibuka. Simpan aktivitasmu." : "Buka setiap jawaban untuk menyelesaikan latihan."}</p><button type="button" className="sj-practice-primary" disabled={!allSeen || working} onClick={finish}>{working ? "Menyimpan…" : "Simpan latihan"}</button></div>
          {error && <button type="button" className="sj-practice-reload" disabled={working} onClick={load}>Muat ulang kartu</button>}
        </>
      ) : !loading && <div className="sj-practice-empty"><p>Buat satu set kartu dari catatan ini. Kartu akan disimpan agar bisa dipakai lagi.</p><button type="button" className="sj-practice-primary" disabled={working} onClick={prepare}>{working ? "Menyiapkan kartu…" : "Siapkan kartu latihan"}</button>{error && <button type="button" disabled={working} onClick={load}>Coba muat ulang</button>}</div>}
    </dialog>
  );
}
