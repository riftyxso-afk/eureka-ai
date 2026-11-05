"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { useI18n } from "@/context/LocaleContext";
import { parseFirstNoteGuide, readFirstNoteGuide, setFirstNoteGuide, subscribeFirstNoteGuide } from "@/lib/firstNoteGuide";

const serverSnapshot = () => "";

export function useFirstNoteGuide() {
  return parseFirstNoteGuide(useSyncExternalStore(subscribeFirstNoteGuide, readFirstNoteGuide, serverSnapshot));
}

export default function FirstNoteGuide({ inNotes = false }: { inNotes?: boolean }) {
  const guide = useFirstNoteGuide();
  const { locale } = useI18n();
  const en = locale === "en";
  const notePath = guide?.stage === "ready" && guide.noteId
    ? `/${locale}/dashboard/note/${encodeURIComponent(guide.noteId)}`
    : "";

  if (!guide || guide.stage === "done" || guide.stage === "skipped") return null;
  const ready = Boolean(notePath);
  const heading = ready ? (en ? "Your note is ready" : "Catatan Anda siap") : (en ? "Create your first note with Momo" : "Buat catatan pertama bersama Momo");
  const text = ready
    ? (en ? "Open your note to read the summary and chapters." : "Buka catatan untuk membaca ringkasan dan bab yang sudah disusun.")
    : inNotes
      ? (en ? "Choose New note. Momo will guide you through each step." : "Pilih Buat catatan. Momo akan mendampingi Anda di setiap langkah.")
      : (en ? "Bring a link, document, or question. Momo will walk you through creating a note." : "Siapkan tautan, dokumen, atau soal. Momo akan memandu Anda membuat catatan.");

  return (
    <section aria-labelledby="first-note-guide-title" className="mx-auto mt-4 flex w-full max-w-5xl items-start gap-3 rounded-2xl border border-clay-primary/20 bg-clay-cream p-4 sm:gap-4 sm:p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-clay-primary/10 text-clay-primary"><BookOpen size={19} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <h2 id="first-note-guide-title" className="text-base font-extrabold text-clay-dark">{heading}</h2>
        <p className="mt-1 text-sm leading-relaxed text-clay-muted">{text}</p>
        <div className="mt-2 flex flex-wrap gap-x-4">
          {ready ? <Link className="inline-flex min-h-11 items-center gap-2 font-bold text-clay-primary" href={notePath}>{en ? "Open note" : "Buka catatan"} <ArrowRight size={16} aria-hidden="true" /></Link> : !inNotes ? (
            <Link className="inline-flex min-h-11 items-center gap-2 font-bold text-clay-primary" href={`/${locale}/dashboard/catatan`} onClick={() => {
              if (guide.stage === "welcome") setFirstNoteGuide({ stage: "active" });
            }}>{en ? "Go to Notes" : "Ke halaman Catatan"} <ArrowRight size={16} aria-hidden="true" /></Link>
          ) : null}
          <button type="button" className="min-h-11 text-sm font-bold text-clay-muted underline-offset-4 hover:underline" onClick={() => setFirstNoteGuide({ stage: "skipped" })}>{en ? "Skip guide" : "Lewati panduan"}</button>
        </div>
      </div>
    </section>
  );
}
