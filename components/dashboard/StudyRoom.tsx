"use client";


import Image from "next/image";
import { toast } from "@yusufceng1z/ding-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ThemeSwitch from "@/components/ui/ThemeSwitch";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import type { StudyRoomTab } from "@/lib/studyRoom";
import ArrowRight from "kubai-icons-react/icons/arrow-right";
import BookOpen from "kubai-icons-react/icons/book-open";
import FileText from "kubai-icons-react/icons/file-text";
import Headphones from "kubai-icons-react/icons/headphones";
import Layers from "kubai-icons-react/icons/layers";
import ListChecks from "kubai-icons-react/icons/list-checks";
import MessageCircle from "kubai-icons-react/icons/message-circle";
import Network from "kubai-icons-react/icons/network";
import NotebookPen from "kubai-icons-react/icons/notebook-pen";
import ExternalLink from "kubai-icons-react/icons/external-link";
import Flame from "kubai-icons-react/icons/flame";
import Trophy from "kubai-icons-react/icons/trophy";
import Crown from "kubai-icons-react/icons/crown";
import Check from "kubai-icons-react/icons/circle-check";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { useV2Progress } from "@/components/dashboard/V2Progress";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import V2MobileSidebar, { V2MenuArt } from "./V2MobileSidebar";
import PageTutorial from "@/components/tutorial/PageTutorial";
import RoomQuiz from "./RoomQuiz";
import RoomFlashcards from "./RoomFlashcards";
import "./study-practice.css";
import RoomMindmap from "./RoomMindmap";
import ChapterPath from "./ChapterPath";
import SourceMaterials from "./SourceMaterials";
import RoomPodcast from "./RoomPodcast";
import RoomChat from "./RoomChat";
import StickyBoard from "./StickyBoard";
import "./room-features.css";
import type { Note } from "@/lib/types";
import "./study-room.css";
import "@/app/dashboard-v2/mobile.css";
import "./study-comfort.css";

const DocumentEditor = dynamic(() => import("./DocumentEditor"), { ssr: false, loading: () => <p className="sr-loading" role="status">Menyiapkan editor…</p> });
const MENU = [
  { id: "learn", label: "Belajar", icon: BookOpen }, { id: "notes", label: "Catatan", icon: FileText },
  { id: "mindmap", label: "Mindmap", icon: Network }, { id: "quiz", label: "Kuis", icon: ListChecks },
  { id: "cards", label: "Flashcard", icon: Layers }, { id: "sources", label: "Sumber", icon: ExternalLink },
  { id: "ask", label: "Tanya Momo", icon: MessageCircle }, { id: "podcast", label: "Podcast", icon: Headphones },
  { id: "scratch", label: "Tempel", icon: NotebookPen },
] as const;
type Tab = typeof MENU[number]["id"];
function httpUrl(value?: string) { try { const url = new URL(value ?? ""); return /https?:/.test(url.protocol) ? url.href : null; } catch { return null; } }

