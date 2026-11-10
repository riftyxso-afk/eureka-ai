"use client";

import Image from "next/image";
import "./mobile.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import ArrowRight from "kubai-icons-react/icons/arrow-right";
import BookOpen from "kubai-icons-react/icons/book-open";
import FileText from "kubai-icons-react/icons/file-text";
import Flame from "kubai-icons-react/icons/flame";
import FolderOpen from "kubai-icons-react/icons/folder-open";
import Globe from "kubai-icons-react/icons/globe";
import Grid2X2 from "kubai-icons-react/icons/grid";
import History from "kubai-icons-react/icons/history";
import List from "kubai-icons-react/icons/list";
import MessageCircle from "kubai-icons-react/icons/message-circle";
import Search from "kubai-icons-react/icons/search";
import Trophy from "kubai-icons-react/icons/trophy";
import Crown from "kubai-icons-react/icons/crown";
import Plus from "kubai-icons-react/icons/circle-plus";
import RefreshCw from "kubai-icons-react/icons/sync";
import { PhoneCall, Upload } from "lucide-react";
import PromptBar from "@/components/asisten/reactbits/PromptBar";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import DocumentAttachments from "@/components/dashboard/DocumentAttachments";
import V2MobileSidebar from "@/components/dashboard/V2MobileSidebar";
import PageTutorial from "@/components/tutorial/PageTutorial";
import { usePromptNoteJob } from "@/components/dashboard/usePromptNoteJob";
import PromptNoteProgress from "@/components/dashboard/PromptNoteProgress";
import SpeechInput from "@/components/asisten/SpeechInput";
import AiCallModal from "@/components/assistant/AiCallModal";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { supabase } from "@/lib/supabase/client";
import { PENDING_PROMPT_KEY, type PendingPrompt } from "@/lib/assistant/pendingPrompt";
import type { Note } from "@/lib/types";
import type { NoteCreatePrefs } from "@/components/note/NoteCreateWizard";
import "./v2.css";
import "./simple-home.css";

const FILTERS = ["Semua", "Dokumen", "Web", "YouTube", "Audio"];
function sourceOf(note: Note) {
  if (/youtu\.be|youtube\.com/i.test(note.sourceUrl ?? "")) return "YouTube";
  if (note.sourceUrl) return "Web";
  return ["Dokumen", "Audio", "YouTube", "Web"].includes(note.subject) ? note.subject : "Catatan";
}

