"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  Loader2,
  NotebookPen,
} from "lucide-react";
import { NoteFlow } from "@/components/note/NoteFlow";

interface Chapter {
  id: number;
  title: string;
  content: string;
  timestamp?: string;
  flow?: string[];
}

interface NoteInfo {
  id: string;
  title: string;
  subject: string;
  createdAt?: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";

interface ParagraphBlock {
  type: "text" | "list";
  lines: string[];
}

/** Ubah teks bab menjadi paragraf rapi + deteksi bullet list. */
function toParagraphs(content: string): ParagraphBlock[] {
  const rawLines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length <= 1) {
    const sentences = content
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const paragraphs: ParagraphBlock[] = [];
    let buffer: string[] = [];
    for (const s of sentences) {
      buffer.push(s);
      if (buffer.length >= 3) {
        paragraphs.push({ type: "text", lines: [buffer.join(" ")] });
        buffer = [];
      }
    }
    if (buffer.length > 0) {
      paragraphs.push({ type: "text", lines: [buffer.join(" ")] });
    }
    return paragraphs;
  }

  const blocks: ParagraphBlock[] = [];
  let buffer: string[] = [];
  let isList = false;

  const flush = () => {
    if (buffer.length === 0) return;
    blocks.push({ type: isList ? "list" : "text", lines: [...buffer] });
    buffer = [];
  };

  for (const line of rawLines) {
    const listMatch = line.match(/^([-•*]|\d+[.)])\s+(.*)$/);
    const isLineList = listMatch !== null;
    if (isLineList !== isList && buffer.length > 0) flush();
    if (isLineList && listMatch) {
      buffer.push(listMatch[2]);
      isList = true;
    } else {
      buffer.push(line);
      isList = false;
    }
  }
  flush();
  return blocks;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ChapterNotepadPage() {
  const params = useParams<{ id: string; chapterId: string }>();
  const [note, setNote] = useState<NoteInfo | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [prev, setPrev] = useState<Chapter | null>(null);
  const [next, setNext] = useState<Chapter | null>(null);
  const [userNote, setUserNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/notes/${params.id}/bab/${params.chapterId}`
        );
        if (res.ok) {
          const data = await res.json();
          setNote(data.note);
          setChapter(data.chapter);
          setPrev(data.prev);
          setNext(data.next);
          setUserNote(data.userNote ?? "");
        } else {
          throw new Error("Gagal memuat bab");
        }
      } catch {
        // Biarkan state kosong, UI menampilkan pesan error
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, params.chapterId]);

  const saveUserNote = useCallback(
    async (content: string) => {
      setSaveState("saving");
      try {
        const res = await fetch(
          `/api/notes/${params.id}/bab/${params.chapterId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          }
        );
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
      saveTimer.current = setTimeout(() => {
        if (saveState !== "saving") setSaveState("idle");
      }, 2000);
    },
    [params.id, params.chapterId, saveState]
  );

  const handleUserNoteChange = (value: string) => {
    setUserNote(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveUserNote(value), 600);
  };

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
        <div className="card-clay flex items-center justify-center py-16 text-clay-muted">
          <p className="text-base font-extrabold">Memuat bab...</p>
        </div>
      </div>
    );
  }

  if (!note || !chapter) {
    return (
      <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
        <div className="card-clay flex flex-col items-center gap-4 py-16 text-center text-clay-muted">
          <p className="text-base font-extrabold">
            Bab tidak ditemukan atau sedang tidak tersedia.
          </p>
          <Link href={`/dashboard/note/${params.id}`} className="btn-clay-ghost !min-h-[44px] !px-4 text-sm">
            <ArrowLeft size={16} className="mr-2" />
            Kembali ke catatan
          </Link>
        </div>
      </div>
    );
  }

  const blocks = toParagraphs(chapter.content);

  return (
    <div className="mx-auto w-full max-w-clay px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href={`/dashboard/note/${note.id}`}
            aria-label="Kembali ke catatan"
            className="btn-clay-ghost shrink-0 !min-h-[44px] !px-3"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-clay-muted">
              Bab {chapter.id} · {note.title}
            </div>
            <h1 className="mt-1 line-clamp-2 text-lg font-extrabold text-clay-dark sm:text-xl">
              {chapter.title}
            </h1>
          </div>
        </div>
        {chapter.timestamp && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-clay-beige px-3 py-1.5 text-xs font-bold text-clay-muted">
            <Clock size={14} />
            {chapter.timestamp}
          </div>
        )}
      </div>

      {/* Isi bab */}
      <div className="card-clay p-6 sm:p-8">
        <div className="space-y-4 text-[15px] font-medium leading-relaxed text-clay-dark sm:text-base">
          {blocks.map((block, i) =>
            block.type === "list" ? (
              <ul key={i} className="list-disc space-y-1.5 pl-5">
                {block.lines.map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ul>
            ) : (
              <p key={i}>{block.lines[0]}</p>
            )
          )}
        </div>

        <NoteFlow flow={chapter.flow ?? []} />
      </div>

      {/* Notepad pribadi */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NotebookPen size={18} className="text-clay-primary" />
            <h2 className="text-lg font-extrabold text-clay-dark">
              Catatan Pribadi
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-clay-muted">
            {saveState === "saving" && (
              <>
                <Loader2 size={14} className="animate-spin" />
                Menyimpan...
              </>
            )}
            {saveState === "saved" && (
              <>
                <Check size={14} className="text-green-600" />
                Tersimpan
              </>
            )}
            {saveState === "error" && (
              <span className="text-red-500">Gagal menyimpan</span>
            )}
          </div>
        </div>
        <textarea
          value={userNote}
          onChange={(e) => handleUserNoteChange(e.target.value)}
          placeholder="Tulis catatanmu untuk bab ini... (tersimpan otomatis)"
          className="input-clay min-h-[180px] w-full resize-y !rounded-2xl !text-base !font-medium !leading-relaxed"
        />
      </div>

      {/* Navigasi bab */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t-2 border-clay-shadow/20 pt-5">
        {prev ? (
          <Link
            href={`/dashboard/note/${note.id}/bab/${prev.id}`}
            className="btn-clay-ghost flex-1 !min-h-[52px] !px-4 text-left"
          >
            <ChevronLeft size={18} className="mr-1 shrink-0 text-clay-primary" />
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-clay-muted">
                Bab {prev.id}
              </span>
              <span className="block truncate text-sm font-extrabold text-clay-dark">
                {prev.title}
              </span>
            </span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}
        {next ? (
          <Link
            href={`/dashboard/note/${note.id}/bab/${next.id}`}
            className="btn-clay-ghost flex-1 !min-h-[52px] !px-4 text-right"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-clay-muted">
                Bab {next.id}
              </span>
              <span className="block truncate text-sm font-extrabold text-clay-dark">
                {next.title}
              </span>
            </span>
            <ChevronRight size={18} className="ml-1 shrink-0 text-clay-primary" />
          </Link>
        ) : (
          <span className="flex-1" />
        )}
      </div>

      <div className="mt-4 text-center text-xs font-semibold text-clay-muted">
        {note.subject}
        {note.createdAt ? ` · ${formatDate(note.createdAt)}` : ""}
      </div>
    </div>
  );
}