export default function StudyRoom({ noteId, initialEditor = false, initialChapter = null, initialTab = "learn" }: { noteId: string; initialEditor?: boolean; initialChapter?: number | null; initialTab?: StudyRoomTab }) {
  const router = useRouter(); const pathname = usePathname();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>(initialEditor ? "notes" : initialTab);
  const [chapterId, setChapterId] = useState<number | null>(initialChapter);
  const [read, setRead] = useState<number[]>([]);
  const [sourceFiles, setSourceFiles] = useState<{ name: string; size: number }[]>([]);
  const [dirty, setDirty] = useState(false);
  const { stats } = useV2Progress();
  useEffect(() => { if (!matchMedia("(max-width:700px)").matches) return; const frame = requestAnimationFrame(() => document.querySelector('.sr-main')?.scrollIntoView({ block: "start" })); return () => cancelAnimationFrame(frame); }, [tab]);
  const key = `eureka:v2:reading:${getUserId()}:${noteId}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const response = await apiFetch(`/api/notes/${encodeURIComponent(noteId)}`, { signal });
      const data = await response.json();
      if (!response.ok || !data.note) throw new Error(data.error || "Materi belum bisa dimuat.");
      setNote({ ...data.note, chapters: data.chapters ?? data.note.chapters ?? [] });
    } catch (failure) { if (!signal?.aborted) setError(failure instanceof Error ? failure.message : "Materi belum bisa dimuat."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [noteId]);
  useEffect(() => {
    const controller = new AbortController(); void load(controller.signal);
    try {
      const values = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(values)) setRead(values.filter(value => Number.isInteger(value)));
      const files = JSON.parse(localStorage.getItem(`eureka:v2:sources:${getUserId()}:${noteId}`) || "[]");
      if (Array.isArray(files)) setSourceFiles(files.filter(file => typeof file.name === "string" && typeof file.size === "number"));
    } catch { /* Storage is optional; the account note still loads from the server. */ }
    return () => controller.abort();
  }, [load, key, noteId]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const chapters = note?.chapters ?? [];
  const completed = chapters.filter(chapter => read.includes(chapter.id)).length;
  const percent = chapters.length ? Math.round(completed / chapters.length * 100) : 0;
  const next = chapters.find(chapter => !read.includes(chapter.id)) ?? chapters[0];
  function navigate(value: Tab, id?: number | null) {
    if (dirty) { toast.warning("Simpan atau batalkan perubahan editor sebelum berpindah bagian."); return; }
    if (value === "quiz" || value === "cards") { router.push(`/dashboard-v2/note/${noteId}/${value === "quiz" ? "quiz" : "flashcards"}`); return; }
    if (/\/(quiz|flashcards)$/.test(pathname)) { router.push(`/dashboard-v2/note/${noteId}?tab=${value}${id !== undefined && id !== null ? `&chapter=${id}` : ""}`); return; }
    setTab(value); if (id !== undefined) setChapterId(id);
  }
  function toggleRead(id: number) {
    const values = read.includes(id) ? read.filter(value => value !== id) : [...read, id]; setRead(values);
    try { localStorage.setItem(key, JSON.stringify(values)); } catch { toast.warning("Progres belum tersimpan di perangkat ini."); }
  }
  const activeChapter = chapters.find(chapter => chapter.id === chapterId);
  const chapterIndex = chapters.findIndex(chapter => chapter.id === chapterId);
  const previousChapter = chapters[chapterIndex - 1];
  const followingChapter = chapters[chapterIndex + 1];
  const sources = [...new Map([...(note?.references ?? []), ...chapters.flatMap(chapter => chapter.sources ?? []), ...(note?.sourceUrl ? [{ title: "Materi sumber", url: note.sourceUrl, snippet: "" }] : [])].filter(source => httpUrl(source.url)).map(source => [source.url, source])).values()];
  return <div className="dv2 sr-room">
    <header className="dv2-topbar sr-topbar" onClickCapture={event => { if (dirty && event.target instanceof Element && event.target.closest("a")) { event.preventDefault(); toast.warning("Simpan atau batalkan perubahan editor sebelum berpindah halaman."); } }}><V2MobileSidebar sections={MENU.map(item => ({ id: item.id, label: item.label, active: tab === item.id, select: () => navigate(item.id) }))} /><Link className="dv2-brand" href="/dashboard-v2" onClick={event => { if (dirty) { event.preventDefault(); toast.warning("Simpan perubahan editor sebelum kembali."); } }}><Image src="/icons/momo-192.png" alt="" width={32} height={32} className="eureka-brand-mark" />eureka!<span>Ruang belajar</span></Link><span className="sr-breadcrumb">{note?.title ?? "Menyiapkan materi"}</span><div className="dv2-account"><ThemeSwitch /><PageTutorial guideId={`room-${tab}`} ready={!loading && !!note} /><Link className="dv2-stat dv2-streak" href="/dashboard-v2/aktivitas"><Flame trigger="parent" size={16} />{stats ? `${stats.streak} hari` : "Streak"}</Link><Link className="dv2-stat dv2-level" href="/dashboard-v2/profil"><Trophy trigger="parent" size={16} />{stats ? `Level ${stats.level}` : "Profil"}</Link><Link className="dv2-stat dv2-upgrade" href="/dashboard-v2/pricing"><Crown trigger="parent" size={16} />Upgrade</Link></div></header>
    <div className="sr-layout"><nav id="study-navigation" className="sr-nav" aria-label="Menu ruang belajar"><p className="sr-nav-caption">DALAM CATATAN INI</p>{MENU.map((item, index) => <button key={item.id} data-study-tool={item.id} aria-pressed={tab === item.id} onClick={() => navigate(item.id)}><V2MenuArt index={index} /><span>{item.label}</span>{(item.id === "mindmap" || item.id === "podcast") && <small className="rm-nav-beta">Beta</small>}</button>)}<div className="sr-nav-progress"><span>Progres membaca<strong>{completed}/{chapters.length} bab</strong></span><progress value={percent} max={100} aria-label="Bab yang sudah dibaca" /></div></nav>
      <main className={`sr-main ${tab === "mindmap" ? "is-mindmap" : ""}`}>
        {loading ? <div className="sr-loading" role="status"><div className="sr-momo"><MomoCompanion mode="fast" thinking /></div><p>Momo sedang membuka materi…</p></div> : error ? <div className="dv2-empty" role="alert"><h1>Materi belum bisa dibuka</h1><p>{error}</p><button className="dv2-button" onClick={() => void load()}>Coba lagi</button></div> : note && <>
          {tab === "learn" && <><div className="sr-hero"><div className="sr-momo"><MomoCompanion mode="fast" response={completed ? "Kamu sudah menyelesaikan satu langkah belajar!" : ""} /></div><div><p className="sr-eyebrow">RUANG BELAJARMU</p><h1>{note.title}</h1><div className="sr-progress"><progress value={percent} max={100} aria-label="Progres membaca" /><strong>{percent}%</strong></div></div></div><div className="sr-continue"><button className="dv2-button" disabled={!next} onClick={() => navigate("notes", next?.id)}>{completed ? "Lanjutkan" : "Mulai belajar"}<ArrowRight trigger="parent" size={17} /></button><div><small>Selanjutnya</small><strong>{next?.title ?? "Tambahkan materi untuk mulai belajar"}</strong></div></div><div className="sr-chapters-heading"><h2>Daftar bab</h2><span>{completed} dari {chapters.length} selesai</span></div><ChapterPath chapters={chapters} read={read} onOpen={id => navigate("notes", id)} /><p className="sr-local-hint">Progres membaca tersimpan di perangkat ini. Tandai bab selesai setelah mempelajarinya.</p></>}
          {tab === "notes" && <><div className="sr-section-heading"><div><p className="sr-eyebrow">EDITOR CATATAN</p><h1>Catatan dan bab</h1></div><select aria-label="Bagian catatan" value={chapterId ?? "summary"} onChange={event => navigate("notes", event.target.value === "summary" ? null : Number(event.target.value))}><option value="summary">Ringkasan</option>{chapters.map((chapter, index) => <option key={chapter.id} value={chapter.id}>Bab {index + 1} · {chapter.title}</option>)}</select></div><DocumentEditor key={`${note.id}:${chapterId ?? "summary"}`} noteId={note.id} title={note.title} content={activeChapter?.content ?? note.summary ?? ""} chapterId={activeChapter?.id} label={activeChapter?.title ?? "Ringkasan catatan"} onDirtyChange={setDirty} onSaved={(title, content, warning) => { setNote(current => current && ({ ...current, title, ...(activeChapter ? { chapters: current.chapters?.map(chapter => chapter.id === activeChapter.id ? { ...chapter, content } : chapter) } : { summary: content }) })); if (warning) toast.warning(warning); else toast.success("Perubahan tersimpan ke akunmu."); }} />{activeChapter && <div className="sr-reader-footer"><button className="dv2-button" onClick={() => toggleRead(activeChapter.id)}><Check trigger="parent" size={16} />{read.includes(activeChapter.id) ? "Tandai belum dibaca" : "Tandai sudah dibaca"}</button><button onClick={() => navigate("learn")}>Daftar bab</button></div>}<nav className="sr-chapter-pagination" aria-label="Navigasi bab">{activeChapter && <button disabled={!previousChapter} onClick={() => navigate("notes", previousChapter?.id)}><span>← Sebelumnya</span><strong>{previousChapter?.title ?? "Ini bab pertama"}</strong></button>}{followingChapter && <button onClick={() => navigate("notes", followingChapter.id)}><span>{activeChapter ? "Bab berikutnya" : "Mulai bab pertama"} →</span><strong>{followingChapter.title}</strong></button>}</nav></>}
          {tab === "quiz" && <RoomQuiz note={note} />}
          {tab === "cards" && <RoomFlashcards note={note} />}
          {tab === "mindmap" && <RoomMindmap note={note} onDirtyChange={setDirty} onOpen={id => navigate("notes", id)} onSaved={(id, title, content, warning) => { setNote(current => current && ({ ...current, title, ...(id !== null ? { chapters: current.chapters?.map(chapter => chapter.id === id ? { ...chapter, content } : chapter) } : { summary: content }) })); if (warning) toast.warning(warning); else toast.success("Perubahan tersimpan ke akunmu."); }} />}
          {tab === "sources" && <SourceMaterials files={sourceFiles} sources={sources} sourceUrl={note.sourceUrl} />}
          {tab === "ask" && <RoomChat noteId={note.id} title={note.title} />}
          {tab === "podcast" && <RoomPodcast noteId={note.id} title={note.title} />}

        </>}
        {note && <StickyBoard noteId={note.id} active={tab === "scratch"} />}
      </main>
    </div>
  </div>;
}
