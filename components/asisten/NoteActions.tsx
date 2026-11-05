"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/context/LocaleContext";
import { apiFetch } from "@/lib/apiClient";
import { getSession } from "@/lib/auth";
import type { Note } from "@/lib/types";
import type { NoteCommand } from "@/lib/assistant/noteCommands";

export default function NoteActions({ command, onClose, onChoose }: { command: NoteCommand; onClose: () => void; onChoose: (command: NoteCommand) => void }) {
  const { locale } = useI18n();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [query, setQuery] = useState(command.action === "create" ? "" : command.title);
  const [selected, select] = useState<Note | null>(null);
  const [title, setTitle] = useState(command.action === "create" ? command.title : "");
  const [summary, setSummary] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ title: string; id?: string } | null>(null);
  const locked = useRef(false);
  const creationId = useRef<string | null>(null);
  const account = useRef(getSession()?.userId);
  const { action } = command;

  async function request(path: string, init?: RequestInit) {
    if (!account.current || account.current !== getSession()?.userId) throw new Error("Silakan masuk kembali untuk membuka catatan Anda.");
    const response = await apiFetch(path, init);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Permintaan belum berhasil.");
    return data;
  }

  async function run(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try { await work(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Permintaan belum berhasil."); }
    finally { locked.current = false; setBusy(false); }
  }

  const loadNotes = () => run(async () => {
    const data = await request(`/api/notes?userId=${encodeURIComponent(account.current ?? "")}`);
    setNotes(data.notes ?? []);
  });

  const apply = () => run(async () => {
    if (!review || result) return;
    const creating = action === "create";
    if (!creating && !selected) return;
    if (creating && !creationId.current) creationId.current = crypto.randomUUID();
    const path = creating ? "/api/notes" : `/api/notes/${encodeURIComponent(selected!.id)}`;
    const data = await request(path, action === "delete" ? { method: "DELETE" } : {
      method: creating ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creating ? { id: creationId.current, title: title.trim(), summary: summary.trim() } : { title: title.trim() }),
    });
    setResult(action === "delete" ? { title: selected!.title } : { title: data.note.title, id: data.note.id });
    window.dispatchEvent(new Event("note-ready"));
  });

  const noteHref = (id: string) => `/${locale}/dashboard/note/${encodeURIComponent(id)}`;
  const matches = notes?.filter((note) => note.title.toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  const editing = action === "create" || (action === "rename" && selected);
  const canReview = action === "delete" ? Boolean(selected) : Boolean(title.trim() && (action !== "create" || summary.trim()));

  return (
    <section aria-label="Aksi catatan Momo" className="mb-2 max-h-[46dvh] overflow-y-auto overscroll-contain rounded-xl border border-clay-primary/25 bg-clay-cream p-3 text-sm text-clay-dark">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-extrabold">Momo · {{ list: "Catatan Anda", create: "Buat catatan", rename: "Ubah judul", delete: "Hapus catatan" }[action]}</h2>
        <button type="button" disabled={busy} onClick={onClose} className="min-h-11 px-2 font-bold text-clay-muted">Tutup</button>
      </div>
      {error && <p role="alert" className="my-2 text-red-700 dark:text-red-300">{error}</p>}
      {action === "list" && (
        <div className="mb-2 flex flex-wrap gap-2">
          {([["create", "Buat"], ["rename", "Ubah judul"], ["delete", "Hapus"]] as const).map(([mode, label]) => (
            <button type="button" key={mode} disabled={busy} onClick={() => onChoose({ action: mode, title: "" })} className="min-h-11 rounded-lg bg-clay-primary/10 px-3 font-bold">{label}</button>
          ))}
        </div>
      )}
      {result ? (
        <p role="status">“{result.title}” {result.id ? <>tersimpan. <Link href={noteHref(result.id)} className="font-bold underline">Buka catatan</Link></> : "sudah dihapus."}</p>
      ) : review ? (
        <div className="space-y-2">
          <p className="break-words">{action === "delete" ? <>Hapus permanen “{selected?.title}”?</> : action === "rename" ? <>Ubah “{selected?.title}” menjadi “{title.trim()}”?</> : <>Simpan “{title.trim()}”?</>}</p>
          {action === "create" && <p className="whitespace-pre-wrap break-words">{summary.trim()}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void apply()} className={`min-h-11 rounded-lg px-3 font-bold text-white ${action === "delete" ? "bg-red-700" : "bg-violet-700"}`}>{busy ? "Memproses…" : action === "delete" ? "Ya, hapus" : "Simpan catatan"}</button>
            <button type="button" disabled={busy} onClick={() => setReview(false)} className="min-h-11 px-3 font-bold">Kembali</button>
          </div>
        </div>
      ) : editing ? (
        <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); if (canReview) setReview(true); }}>
          <label className="grid gap-1">Judul<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} className="input-clay min-h-11 w-full" /></label>
          {action === "create" && <label className="grid gap-1">Isi catatan<textarea value={summary} onChange={(event) => setSummary(event.target.value)} required maxLength={1200} rows={3} className="input-clay w-full" /></label>}
          <button type="submit" disabled={!canReview} className="min-h-11 justify-self-start rounded-lg bg-violet-700 px-3 font-bold text-white disabled:opacity-50">Tinjau perubahan</button>
        </form>
      ) : notes === null ? (
        <button type="button" disabled={busy} onClick={() => void loadNotes()} className="min-h-11 rounded-lg bg-violet-700 px-3 font-bold text-white">{busy ? "Memuat…" : "Muat catatan saya"}</button>
      ) : (
        <>
          <label className="grid gap-1">Cari judul<input value={query} onChange={(event) => setQuery(event.target.value)} className="input-clay min-h-11 w-full" /></label>
          <ul className="mt-2 divide-y divide-clay-primary/15">
            {matches.map((note) => <li key={note.id}>
              {action === "list" ? <Link className="flex min-h-11 items-center break-words py-2 font-bold" href={noteHref(note.id)}>{note.title}</Link> : (
                <button type="button" className="min-h-11 w-full break-words py-2 text-start font-bold" onClick={() => {
                  select(note);
                  setTitle(note.title);
                  if (action === "delete") setReview(true);
                }}>{note.title}<span className="block text-xs font-normal text-clay-muted">{note.subject} · {new Date(note.createdAt).toLocaleDateString(locale)}</span></button>
              )}
            </li>)}
          </ul>
          {matches.length === 0 && <p className="mt-2 text-clay-muted">Tidak ada catatan yang cocok.</p>}
        </>
      )}
    </section>
  );
}
