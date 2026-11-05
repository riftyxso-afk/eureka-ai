"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Flag,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { emojiToIcon } from "@/lib/emojiIcon";
import type { Subject } from "@/lib/subjects";
import type { SubjectJourney, SubjectJourneyNote } from "@/lib/subject-journey";
import { CreateNoteModal } from "@/components/dashboard/CreateNoteModal";
import SubjectPractice from "@/components/subjects/SubjectPractice";
import "./subjects.css";

type JourneySubject = Subject & { totalNotes: number; journey: SubjectJourney };
type Filter = "all" | "next" | "reviewed";
const COLORS = ["#7041a6", "#30735c", "#a26425", "#376c96"];

export default function MataPelajaranPage() {
  const [subjects, setSubjects] = useState<JourneySubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [createFor, setCreateFor] = useState<JourneySubject | null>(null);
  const [practice, setPractice] = useState<{
    subject: JourneySubject;
    note: SubjectJourneyNote;
  } | null>(null);
  const requestId = useRef(0);
  const nameInput = useRef<HTMLInputElement>(null);
  const selected = subjects.find((s) => s.id === selectedId) ?? subjects[0];

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const res = await apiFetch("/api/subjects?journey=1");
      if (!res.ok) throw new Error("Gagal memuat mata pelajaran.");
      const data = await res.json();
      if (id !== requestId.current) return;
      if (
        !Array.isArray(data.subjects) ||
        data.subjects.some((subject: JourneySubject) => !subject.journey)
      ) {
        throw new Error(
          "Data jalur belajar belum tersedia. Muat ulang setelah server siap.",
        );
      }
      setSubjects(data.subjects);
      setLoadError(false);
    } catch {
      if (id === requestId.current) setLoadError(true);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  const invalidateRequests = useCallback(() => {
    requestId.current++;
  }, []);
  useEffect(() => {
    void load();
    return invalidateRequests;
  }, [load, invalidateRequests]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  useEffect(() => {
    if (adding) nameInput.current?.focus();
  }, [adding]);

  const shown = useMemo(
    () =>
      subjects.filter((s) => {
        const match = s.name
          .toLocaleLowerCase("id")
          .includes(query.trim().toLocaleLowerCase("id"));
        return (
          match &&
          (filter === "all" ||
            (filter === "reviewed"
              ? s.journey.progressAvailable && s.journey.reviewedNotes > 0
              : !s.journey.progressAvailable ||
                s.journey.percent < 100 ||
                s.journey.dueCards > 0))
        );
      }),
    [subjects, query, filter],
  );
  const totalNotes = subjects.reduce((sum, s) => sum + s.totalNotes, 0);
  const reviewedNotes = subjects.reduce(
    (sum, s) =>
      sum + (s.journey.progressAvailable ? s.journey.reviewedNotes : 0),
    0,
  );
  const dueCards = subjects.reduce(
    (sum, s) => sum + (s.journey.progressAvailable ? s.journey.dueCards : 0),
    0,
  );
  const allProgressAvailable = subjects.every(
    (s) => s.journey.progressAvailable,
  );

  async function addSubject(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("Isi nama mata pelajaran terlebih dahulu.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color: COLORS[subjects.length % COLORS.length],
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data.error || "Mata pelajaran belum tersimpan. Coba lagi.",
        );
      setSelectedId(data.subject.id);
      setName("");
      setAdding(false);
      setQuery("");
      setFilter("all");
      setNotice(
        `${data.subject.name} ditambahkan. Mulai dengan materi pertamamu.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }
  async function deleteSubject(subject: JourneySubject) {
    if (
      deleting ||
      !window.confirm(
        `Hapus mata pelajaran "${subject.name}"? Catatannya tetap tersimpan di Catatan.`,
      )
    )
      return;
    setDeleting(subject.id);
    setError(null);
    try {
      const res = await apiFetch(
        `/api/subjects/${encodeURIComponent(subject.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Mata pelajaran belum terhapus. Coba lagi.");
      setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
      if (selectedId === subject.id) setSelectedId(null);
      setNotice(`${subject.name} dihapus. Catatannya tetap tersimpan.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus.");
    } finally {
      setDeleting(null);
    }
  }
  function openPractice(subject: JourneySubject, note: SubjectJourneyNote) {
    setPractice({ subject, note });
  }
  const nextNote = selected?.journey.notes.find(
    (n) => n.id === selected.journey.nextNoteId,
  );
  const nextLabel = !selected?.journey.progressAvailable
    ? "Buka materi"
    : selected.journey.nextAction?.type === "create_note"
      ? "Tambah materi pertama"
      : selected.journey.nextAction?.type === "prepare_cards"
        ? "Siapkan kartu latihan"
        : selected.journey.nextAction?.type === "review"
          ? "Mulai ulang kartu"
          : "Latih lagi";

  return (
    <div className="subject-journey">
      <header className="sj-header">
        <div>
          <Link href="/dashboard" className="sj-back">
            Ruang belajar <span aria-hidden="true">/</span>
          </Link>
          <h1>Jelajahi materi</h1>
          <p>
            Temukan yang ingin dipelajari. Ambil satu langkah lagi hari ini.
          </p>
        </div>
        <button
          className="sj-button sj-button-primary"
          onClick={() => {
            setAdding((a) => !a);
            setError(null);
          }}
          aria-expanded={adding}
          aria-controls="sj-add"
        >
          <Plus size={18} /> Mata pelajaran baru
        </button>
      </header>

      {adding && (
        <form id="sj-add" className="sj-add" onSubmit={addSubject}>
          <div>
            <label htmlFor="sj-name">Apa yang ingin kamu pelajari?</label>
            <p>
              Kelompokkan materi dengan nama seperti Matematika atau Desain.
            </p>
          </div>
          <div className="sj-add-fields">
            <input
              ref={nameInput}
              id="sj-name"
              maxLength={80}
              placeholder="Nama mata pelajaran"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
            <button className="sj-button sj-button-primary" disabled={saving}>
              {saving ? "Menyimpan…" : "Tambahkan"}
            </button>
            <button
              type="button"
              className="sj-icon-button"
              aria-label="Tutup form"
              onClick={() => setAdding(false)}
              disabled={saving}
            >
              <X size={19} />
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="sj-error" role="alert">
          {error}
        </p>
      )}
      <p className="sj-notice" role="status">
        {notice}
      </p>
      {loading ? (
        <div className="sj-loading" role="status">
          <RefreshCw size={23} />
          <p>Menyiapkan jalur belajarmu…</p>
        </div>
      ) : loadError && subjects.length === 0 ? (
        <div className="sj-empty">
          <BookOpen size={32} />
          <h2>Materi belum bisa dimuat</h2>
          <p>Periksa koneksi, lalu coba muat kembali.</p>
          <button
            className="sj-button sj-button-primary"
            onClick={() => void load()}
            disabled={refreshing}
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <>
          {loadError && (
            <div className="sj-warning" role="alert">
              Pembaruan terakhir gagal. Data di bawah mungkin belum terbaru.{" "}
              <button onClick={() => void load()} disabled={refreshing}>
                Coba lagi
              </button>
            </div>
          )}
          <div className="sj-layout">
            <section className="sj-library" aria-labelledby="sj-library-title">
              <div className="sj-section-head">
                <h2 id="sj-library-title">
                  Mata pelajaranmu <span>{subjects.length}</span>
                </h2>
                <button
                  className="sj-icon-button"
                  aria-label="Perbarui progres"
                  onClick={() => void load()}
                  disabled={refreshing}
                >
                  <RefreshCw
                    size={17}
                    className={refreshing ? "sj-spinning" : ""}
                  />
                </button>
              </div>
              <label className="sj-search">
                <Search size={18} />
                <input
                  aria-label="Cari mata pelajaran"
                  placeholder="Cari mata pelajaran…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    aria-label="Hapus pencarian"
                    onClick={() => setQuery("")}
                  >
                    <X size={16} />
                  </button>
                )}
              </label>
              <div className="sj-filters" aria-label="Filter mata pelajaran">
                {(
                  [
                    ["all", "Semua"],
                    ["next", "Masih ada langkah"],
                    ["reviewed", "Pernah diulang"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="sj-subject-list">
                {shown.map((subject) => {
                  const Icon = emojiToIcon(subject.emoji);
                  const active = selected?.id === subject.id;
                  return (
                    <button
                      key={subject.id}
                      className={`sj-subject ${active ? "is-selected" : ""}`}
                      aria-pressed={active}
                      onClick={() => setSelectedId(subject.id)}
                    >
                      <span className="sj-subject-icon">
                        <Icon size={23} />
                      </span>
                      <span className="sj-subject-copy">
                        <strong>{subject.name}</strong>
                        <small>
                          {subject.totalNotes} materi
                          {subject.journey.progressAvailable &&
                          subject.journey.dueCards > 0
                            ? ` · ${subject.journey.dueCards} kartu waktunya diulang`
                            : ""}
                        </small>
                        <span className="sj-mini-progress" aria-hidden="true">
                          <span
                            style={{
                              width: `${subject.journey.progressAvailable ? subject.journey.percent : 0}%`,
                            }}
                          />
                        </span>
                        <small>
                          {subject.journey.progressAvailable
                            ? `${subject.journey.completedSteps}/${subject.journey.totalSteps} langkah aktivitas`
                            : "Progres kartu belum tersedia"}
                        </small>
                      </span>
                      <ArrowRight size={18} aria-hidden="true" />
                    </button>
                  );
                })}
                {shown.length === 0 && (
                  <div className="sj-list-empty">
                    <p>
                      {subjects.length === 0
                        ? "Belum ada mata pelajaran."
                        : "Tidak ada yang cocok dengan filter ini."}
                    </p>
                    {subjects.length > 0 && (
                      <button
                        onClick={() => {
                          setQuery("");
                          setFilter("all");
                        }}
                      >
                        Tampilkan semua
                      </button>
                    )}
                  </div>
                )}
              </div>
              <Link href="/dashboard/kursus" className="sj-course-link">
                <BookOpen size={20} />
                <span>
                  <strong>Belum punya materi?</strong>
                  <small>Coba kursus gratis Eureka</small>
                </span>
                <ArrowRight size={17} />
              </Link>
            </section>

            <main className="sj-path-area">
              {!selected ? (
                <section className="sj-welcome">
                  <Image
                    src="/onboarding/eureka-welcome.png"
                    alt=""
                    width={154}
                    height={154}
                  />
                  <h2>Setiap petualangan dimulai dari rasa ingin tahu.</h2>
                  <p>
                    Tambahkan mata pelajaran, bawa materimu, lalu ubah menjadi
                    latihan kecil yang bisa kamu ulang.
                  </p>
                  <button
                    className="sj-button sj-button-primary"
                    onClick={() => setAdding(true)}
                  >
                    <Plus size={18} /> Pilih mata pelajaran pertama
                  </button>
                  <Link href="/dashboard/kursus">
                    Atau jelajahi kursus gratis <ArrowRight size={16} />
                  </Link>
                </section>
              ) : (
                <>
                  <section className="sj-unit">
                    <div className="sj-unit-top">
                      <span className="sj-unit-label">
                        <Flag size={16} /> Jalur belajarmu
                      </span>
                      <button
                        className="sj-icon-button"
                        aria-label={`Hapus ${selected.name}`}
                        disabled={deleting !== null}
                        onClick={() => void deleteSubject(selected)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <h2>{selected.name}</h2>
                    <p>
                      {selected.totalNotes === 0
                        ? "Bawa satu materi. Kita mulai dari sana."
                        : "Buka materi, siapkan kartu, lalu ulangi dengan caramu sendiri."}
                    </p>
                    <div className="sj-unit-bottom">
                      <span>
                        {selected.journey.progressAvailable
                          ? `${selected.journey.completedSteps} dari ${selected.journey.totalSteps} langkah aktivitas`
                          : "Progres kartu belum tersedia"}
                      </span>
                      <Link
                        href={`/dashboard/catatan?subject=${encodeURIComponent(selected.name)}`}
                      >
                        Lihat catatan <ArrowRight size={15} />
                      </Link>
                    </div>
                    {selected.journey.progressAvailable && (
                      <progress
                        max={100}
                        value={selected.journey.percent}
                        aria-label={`Progres aktivitas ${selected.name}`}
                      />
                    )}
                  </section>
                  {!selected.journey.progressAvailable && (
                    <div className="sj-warning">
                      Materi tetap bisa dibuka. Data kartu belum bisa dimuat;
                      perbarui progres untuk mencoba lagi.
                    </div>
                  )}
                  <section className="sj-next">
                    <span className="sj-next-icon">
                      <Flag size={23} />
                    </span>
                    <div>
                      <span className="sj-kicker">Tantangan berikutnya</span>
                      <h3>{nextNote?.title ?? "Siapkan materi pertamamu"}</h3>
                      <p>
                        {selected.journey.progressAvailable &&
                        selected.journey.percent === 100
                          ? "Semua langkah pernah dilakukan. Ulangi lagi agar tetap ingat."
                          : nextNote?.dueCards
                            ? `${nextNote.dueCards} kartu sudah waktunya diulang.`
                            : selected.journey.nextAction?.type === "prepare_cards"
                              ? "Ubah materi ini menjadi kartu tanya–jawab."
                              : selected.totalNotes === 0
                                ? "Unggah dokumen, tempel tautan, atau bawa soalmu."
                                : "Satu sesi kecil juga berarti."}
                      </p>
                    </div>
                    {!nextNote ? (
                      <button
                        className="sj-button sj-button-primary"
                        onClick={() => setCreateFor(selected)}
                      >
                        {nextLabel}
                        <ArrowRight size={16} />
                      </button>
                    ) : !selected.journey.progressAvailable ? (
                      <Link
                        className="sj-button sj-button-primary"
                        href={`/dashboard/note/${encodeURIComponent(nextNote.id)}`}
                      >
                        Buka materi
                        <ArrowRight size={16} />
                      </Link>
                    ) : (
                      <button
                        className="sj-button sj-button-primary"
                        onClick={() => openPractice(selected, nextNote)}
                      >
                        {nextLabel}
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </section>
                  <div className="sj-path-heading">
                    <h3>Peta materimu</h3>
                    <span>Semua langkah bisa dibuka</span>
                  </div>
                  {selected.journey.notes.length === 0 ? (
                    <div className="sj-first-step">
                      <span className="sj-node sj-node-next">
                        <Plus size={25} />
                      </span>
                      <h3>Materi pertama menunggumu</h3>
                      <p>
                        Tambahkan catatan ke {selected.name} untuk mulai mengisi
                        peta ini.
                      </p>
                      <button
                        className="sj-button sj-button-outline"
                        onClick={() => setCreateFor(selected)}
                      >
                        Tambah materi
                      </button>
                    </div>
                  ) : (
                    <ol className="sj-path">
                      {selected.journey.notes.map((note, index) => {
                        const ready = selected.journey.progressAvailable;
                        const completed =
                          ready &&
                          note.cardCount > 0 &&
                          note.reviewedCards === note.cardCount;
                        return (
                          <li key={note.id} className="sj-path-note">
                            <div className="sj-note-title">
                              <span className="sj-chapter">{index + 1}</span>
                              <div>
                                <h4>{note.title}</h4>
                                <span>
                                  {completed
                                    ? "Putaran pertama selesai"
                                    : ready
                                      ? `${1 + Number(note.cardCount > 0)} dari 3 langkah tercatat`
                                      : "Materi tersedia"}
                                </span>
                              </div>
                              {completed && (
                                <Trophy
                                  size={21}
                                  className="sj-trophy"
                                  aria-label="Semua kartu pernah diulang"
                                />
                              )}
                            </div>
                            <div className="sj-steps">
                              <Link
                                className="sj-step"
                                href={`/dashboard/note/${encodeURIComponent(note.id)}`}
                              >
                                <span className="sj-node sj-node-done">
                                  <BookOpen size={23} />
                                  <i>
                                    <Check size={11} />
                                  </i>
                                </span>
                                <strong>Buka materi</strong>
                                <small>Tersedia</small>
                              </Link>
                              <button
                                className="sj-step"
                                onClick={() => openPractice(selected, note)}
                              >
                                <span
                                  className={`sj-node ${ready && note.cardCount > 0 ? "sj-node-done" : "sj-node-next"}`}
                                >
                                  <Layers size={23} />
                                  {ready && note.cardCount > 0 && (
                                    <i>
                                      <Check size={11} />
                                    </i>
                                  )}
                                </span>
                                <strong>
                                  {ready && note.cardCount > 0
                                    ? "Kartu latihan"
                                    : "Siapkan kartu"}
                                </strong>
                                <small>
                                  {ready
                                    ? note.cardCount > 0
                                      ? `${note.cardCount} kartu tersimpan`
                                      : "Dari materi kamu"
                                    : "Buka latihan"}
                                </small>
                              </button>
                              <button
                                className="sj-step"
                                onClick={() => openPractice(selected, note)}
                              >
                                <span
                                  className={`sj-node ${completed ? "sj-node-done" : "sj-node-soft"}`}
                                >
                                  <RefreshCw size={23} />
                                  {completed && (
                                    <i>
                                      <Check size={11} />
                                    </i>
                                  )}
                                </span>
                                <strong>Ulangi kartu</strong>
                                <small>
                                  {ready
                                    ? completed
                                      ? note.dueCards > 0
                                        ? `${note.dueCards} waktunya diulang`
                                        : "Pernah diulang"
                                      : `${note.reviewedCards}/${note.cardCount} pernah diulang`
                                    : "Buka latihan"}
                                </small>
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {selected.totalNotes > 0 && (
                    <button
                      className="sj-add-material"
                      onClick={() => setCreateFor(selected)}
                    >
                      <Plus size={20} /> Tambah materi ke {selected.name}
                    </button>
                  )}
                  <p className="sj-footnote">
                    Centang menandai aktivitas yang tercatat, bukan nilai
                    penguasaan. Membuka materi tidak otomatis berarti sudah
                    memahaminya.
                  </p>
                </>
              )}
            </main>
            <aside className="sj-aside">
              <section className="sj-companion">
                <Image
                  src="/onboarding/eureka-welcome.png"
                  alt=""
                  width={116}
                  height={116}
                />
                <h2>Pelan-pelan, tetap maju.</h2>
                <p>
                  Tidak perlu menyelesaikan semuanya hari ini. Pilih satu
                  materi, lalu coba satu latihan.
                </p>
              </section>
              <section className="sj-backpack">
                <h2>Bekal belajarmu</h2>
                <dl>
                  <div>
                    <dt>
                      <BookOpen size={18} /> Materi tersedia
                    </dt>
                    <dd>{totalNotes}</dd>
                  </div>
                  <div>
                    <dt>
                      <Check size={18} /> Materi pernah diulang
                    </dt>
                    <dd>{allProgressAvailable ? reviewedNotes : "—"}</dd>
                  </div>
                  <div>
                    <dt>
                      <RefreshCw size={18} /> Kartu jatuh tempo
                    </dt>
                    <dd>{allProgressAvailable ? dueCards : "—"}</dd>
                  </div>
                </dl>
                <p>Dihitung dari catatan dan kartu yang tersimpan.</p>
              </section>
              <details className="sj-how">
                <summary>
                  Cara mengisi peta <ChevronDown size={16} />
                </summary>
                <ol>
                  <li>Tambahkan materi ke mata pelajaran.</li>
                  <li>Buat kartu latihan dari materi itu.</li>
                  <li>Buka jawaban setiap kartu, lalu simpan sesi ulang.</li>
                </ol>
                <p>
                  Tidak ada langkah terkunci dan tidak ada XP tambahan dari
                  halaman ini.
                </p>
              </details>
            </aside>
          </div>
        </>
      )}
      {createFor && (
        <CreateNoteModal
          key={createFor.id}
          open
          initialSubject={createFor.name}
          onClose={() => {
            setCreateFor(null);
            void load();
          }}
          onCreate={() => {
            setCreateFor(null);
            setNotice("Materi ditambahkan ke jalur belajarmu.");
            void load();
          }}
        />
      )}
      {practice && (
        <SubjectPractice
          key={`${practice.subject.id}:${practice.note.id}`}
          subjectId={practice.subject.id}
          noteId={practice.note.id}
          noteTitle={practice.note.title}
          onClose={() => {
            setPractice(null);
            void load();
          }}
          onComplete={() => {
            setNotice("Sesi ulang tersimpan. Petamu sudah diperbarui.");
          }}
        />
      )}
    </div>
  );
}