export default function DashboardV2() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [subject, setSubject] = useState("");
  const [view, setView] = useState("grid");
  const generation = usePromptNoteJob();
  const [mode, setMode] = useState<"ask" | "note">("ask");
  const [openingChat, setOpeningChat] = useState(false);
  const chatLock = useRef(false);
  const [effort, setEffort] = useState("Seimbang");
  const [stats, setStats] = useState<{ streak: number; level: number } | null>(null);
  const [inputError, setInputError] = useState("");
  const [callOpen, setCallOpen] = useState(false);
  useEffect(() => {
    if (generation.job?.status === "done" && generation.job.noteId) router.push(`/dashboard-v2/note/${encodeURIComponent(generation.job.noteId)}`);
  }, [generation.job?.status, generation.job?.noteId, router]);
  function attach(selected: FileList | null) {
    if (!selected?.length || generation.busy || chatLock.current) return;
    const incoming = Array.from(selected);
    if (files.length + incoming.length > 5) { setInputError("Lampirkan maksimal 5 file."); return; }
    if (incoming.some(file => !file.size || file.size > 4 * 1024 * 1024)) { setInputError("Setiap file harus berisi materi dan berukuran maksimal 4 MB."); return; }
    if (incoming.some(file => !/\.(pdf|doc|docx|ppt|pptx|xlsx|xls|csv|txt|md|rtf|odt|mp3|wav|m4a|ogg|flac|aac|mp4|webm|mov)$/i.test(file.name))) { setInputError("Gunakan dokumen PDF/Office/teks, audio, atau video yang didukung."); return; }
    setMode("note");
    setFiles(previous => [...previous, ...incoming]); setInputError("");
    if (!draft.trim()) setDraft("Buat catatan lengkap dari materi terlampir.");
  }
  function chooseNotePrompt(value: string) {
    if (generation.busy || chatLock.current) return;
    setMode("note");
    setInputError("");
    setDraft(value);
  }
  async function askMomo(question: string) {
    if (!question || chatLock.current) return;
    chatLock.current = true;
    setOpeningChat(true);
    setInputError("");
    try {
      const userId = (await supabase?.auth.getSession())?.data.session?.user.id;
      if (!userId) throw new Error("Masuk ke akunmu untuk memulai percakapan.");
      const response = await apiFetch("/api/assistant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.session?.id !== "string") {
        throw new Error(data.error || "Percakapan belum bisa dibuat.");
      }
      const pending: PendingPrompt = {
        prompt: question,
        sessionId: data.session.id,
        speedMode: effort === "Kilat" ? "fast" : effort === "Mendalam" ? "deep" : "normal",
      };
      sessionStorage.setItem(PENDING_PROMPT_KEY, JSON.stringify(pending));
      router.push(`/dashboard-v2/tanya-momo/${encodeURIComponent(data.session.id)}`);
    } catch (error) {
      chatLock.current = false;
      setOpeningChat(false);
      setInputError(error instanceof Error ? error.message : "Percakapan belum bisa dibuat.");
    }
  }
  function removeAttachment(index: number) {
    setFiles(previous => previous.filter((_, item) => item !== index));
    if (files.length === 1 && draft === "Buat catatan lengkap dari materi terlampir.") setDraft("");
  }
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError("");
    try {
      const response = await apiFetch(`/api/notes?userId=${encodeURIComponent(getUserId())}`, { signal });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.notes)) throw new Error(data.error || "Catatan belum bisa dimuat.");
      setNotes(data.notes);
    } catch (error) { if (!signal?.aborted) setLoadError(error instanceof Error ? error.message : "Catatan belum bisa dimuat."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setSubject(new URLSearchParams(window.location.search).get("subject") ?? "");
    void load(controller.signal);
    void apiFetch(`/api/progress?userId=${encodeURIComponent(getUserId())}`, { signal: controller.signal }).then(async response => {
      if (response.ok) { const data = await response.json(); if (data.stats) setStats(data.stats); }
    }).catch(() => {});
    const refresh = () => void load(controller.signal);
    window.addEventListener("note-ready", refresh);
    return () => { controller.abort(); window.removeEventListener("note-ready", refresh); };
  }, [load]);
  const shown = useMemo(() => notes.filter(note => (filter === "Semua" || sourceOf(note) === filter) && (!subject || note.subject === subject) && `${note.title} ${note.summary ?? ""}`.toLocaleLowerCase("id").includes(query.toLocaleLowerCase("id"))).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt)), [notes, query, subject, filter]);
  const prefs: NoteCreatePrefs = { generationMode: effort === "Mendalam" ? "lengkap" : "cepat", chapterCount: effort === "Kilat" ? 2 : effort === "Mendalam" ? 5 : 3, studyMode: effort === "Kilat" ? "ringkas" : effort === "Mendalam" ? "lengkap" : "standar", noteType: "rangkuman" };
  function submit(text: string) {
    if (generation.busy || chatLock.current) return;
    if (mode === "ask") { void askMomo(text.trim()); return; }
    if (files.length) { setInputError(""); void generation.start(text.trim() || "Buat catatan dari materi terlampir", prefs, files); return; }
    if (text.trim().length < 10) { setInputError("Ceritakan topikmu sedikit lebih lengkap, minimal 10 karakter."); return; }
    setInputError("");
    const topic = text.trim().replace(/^(buatkan|buat|bikin)\s+(catatan\s+)?(tentang\s+)?/i, "");
    if (topic.length < 10 || topic.length > 2000) { setInputError("Isi topik belajar antara 10 dan 2.000 karakter."); return; }
    void generation.start(`Buat catatan tentang ${topic}`, prefs);
  }
  return <div className="dv2 dv2-simple">
    <header className="dv2-topbar">
      <V2MobileSidebar desktop />
      <Link className="dv2-brand" href="/dashboard-v2"><Image src="/icons/momo-192.png" alt="" width={32} height={32} className="eureka-brand-mark" />eureka! <span>V2 · Beta</span></Link>
      <nav aria-label="Navigasi Dashboard V2" className="dv2-topnav"><Link href="/dashboard-v2#dv2-notes-title"><FolderOpen trigger="parent" size={16} />Catatan</Link><Link href="/dashboard-v2/tanya-momo"><MessageCircle trigger="parent" size={16} />Tanya Momo</Link></nav>
      <div className="dv2-account"><ThemeSwitch /><PageTutorial guideId="dashboard" /><Link href="/dashboard/streaks" className="dv2-stat dv2-streak"><Flame trigger="parent" size={16} />{stats ? `${stats.streak} hari` : "Streak"}</Link><Link href="/dashboard/profil" className="dv2-stat dv2-level"><Trophy trigger="parent" size={16} />{stats ? `Level ${stats.level}` : "Profil"}</Link><Link href="/pricing" className="dv2-stat dv2-upgrade"><Crown trigger="parent" size={16} />Upgrade</Link></div>
    </header>
    <main className="dv2-main">
      <section className="dv2-workspace" aria-labelledby="dv2-title">
        <div className="dv2-greeting"><div className="dv2-momo"><MomoCompanion mode={effort === "Kilat" ? "fast" : effort === "Mendalam" ? "deep" : "normal"} thinking={openingChat} question={draft} /></div><h1 id="dv2-title">Mau belajar apa hari ini?</h1></div>
        <div className="dv2-compose-area">
          {generation.job ? <PromptNoteProgress generation={generation} /> : <>
          {mode === "note" && files.length > 0 && <DocumentAttachments files={files} onRemove={removeAttachment} />}
          <div className="dv2-prompt">
            <PromptBar clearOnSend={false} value={draft} onDraftChange={setDraft}
              placeholder={mode === "ask" ? "Tanya Momo apa saja…" : "Tulis topik atau tempel tautan materi…"}
              onSend={submit} disabled={openingChat} background="transparent" color="var(--v2-ink)"
              menuBackground="var(--v2-popover)" sparkColor="transparent" width={700}
              models={[]} efforts={["Kilat", "Seimbang", "Mendalam"]} defaultEffort={effort}
              onEffortChange={setEffort} commands={[]}
              leadingSlot={<div className="dv2-mode-slider" role="group" aria-label="Mode prompt" data-mode={mode}>
                <span className="dv2-mode-indicator" aria-hidden="true" />
                <button type="button" aria-pressed={mode === "ask"} disabled={openingChat}
                  onClick={() => { setMode("ask"); setInputError(""); }}>Chat</button>
                <button type="button" aria-pressed={mode === "note"} disabled={openingChat}
                  onClick={() => { setMode("note"); setInputError(""); }}>Note</button>
              </div>}
              voiceSlot={<SpeechInput userId={getUserId()} disabled={openingChat || generation.busy}
                  onText={text => { setInputError(""); setDraft(previous => previous + (previous && !/\s$/.test(previous) ? " " : "") + text); }}
                  onError={setInputError} />}
              sources={[
                ...(mode === "ask" && !openingChat ? [{ key: "momo-call", name: "Panggilan Momo", description: "Ngobrol langsung dengan suara", icon: <PhoneCall size={16} />, action: () => setCallOpen(true) }] : []),
                { key: "upload", name: "Unggah materi", description: "Dokumen, slide, atau audio", icon: <Upload size={16} /> },
                { key: "web", name: "Tautan web", description: "Ringkas artikel menjadi catatan", icon: <Globe trigger="parent" size={16} /> },
                { key: "youtube", name: "YouTube", description: "Pelajari isi video", icon: <span className="dv2-youtube-logo" aria-hidden="true" /> },
              ]}
              onAttach={() => fileInput.current?.click()}
              onSourceSelect={source => source.key === "upload" ? fileInput.current?.click() : chooseNotePrompt(`Buat catatan dari ${source.key === "youtube" ? "video YouTube" : "artikel web"}: `)} />
          </div>

        {inputError && <p className="dv2-error" role="alert">{inputError}</p>}
        {openingChat && <p className="dv2-chat-opening" role="status">Membuka percakapan…</p>}
        </>}
        </div>

      </section>
      <section className="dv2-library" aria-labelledby="dv2-notes-title"><div className="dv2-library-heading"><div><h2 id="dv2-notes-title">Catatanmu <span>{notes.length}</span></h2><p>Simpan rasa ingin tahu. Lanjutkan kapan saja.</p></div><button className="dv2-button" onClick={() => fileInput.current?.click()}><Plus trigger="parent" size={16} />Tambah materi</button></div>
        <div className="dv2-library-tools"><div className="dv2-toolbar"><label className="dv2-search"><Search trigger="parent" size={16} /><input aria-label="Cari catatan" placeholder="Cari judul atau isi catatan…" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filter mata pelajaran" value={subject} onChange={event => setSubject(event.target.value)}><option value="">Semua mata pelajaran</option>{[...new Set(notes.map(note => note.subject))].sort().map(value => <option key={value}>{value}</option>)}</select><div className="dv2-view" role="group" aria-label="Tampilan catatan"><button aria-label="Galeri" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 trigger="parent" size={17} /></button><button aria-label="Daftar" aria-pressed={view === "list"} onClick={() => setView("list")}><List trigger="parent" size={18} /></button></div></div>
        <div className="dv2-filters" role="group" aria-label="Jenis sumber">{FILTERS.map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}<button onClick={() => void load()} aria-label="Muat ulang catatan"><RefreshCw trigger="parent" size={15} /></button></div>
        </div>{loading ? <div className="dv2-note-grid" role="status" aria-label="Memuat catatan">{[1, 2, 3].map(id => <div className="dv2-skeleton" key={id} />)}</div> : loadError ? <div className="dv2-empty" role="alert"><History trigger="parent" size={28} /><h3>Catatan belum bisa dimuat</h3><p>{loadError}</p><button className="dv2-button" onClick={() => void load()}>Coba lagi</button></div> : shown.length === 0 ? <div className="dv2-empty"><BookOpen trigger="parent" size={32} /><h3>{notes.length ? "Belum ada catatan yang cocok" : "Catatan pertamamu dimulai dari sebuah ide"}</h3><p>{notes.length ? "Coba kata kunci atau filter lain." : "Tulis topik di atas, tempel tautan, atau unggah materi untuk mulai belajar."}</p>{notes.length > 0 && <button className="dv2-button" onClick={() => { setQuery(""); setFilter("Semua"); setSubject(""); }}>Reset filter</button>}</div> : <div className={`dv2-note-grid ${view === "list" ? "is-list" : ""}`}>{shown.map(note => <Link className="dv2-note" key={note.id} href={`/dashboard-v2/note/${encodeURIComponent(note.id)}`}><div className="dv2-note-preview"><span className="dv2-note-type"><FileText trigger="parent" size={13} />{sourceOf(note)}</span><h3>{note.title}</h3><p>{note.summary || "Buka catatan untuk membaca materi dan bab selengkapnya."}</p></div><div className="dv2-note-info"><strong>{note.title}</strong><span>{new Date(note.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}{note.pinned ? " · Disematkan" : ""}<ArrowRight trigger="parent" size={16} /></span></div></Link>)}</div>}
      </section>
    </main>
    <AiCallModal open={callOpen} onClose={() => setCallOpen(false)} />
    <input ref={fileInput} className="sr-only" type="file" multiple aria-label="Lampirkan materi belajar" accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.xls,.csv,.txt,.md,.rtf,.odt,.mp3,.wav,.m4a,.ogg,.flac,.aac,.mp4,.webm,.mov" onChange={event => { attach(event.target.files); event.target.value = ""; }} />
  </div>;
}
