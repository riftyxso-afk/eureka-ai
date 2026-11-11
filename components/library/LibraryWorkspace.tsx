"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Search, X } from "lucide-react";
import { NoriHeadphonesSticker } from "stick-it-up";
import LoadingStatus from "@/components/ui/LoadingStatus";
import { apiFetch } from "@/lib/apiClient";
import type { LibraryBook, LibraryResult, LibrarySource } from "@/lib/library-catalog";
import StoryStudio from "./StoryStudio";
import "./library.css";

const colors = ["#254858", "#b54d43", "#606341", "#6a5185", "#a67637", "#416c79"];
export default function LibraryWorkspace() {
  const [tab, setTab] = useState<"books" | "story">("books");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState({ query: "", source: "all" as LibrarySource, page: 1, revision: 0 });
  const [result, setResult] = useState<LibraryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<LibraryBook | null>(null);
  const [list, setList] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pointer = useRef<number | null>(null);
  const dragged = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ q: search.query, source: search.source, page: String(search.page) });
    void apiFetch(`/api/library?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(18_000)]) })
      .then(async response => { const body = await response.json(); if (!response.ok || !Array.isArray(body.books)) throw new Error(body.error || "Katalog belum bisa dimuat."); if (!controller.signal.aborted) { setResult(body); setActive(0); } })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Pencarian belum tersedia."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search]);
  useEffect(() => { const element = dialog.current; if (selected && element && !element.open) element.showModal(); return () => { if (element?.open) element.close(); }; }, [selected]);
  const books = result?.books ?? [];
  const book = books[active];
  function move(delta: number) { if (books.length) setActive(value => (value + delta + books.length) % books.length); }
  return <main className="eureka-library">
    <header className="library-heading"><div><h1>Satu rak, banyak dunia.</h1><p>Temukan bacaan baru. Atau buat dongengmu sendiri bersama Momo.</p></div><span className="library-heading-sticker" aria-hidden="true"><NoriHeadphonesSticker size={90} peel /></span></header>
    <div className="library-tabs" role="tablist" aria-label="Jenis perpustakaan"><button role="tab" id="library-books-tab" aria-controls="library-books" aria-selected={tab === "books"} onClick={() => setTab("books")}>Jelajahi buku</button><button role="tab" id="library-story-tab" aria-controls="library-story" aria-selected={tab === "story"} onClick={() => setTab("story")}>Studio dongeng</button></div>
    <section id="library-books" role="tabpanel" aria-labelledby="library-books-tab" hidden={tab !== "books"}>
      <form className="library-search" onSubmit={event => { event.preventDefault(); setSearch(current => ({ ...current, query: draft.trim(), page: 1, revision: current.revision + 1 })); }}><Search size={19} aria-hidden="true" /><input aria-label="Cari judul atau penulis buku" placeholder="Judul, penulis, atau topik yang kamu sukai…" value={draft} maxLength={160} onChange={event => setDraft(event.target.value)} /><button type="submit" disabled={loading}>Cari buku</button></form>
      <div className="library-source-filter"><label>Sumber <select value={search.source} onChange={event => setSearch(current => ({ ...current, source: event.target.value as LibrarySource, page: 1 }))}><option value="all">Semua katalog</option><option value="openlibrary">Open Library</option><option value="gutenberg">Project Gutenberg</option></select></label><button aria-pressed={list} onClick={() => setList(value => !value)}>{list ? "Tampilkan rak 3D" : "Tampilkan daftar"}</button></div>
      {loading ? <div className="library-state"><LoadingStatus stage="retrieving" detail="Menelusuri katalog buku…" /></div> : error ? <div className="library-state" role="alert"><p>{error}</p><button className="library-primary" onClick={() => setSearch(current => ({ ...current, revision: current.revision + 1 }))}>Coba lagi</button></div> : !books.length ? <div className="library-state"><BookOpen size={35} /><h2>Belum bertemu buku yang cocok</h2><p>Coba judul lain, nama penulis, atau ubah sumber katalog.</p></div> : <>
        {result?.warnings.map(warning => <p className="library-warning" role="status" key={warning}>{warning}</p>)}
        {list ? <ul className="library-book-list">{books.map((item, index) => <li key={item.id}><button onClick={() => setSelected(item)}><span className="library-list-cover" style={{ background: colors[index % colors.length] }}>{item.cover && <img src={item.cover} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} />}</span><span><strong>{item.title}</strong><small>{item.authors.join(", ") || "Penulis belum tercatat"}</small><small>{item.source}</small></span></button></li>)}</ul> : <>
          <div className="library-shelf" role="region" aria-label="Rak buku tiga dimensi, geser atau gunakan tombol panah" onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }} onPointerDown={event => { pointer.current = event.clientX; dragged.current = false; }} onPointerUp={event => { if (pointer.current !== null && Math.abs(event.clientX - pointer.current) > 40) { dragged.current = true; move(event.clientX < pointer.current ? 1 : -1); } pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }}>
            <span className="library-archive-word" aria-hidden="true">baca<br />dunia.</span><div className="library-floor" /><div className="library-stage">
              {books.map((item, index) => {
                const relative = ((index - active + books.length * 1.5) % books.length) - books.length / 2;
                if (Math.abs(relative) > 8) return null;
                const open = relative === 0; const u = relative * .17 + Math.sign(relative) * .29;
                const scale = 1 / (1 + Math.pow(Math.abs(u) / 1.3, 1.6));
                const x = Math.sign(u) * 1.3 * Math.atan(Math.abs(u) / 1.3) / scale;
                const z = 1400 * (1 - 1 / scale) + (open ? 28 : 0);
                const y = .21 * (1 - scale) / scale;
                return <button className="library-volume" data-active={open} key={item.id} aria-label={`${item.title}${open ? ", buka detail" : ", pilih buku"}`} tabIndex={open ? 0 : -1} style={{ transform: `translate3d(calc(var(--book-h) * ${x}),calc(var(--book-h) * ${y}),${z}px) rotateY(${open ? -90 : Math.sign(u) * Math.min(1, Math.abs(u) / 1.3) * 26}deg)`, zIndex: Math.round(3000 + z), "--cover-color": colors[index % colors.length] } as React.CSSProperties} onClick={() => { if (dragged.current) { dragged.current = false; return; } if (open) setSelected(item); else setActive(index); }}><span className="library-spine"><span>eureka</span><strong>{item.title}</strong><small>{item.year || item.source}</small></span><span className="library-cover">{item.cover && <img src={item.cover} alt="" loading={open ? "eager" : "lazy"} draggable={false} onError={event => { event.currentTarget.style.display = "none"; }} />}<span><small>{item.authors[0] || item.source}</small><strong>{item.title}</strong><em>Buka buku</em></span></span></button>;
              })}
            </div>
          </div>
          <div className="library-caption"><button aria-label="Buku sebelumnya" onClick={() => move(-1)}><ArrowLeft size={22} /></button><div aria-live="polite"><h2>{book?.title}</h2><p>{book?.authors.join(", ") || "Penulis belum tercatat"}</p><small>{book?.source}{book?.year ? ` · ${book.year}` : ""}</small></div><button aria-label="Buku berikutnya" onClick={() => move(1)}><ArrowRight size={22} /></button></div>
          <div className="library-ruler"><input type="range" min={0} max={books.length - 1} value={active} onChange={event => setActive(Number(event.target.value))} aria-label="Pilih posisi buku di rak" /><span>{active + 1} / {books.length} buku pada halaman ini</span></div>
        </>}
        <div className="library-pagination"><button disabled={search.page === 1} onClick={() => setSearch(current => ({ ...current, page: current.page - 1 }))}>Halaman sebelumnya</button><span>Halaman {search.page}</span><button disabled={!result?.hasMore || search.page >= 100} onClick={() => setSearch(current => ({ ...current, page: current.page + 1 }))}>Halaman berikutnya</button></div>
      </>}
      <p className="library-attribution">Katalog dari <a href="https://openlibrary.org" target="_blank" rel="noreferrer">Open Library</a> dan <a href="https://www.gutenberg.org" target="_blank" rel="noreferrer">Project Gutenberg</a>. Ketersediaan baca dan pinjam mengikuti ketentuan sumbernya.</p>
    </section>
    <section id="library-story" role="tabpanel" aria-labelledby="library-story-tab" hidden={tab !== "story"}>{tab === "story" && <StoryStudio />}</section>
    {selected && <dialog ref={dialog} className="library-detail" aria-labelledby="library-detail-title" onCancel={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}><button className="library-detail-close" aria-label="Tutup detail buku" onClick={() => setSelected(null)}><X size={20} /></button><div className="library-detail-layout"><div className="library-detail-image" style={{ background: colors[active % colors.length] }}>{selected.cover ? <img src={selected.cover} alt={`Sampul ${selected.title}`} /> : <BookOpen size={60} />}</div><div><p className="library-detail-source">{selected.source}</p><h2 id="library-detail-title">{selected.title}</h2><p>{selected.authors.join(", ") || "Penulis belum tercatat"}</p>{selected.description && <p className="library-synopsis">{selected.description}</p>}<a className="library-primary" href={selected.url} target="_blank" rel="noreferrer">{selected.readable ? "Baca di sumber resmi" : "Lihat ketersediaan buku"} <ArrowRight size={16} /></a><small>Buku ini dibuka di situs penyedianya.</small></div></div></dialog>}
  </main>;
}
