"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, FileText, ImageIcon, Pencil, Save, Terminal, X } from "lucide-react";
import MarkdownView from "@/components/asisten/MarkdownView";
import type { Artifact } from "@/lib/agents/types";
import "./artifact-workspace.css";

interface ArtifactCanvasProps {
  artifacts: Artifact[];
  streamingId: string | null;
  open: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  sending?: boolean;
  onClose: () => void;
  onEditSave?: (id: string, content: string) => Promise<void>;
}

const formats = {
  markdown: { label: "Dokumen", icon: FileText },
  terminal: { label: "Terminal", icon: Terminal },
  image: { label: "Gambar", icon: ImageIcon },
};

export default function ArtifactCanvas(props: ArtifactCanvasProps) {
  const active = props.artifacts.find((item) => item.id === props.activeId) ?? props.artifacts.at(-1);
  if (!active) return null;
  return <ArtifactWorkspace key={`${active.id}:${active.version}`} {...props} active={active} />;
}

function ArtifactWorkspace({
  artifacts, active, streamingId, open, sending, onClose, onEditSave, onSelect,
}: ArtifactCanvasProps & { active: Artifact }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const editing = draft !== null;
  const busy = saving || sending || Boolean(streamingId);
  const streaming = active.id === streamingId;
  const { label, icon: FormatIcon } = formats[active.type];

  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 899px)").matches) return;
    const previous = document.activeElement;
    titleRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(active.content);
      setFeedback({ error: false, text: "Isi disalin" });
    } catch {
      setFeedback({ error: true, text: "Isi belum bisa disalin." });
    }
  }

  async function save() {
    if (draft === null || busy || !onEditSave) return;
    setSaving(true);
    setFeedback(null);
    try {
      await onEditSave(active.id, draft);
      setDraft(null);
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : "Perubahan belum bisa disimpan." });
    } finally {
      setSaving(false);
    }
  }

  const terminalLines = active.type === "terminal" ? active.content.split("\n") : [];
  const visibleLines = expanded ? terminalLines : terminalLines.slice(0, 6);
  const source = active.type === "markdown" ? /(?:^|\n)\*\(Sumber:\s*([^)\n]+)\)\*\s*(?=\n|$)/.exec(active.content) : null;
  const documentText = source ? active.content.replace(source[0], "\n").trim() : active.content;

  return (
    <aside
      className="artifact-workspace"
      aria-labelledby="artifact-workspace-title"
      data-testid="artifact-canvas"
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      }}
    >
      <header className="artifact-workspace-header">
        <div className="artifact-workspace-top">
          <p><FormatIcon size={17} aria-hidden="true" />{label}<span aria-hidden="true">·</span> Versi {active.version}</p>
          <button className="artifact-action artifact-icon-action" type="button" onClick={onClose} aria-label="Tutup canvas"><X size={21} aria-hidden="true" /></button>
        </div>
        <h2 id="artifact-workspace-title" ref={titleRef} tabIndex={-1}>{active.title}</h2>
        {artifacts.length > 1 && (
          <nav className="artifact-file-list" aria-label="Pilih artifact">
            {artifacts.map((item) => (
              <button type="button" key={item.id} aria-pressed={item.id === active.id} disabled={saving} onClick={() => onSelect(item.id)}>
                {item.title}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className="artifact-workspace-scroll">
        {active.type === "markdown" ? (
          editing ? (
            <div className="artifact-editor">
              <label htmlFor="artifact-edit-content">Isi dokumen</label>
              <textarea id="artifact-edit-content" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy} />
            </div>
          ) : (
            <article className="artifact-document">
              <MarkdownView content={documentText} />
              {source && <p className="artifact-source"><FileText size={15} aria-hidden="true" /> Sumber: {source[1].trim()}</p>}
            </article>
          )
        ) : active.type === "terminal" ? (
          <section className="artifact-terminal" aria-label="Output terminal" data-testid="artifact-terminal">
            <p>Output terminal</p>
            <pre>{visibleLines.join("\n")}</pre>
            {terminalLines.length > 6 && (
              <button className="artifact-action" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? "Ringkas output" : `Tampilkan ${terminalLines.length - 6} baris lagi`}
              </button>
            )}
          </section>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="artifact-image" src={active.content} alt={active.title} />
        )}
      </div>

      <footer className="artifact-workspace-footer">
        {feedback?.error && <p role="alert" className="artifact-error">{feedback.text}</p>}
        <div className="artifact-action-row">
          {editing ? (
            <>
              <button className="artifact-action" type="button" disabled={saving} onClick={() => { setDraft(null); setFeedback(null); }}>Batal</button>
              <button className="artifact-action is-primary" type="button" onClick={save} disabled={busy}><Save size={17} aria-hidden="true" />Simpan versi</button>
            </>
          ) : (
            <>
              <button className="artifact-action" type="button" onClick={copy} aria-label="Salin artifact">
                {feedback && !feedback.error ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
                Salin
              </button>
              {active.type === "markdown" && onEditSave && (
                <button className="artifact-action is-primary" type="button" disabled={busy} onClick={() => { setDraft(active.content); setFeedback(null); }}><Pencil size={17} aria-hidden="true" />Edit dokumen</button>
              )}
              {active.type === "image" && (
                <a className="artifact-action is-primary" href={active.content} download={`${active.title || "artifact"}.png`}><Download size={17} aria-hidden="true" />Unduh gambar</a>
              )}
            </>
          )}
        </div>
        <p role="status" className="artifact-workspace-status">
          {saving ? "Menyimpan…" : streaming ? "Sedang dibuat…" : editing ? "Perubahan belum disimpan" : !feedback?.error ? feedback?.text : ""}
        </p>
      </footer>
    </aside>
  );
}
