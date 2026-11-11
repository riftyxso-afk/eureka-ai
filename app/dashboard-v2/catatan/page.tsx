"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ArrowRight from "kubai-icons-react/icons/arrow-right";
import BookOpen from "kubai-icons-react/icons/book-open";
import FileText from "kubai-icons-react/icons/file-text";
import Grid2X2 from "kubai-icons-react/icons/grid";
import History from "kubai-icons-react/icons/history";
import List from "kubai-icons-react/icons/list";
import Search from "kubai-icons-react/icons/search";
import Plus from "kubai-icons-react/icons/circle-plus";
import RefreshCw from "kubai-icons-react/icons/sync";
import V2FeaturePage from "@/components/dashboard/V2FeaturePage";
import ProGate from "@/components/ProGate";
import { usePremium } from "@/lib/usePremium";
import { useDashboardNotes } from "@/components/dashboard/useDashboardNotes";
import { noteSource as sourceOf } from "@/lib/dashboard-notes";
import "./notes.css";
const FILTERS = ["Semua", "Catatan", "Dokumen", "Web", "YouTube", "Audio", "Video"];
export default function NotesPage() {
  return <V2FeaturePage title="Catatan" art={1} guide="library"><ProGate><NotesCollection /></ProGate></V2FeaturePage>;
}
function NotesCollection() {
  const router = useRouter();
  const { isPremium, loading: planLoading } = usePremium();
  const { notes, loading, error: loadError, refresh: load } = useDashboardNotes(!planLoading && isPremium);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [subject, setSubject] = useState("");
  const [view, setView] = useState("grid");
  const [sort, setSort] = useState("newest");
  useEffect(() => { setSubject(new URLSearchParams(window.location.search).get("subject") ?? ""); }, []);
  const shown = useMemo(() => notes.filter(note => (filter === "Semua" || sourceOf(note) === filter) && (!subject || note.subject === subject) && (note.title + " " + (note.summary ?? "") + " " + note.subject).toLocaleLowerCase("id").includes(query.trim().toLocaleLowerCase("id"))).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (sort === "title" ? a.title.localeCompare(b.title, "id") : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt))), [notes, query, subject, filter, sort]);
  return <main className="notes-v2">      <section className="dv2-library" aria-labelledby="dv2-notes-title"><div className="dv2-library-heading"><div><h1 id="dv2-notes-title">Catatan <span>{loading ? "…" : loadError ? "—" : notes.length}</span></h1><p>Semua materi belajarmu, tertata di satu tempat.</p></div><button className="dv2-button" onClick={() => router.push("/dashboard-v2?mode=note")}><Plus trigger="parent" size={16} />Buat catatan</button></div>
        <div className="dv2-library-tools"><div className="dv2-toolbar"><label className="dv2-search"><Search trigger="parent" size={16} /><input type="search" aria-label="Cari catatan" placeholder="Cari judul atau isi catatan…" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filter mata pelajaran" value={subject} onChange={event => setSubject(event.target.value)}><option value="">Semua mata pelajaran</option>{subject && !notes.some(note => note.subject === subject) && <option value={subject}>{subject}</option>}{[...new Set(notes.map(note => note.subject))].sort().map(value => <option key={value}>{value}</option>)}</select><select aria-label="Urutkan catatan" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="title">Judul A–Z</option></select><div className="dv2-view" role="group" aria-label="Tampilan catatan"><button aria-label="Galeri" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 trigger="parent" size={17} /></button><button aria-label="Daftar" aria-pressed={view === "list"} onClick={() => setView("list")}><List trigger="parent" size={18} /></button></div></div>
        <div className="dv2-filters" role="group" aria-label="Jenis sumber">{FILTERS.map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}<button onClick={() => void load()} disabled={loading} aria-label="Muat ulang catatan"><RefreshCw trigger="parent" size={15} /></button></div>
        </div>{!planLoading && !isPremium ? <p className="dv2-empty">Tes pemahaman, catatan, dan bab tersedia di <Link href="/dashboard-v2/pricing">Eureka Pro</Link>.</p> : loading && !notes.length ? <div className="dv2-note-grid" role="status" aria-label="Memuat catatan">{[1, 2, 3].map(id => <div className="dv2-skeleton" key={id} />)}</div> : loadError ? <div className="dv2-empty" role="alert"><History trigger="parent" size={28} /><h3>Catatan belum bisa dimuat</h3><p>{loadError}</p><button className="dv2-button" onClick={() => void load()}>Coba lagi</button></div> : shown.length === 0 ? <div className="dv2-empty"><BookOpen trigger="parent" size={32} /><h3>{notes.length ? "Belum ada catatan yang cocok" : "Catatan pertamamu dimulai dari sebuah ide"}</h3><p>{notes.length ? "Coba kata kunci atau filter lain." : "Mulai dari topik, tautan, atau dokumen melalui tombol Buat catatan."}</p>{notes.length > 0 && <button className="dv2-button" onClick={() => { setQuery(""); setFilter("Semua"); setSubject(""); }}>Reset filter</button>}</div> : <div className={`dv2-note-grid ${view === "list" ? "is-list" : ""}`}>{shown.map(note => <Link className="dv2-note" key={note.id} href={`/dashboard-v2/note/${encodeURIComponent(note.id)}`}><div className="dv2-note-preview"><span className="dv2-note-type"><FileText trigger="parent" size={13} />{sourceOf(note)}</span><h3>{note.title}</h3><p>{note.summary || "Buka catatan untuk membaca materi dan bab selengkapnya."}</p></div><div className="dv2-note-info"><strong>{note.title}</strong><span>{note.createdAt ? new Date(note.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Tanggal belum tersedia"}{note.pinned ? " · Disematkan" : ""}<ArrowRight trigger="parent" size={16} /></span></div></Link>)}</div>}
      </section></main>;
}
