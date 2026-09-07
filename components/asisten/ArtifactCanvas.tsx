"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  Download,
  Edit3,
  FileText,
  Save,
  Terminal,
  X,
} from "lucide-react";

import MarkdownView from "@/components/asisten/MarkdownView";
import type { Artifact } from "@/lib/agents/types";

interface ArtifactCanvasProps {
  artifacts: Artifact[];
  /** Artifact yang sedang menerima stream (ikon/status live). */
  streamingId: string | null;
  open: boolean;
  onClose: () => void;
  /** Simpan hasil edit markdown (content baru) — version naik di parent. */
  onEditSave?: (id: string, content: string) => void;
}

/**
 * Artifact Canvas (PRD §7) — panel rendering terpisah dari bubble chat.
 * Desktop: panel samping; mobile: bottom sheet. Toolbar per tipe:
 * markdown → copy/edit/simpan; terminal → expand/collapse (read-only);
 * image → copy/simpan.
 */
export default function ArtifactCanvas({
  artifacts,
  streamingId,
  open,
  onClose,
  onEditSave,
}: ArtifactCanvasProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [copied, setCopied] = useState(false);
  const [terminalExpanded, setTerminalExpanded] = useState(false);

  // Artifact aktif: yang dipilih, atau terakhir dibuat.
  const active = useMemo(
    () =>
      artifacts.find((a) => a.id === activeId) ??
      artifacts[artifacts.length - 1] ??
      null,
    [artifacts, activeId]
  );

  // Sitasi sumber dokumen dari konten markdown — baris "*(Sumber: …)*"
  // diambil dari alur markdown & dirender sebagai teks ringan terpisah
  // (chat-visual-hierarchy: sitasi tanpa banner berborder).
  const sourceLabel = useMemo(() => {
    if (!active || active.type !== "markdown") return null;
    const m = /\*\(Sumber:\s*([^)]+)\)\*/.exec(active.content);
    return m ? `Sumber: ${m[1].trim()}` : null;
  }, [active]);

  // Artifact baru masuk → reset mode edit & pilihan.
  useEffect(() => {
    setEditing(false);
    setCopied(false);
    setTerminalExpanded(false);
  }, [active?.id, active?.version]);

  if (!open || artifacts.length === 0) return null;

  const copyActive = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard ditolak — abaikan
    }
  };

  const startEdit = () => {
    if (!active || active.type !== "markdown") return;
    setEditText(active.content);
    setEditing(true);
  };

  const saveEdit = () => {
    if (!active) return;
    // Version bertambah (PRD §7.2) — update via state di parent (hook).
    onEditSave?.(active.id, editText);
    setEditing(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="artifact-canvas"
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 32 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[72dvh] flex-col border-t border-clay-borderLight/60 bg-clay-cream sm:static sm:mx-0 sm:max-h-none sm:w-[380px] sm:shrink-0 sm:border-r sm:border-t-0 border-clay-borderLight/60 lg:w-[420px]"
          data-testid="artifact-canvas"
        >
          {/* Header minimal ala Claude: ikon tipe + judul + badge format kiri,
              aksi kanan. Tanpa border-bottom (bersih tanpa garis perpotongan). */}
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-clay-full text-clay-muted">
                {active?.type === "terminal" ? (
                  <Terminal size={13} />
                ) : active?.type === "image" ? (
                  <FileText size={13} />
                ) : (
                  <FileText size={13} />
                )}
              </span>
              <span className="truncate text-xs font-extrabold text-clay-dark">
                {active?.title ?? "Artifact"}
              </span>
              {active && (
                <span className="shrink-0 rounded-clay-sm bg-clay-beige px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide text-clay-muted">
                  {active.type === "terminal" ? "TER" : active.type === "image" ? "IMG" : "MD"}
                </span>
              )}
              {streamingId && (
                <span className="shrink-0 rounded-full bg-clay-primary/10 px-1.5 py-px text-[9px] font-extrabold text-clay-primary">
                  streaming…
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {active && (
                <button
                  onClick={copyActive}
                  aria-label="Salin artifact"
                  title="Salin isi artifact"
                  className="flex h-7 w-7 items-center justify-center rounded-clay-full text-clay-muted hover:bg-clay-beige hover:text-clay-dark"
                >
                  {copied ? <Check size={13} className="text-clay-success" /> : <Copy size={13} />}
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Tutup canvas"
                title="Tutup panel"
                className="flex h-7 w-7 items-center justify-center rounded-clay-full text-clay-muted hover:bg-clay-beige hover:text-clay-dark"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Tab daftar artifact (bila lebih dari satu) — chip kecil netral,
              aktif = latar coral tipis (bukan solid penuh). */}
          {artifacts.length > 1 && (
            <div className="flex gap-1 overflow-x-auto border-b border-clay-borderLight/60 px-2 pb-1.5">
              {artifacts.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setActiveId(a.id)}
                  className={`shrink-0 rounded-clay-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                    a.id === active?.id
                      ? "bg-[rgb(var(--accent-coral))]/12 text-[rgb(var(--accent-coral))]"
                      : "text-clay-muted hover:bg-clay-beige hover:text-clay-dark"
                  }`}
                >
                  {a.type === "terminal" ? "▣" : a.type === "image" ? "🖼" : "📄"}{" "}
                  {a.title.slice(0, 18)} ({i + 1})
                </button>
              ))}
            </div>
          )}

          {/* Konten */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {!active ? (
              <p className="mt-8 text-center text-xs font-bold text-clay-muted">
                Belum ada artifact.
              </p>
            ) : active.type === "markdown" ? (
              editing ? (
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="h-full min-h-[240px] w-full resize-none rounded-clay-md bg-clay-inputBg p-3 font-mono text-xs text-clay-dark shadow-[inset_0_2px_6px_rgb(var(--clay-shadow-dark)/0.35)] focus:outline-none"
                  aria-label="Edit artifact"
                />
              ) : (
                <>
                  {/* Sitasi sumber — elemen ringan: satu baris teks kecil netral,
                      bukan banner berborder (chat-visual-hierarchy). */}
                  {sourceLabel && (
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-clay-muted/80">
                      <FileText size={11} className="shrink-0" />
                      <span className="truncate">{sourceLabel}</span>
                    </p>
                  )}
                  <MarkdownView content={active.content} className="text-sm" />
                </>
              )
            ) : active.type === "terminal" ? (
              <TerminalPanel
                content={active.content}
                streaming={active.id === streamingId}
                expanded={terminalExpanded}
                onToggle={() => setTerminalExpanded((v) => !v)}
              />
            ) : (
              /* image: dataUrl/url pada content — dirender sebagai gambar */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.content}
                alt={active.title}
                className="mx-auto max-h-full rounded-clay-md"
              />
            )}
          </div>

          {/* Toolbar per tipe (PRD §7.5) — ikon ghost minimal; footer ramah
              siswa: codename agent hanya di tooltip (chat-visual-hierarchy). */}
          {active && (
            <div className="flex items-center gap-0.5 border-t border-clay-borderLight/60 px-2.5 py-1.5">
              {active.type === "markdown" && !editing && (
                <button
                  onClick={startEdit}
                  title="Edit catatan"
                  aria-label="Edit artifact"
                  className="flex h-7 w-7 items-center justify-center rounded-clay-full text-clay-muted hover:bg-clay-beige hover:text-clay-dark"
                >
                  <Edit3 size={13} />
                </button>
              )}
              {active.type === "markdown" && editing && (
                <button
                  onClick={saveEdit}
                  title={`Simpan sebagai versi ${active.version + 1}`}
                  aria-label="Simpan editan"
                  className="flex h-7 w-7 items-center justify-center rounded-clay-full text-[rgb(var(--accent-coral))] hover:bg-[rgb(var(--accent-coral))]/10"
                >
                  <Save size={13} />
                </button>
              )}

              {active.type === "image" && (
                <a
                  href={active.content}
                  download={`${active.title || "artifact"}.png`}
                  title="Unduh gambar"
                  aria-label="Unduh gambar"
                  className="flex h-7 w-7 items-center justify-center rounded-clay-full text-clay-muted hover:bg-clay-beige hover:text-clay-dark"
                >
                  <Download size={13} />
                </a>
              )}

              <span
                className="ml-auto cursor-help text-[10px] font-bold text-clay-muted/70"
                title={`Dibuat oleh agent "${active.sourceAgent}" — tersimpan otomatis ke akunmu`}
              >
                Tersimpan otomatis · v{active.version}
              </span>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ─── Panel terminal (PRD §7.4) ──────────────────────────────────────────────

function TerminalPanel({
  content,
  streaming,
  expanded,
  onToggle,
}: {
  content: string;
  streaming: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const lines = content.split("\n");
  const collapsed = !expanded && lines.length > 6;
  const visible = collapsed ? lines.slice(0, 6) : lines;

  return (
    <div
      className="rounded-clay-md bg-clay-inputBg p-3 font-mono text-[11.5px] leading-relaxed text-clay-dark shadow-[inset_0_2px_6px_rgb(var(--clay-shadow-dark)/0.35)]"
      data-testid="artifact-terminal"
    >
      <div className="max-h-[52dvh] overflow-y-auto">
        {visible.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {line || " "}
          </div>
        ))}
        {streaming && (
          <div className="animate-pulse text-clay-primary">▌</div>
        )}
      </div>
      {collapsed && (
        <button
          onClick={onToggle}
          className="mt-2 rounded-clay-full bg-clay-cream px-2.5 py-1 text-[10px] font-extrabold text-clay-primary shadow-clay-sm"
        >
          Lihat detail ({lines.length - 6} baris lagi ⌄)
        </button>
      )}
      {expanded && lines.length > 6 && (
        <button
          onClick={onToggle}
          className="mt-2 rounded-clay-full bg-clay-cream px-2.5 py-1 text-[10px] font-extrabold text-clay-muted shadow-clay-sm"
        >
          Ringkas ⌃
        </button>
      )}
    </div>
  );
}
