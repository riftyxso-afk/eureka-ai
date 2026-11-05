"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { getSession } from "@/lib/auth";
import type { TaskEntry } from "@/lib/tasks-store";
import type { TaskCommand } from "@/lib/assistant/taskCommands";

export default function TaskActions({ command, onClose, onChoose }: { command:TaskCommand; onClose:()=>void; onChoose:(command:TaskCommand)=>void }) {
  const [items, setItems] = useState<TaskEntry[] | null>(null);
  const [query, setQuery] = useState(command.action === "create" ? "" : command.title);
  const [selected, setSelected] = useState<TaskEntry | null>(null);
  const [title, setTitle] = useState(command.action === "create" ? command.title : "");
  const [date, setDate] = useState(command.dueDate ?? "");
  const [status, setStatus] = useState<"belum" | "progres" | "selesai">(command.status ?? "belum");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [finished, setFinished] = useState(false);
  const locked = useRef(false);
  const account = useRef(getSession()?.userId);
  const { action } = command;
  async function call(init?: RequestInit) {
    if (!account.current || getSession()?.userId !== account.current) throw new Error("Silakan masuk kembali untuk membuka tugas Anda.");
    const response = await apiFetch("/api/tasks", init);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Permintaan belum berhasil.");
    return data;
  }
  async function run(work:()=>Promise<void>, isCreate = false) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage("");
    try { await work(); }
    catch (error) {
      if (isCreate) { setFinished(true); setMessage("Tugas belum dapat dipastikan tersimpan. Periksa daftar tugas sebelum mencoba lagi."); }
      else setMessage(error instanceof Error ? error.message : "Permintaan belum berhasil.");
    } finally { locked.current = false; setBusy(false); }
  }
  const load = () => run(async () => { const data = await call(); setItems(data.tasks ?? []); });
  const apply = () => run(async () => {
    if (!review || finished) return;
    const payload = action === "delete" ? { action:"delete", taskId:selected?.id } : action === "create" ? { action:"add", title:title.trim(), dueDate:date } : { action:"update", taskId:selected?.id, title:title.trim(), dueDate:date, status };
    await call({ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(payload) });
    setFinished(true); setMessage(action === "delete" ? "Tugas sudah dihapus." : "Tugas berhasil disimpan.");
  }, action === "create");
  const matches = items?.filter(item => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [];
  const editing = action === "create" || (action === "update" && selected);

  return <section aria-label="Aksi tugas Momo" className="mb-2 max-h-[46dvh] overflow-y-auto overscroll-contain rounded-xl border border-clay-primary/25 bg-clay-cream p-3 text-sm text-clay-dark">
    <div className="flex items-center justify-between gap-2"><h2 className="font-extrabold">Momo · {{ list:"Tugas Anda", create:"Buat tugas", update:"Ubah tugas", delete:"Hapus tugas" }[action]}</h2><button type="button" disabled={busy} onClick={onClose} className="min-h-11 px-2 font-bold text-clay-muted">Tutup</button></div>
    {message && <p role={finished ? "status" : "alert"} className="my-2">{message}</p>}
    {finished ? <button type="button" className="min-h-11 font-bold text-clay-primary" onClick={() => onChoose({action:"list",title:""})}>Lihat daftar tugas</button> : <>
      {action === "list" && <div className="mb-2 flex flex-wrap gap-2">{([["create","Buat"],["update","Ubah"],["delete","Hapus"]] as const).map(([mode,label]) => <button type="button" key={mode} disabled={busy} className="min-h-11 rounded-lg bg-clay-primary/10 px-3 font-bold" onClick={() => onChoose({action:mode,title:""})}>{label}</button>)}</div>}
      {review ? <div className="space-y-2"><p>{action === "delete" ? <>Hapus “{selected?.title}”?</> : <>Simpan “{title.trim()}” dengan tenggat {date}{action === "update" ? ` dan status ${status}` : ""}?</>}</p><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void apply()} className={`min-h-11 rounded-lg px-3 font-bold text-white ${action === "delete" ? "bg-red-700" : "bg-violet-700"}`}>{busy ? "Memproses…" : action === "delete" ? "Ya, hapus" : "Simpan tugas"}</button><button type="button" disabled={busy} onClick={() => setReview(false)} className="min-h-11 px-3 font-bold">Kembali</button></div></div>
      : editing ? <form className="grid gap-2" onSubmit={event => { event.preventDefault(); if (title.trim() && date) setReview(true); }}><label className="grid gap-1">Nama tugas<input required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} className="input-clay min-h-11 w-full" /></label><label className="grid gap-1">Tenggat<input required type="date" value={date} onChange={event => setDate(event.target.value)} className="input-clay min-h-11 w-full" /></label>{action === "update" && <label className="grid gap-1">Status<select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="input-clay min-h-11 w-full"><option value="belum">Belum dimulai</option><option value="progres">Sedang dikerjakan</option><option value="selesai">Selesai</option></select></label>}<button type="submit" className="min-h-11 justify-self-start rounded-lg bg-violet-700 px-3 font-bold text-white">Tinjau perubahan</button></form>
      : items === null ? <button type="button" disabled={busy} onClick={() => void load()} className="min-h-11 rounded-lg bg-violet-700 px-3 font-bold text-white">{busy ? "Memuat…" : "Muat tugas saya"}</button>
      : <><label className="grid gap-1">Cari tugas<input value={query} onChange={event => setQuery(event.target.value)} className="input-clay min-h-11 w-full" /></label><ul className="mt-2 divide-y divide-clay-primary/15">{matches.map(item => <li key={item.id}>{action === "list" ? <div className="break-words py-2 font-bold">{item.title}<span className="block text-xs font-normal text-clay-muted">{item.dueDate} · {item.status}</span></div> : <button type="button" className="min-h-11 w-full break-words py-2 text-start font-bold" onClick={() => { setSelected(item); setTitle(item.title); setDate(command.dueDate ?? item.dueDate); setStatus(command.status ?? item.status); if (action === "delete") setReview(true); }}>{item.title}<span className="block text-xs font-normal text-clay-muted">{item.dueDate} · {item.status}</span></button>}</li>)}</ul>{matches.length === 0 && <p className="mt-2 text-clay-muted">Tidak ada tugas yang cocok.</p>}</>}
    </>}
  </section>;
}
