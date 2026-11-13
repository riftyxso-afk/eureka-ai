"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { X, BookOpen, Network, Pencil, Download } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import MarkdownView from "@/components/asisten/MarkdownView";
import LoadingStatus from "@/components/ui/LoadingStatus";
import { boardMap } from "@/lib/meetBoard";
import StudyMindmap from "./StudyMindmap";

const Editor = lazy(() => import("./DocumentEditor"));
const tabs = [
  { id: "read", label: "Baca", Icon: BookOpen },
  { id: "edit", label: "Edit", Icon: Pencil },
  { id: "map", label: "Struktur", Icon: Network },
] as const;

type StudyArtifact = { id: string; title: string; content: string; revision: number };

export default function StudyArtifactDialog({ sessionId, artifactId, onClose }: {
  sessionId: string;
  artifactId?: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<StudyArtifact[]>([]);
  const [selected, setSelected] = useState("");
  const [view, setView] = useState<(typeof tabs)[number]["id"]>("read");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function load() {
      try {
        const query = new URLSearchParams({ sessionId });
        if (artifactId) query.set("artifactId", artifactId);
        const response = await apiFetch("/api/study-artifacts?" + query, { signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Artefak belum dimuat.");
        if (signal.aborted) return;
        const artifacts: StudyArtifact[] = data.artifacts;
        setItems(artifacts);
        setSelected(artifactId || artifacts[0]?.id || "");
      } catch (cause) {
        if (signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Artefak belum dimuat.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [sessionId, artifactId]);

  const active = items.find(item => item.id === selected);
  function close() {
    if (dirty) {
      setError("Simpan atau batalkan perubahan sebelum menutup artefak.");
      return;
    }
    onClose();
  }

  return <dialog ref={dialog} className="study-artifact-dialog" onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="study-artifact-title">
    <header>
      <div><small>RUANG ARTEFAK</small><h2 id="study-artifact-title">{active?.title || "Artefak belajar"}</h2></div>
      <button type="button" onClick={close} aria-label="Tutup artefak"><X size={20} /></button>
    </header>
    {active && <div className="study-artifact-tools">
      <select aria-label="Pilih artefak" value={selected} disabled={dirty} onChange={event => { setSelected(event.target.value); setView("read"); }}>
        {items.map(item => <option key={item.id} value={item.id}>{item.title} · v{item.revision}</option>)}
      </select>
      {tabs.map(({ id, label, Icon }) => <button type="button" key={id} disabled={dirty && view !== id} aria-pressed={view === id} onClick={() => setView(id)}>
        <Icon size={16} aria-hidden="true" /><span>{label}</span>
      </button>)}
      <button type="button" aria-label="Unduh Word" onClick={async () => {
        const { downloadStudyDocx } = await import("@/lib/study-docx");
        downloadStudyDocx(active.title, active.content, []);
      }}><Download size={16} /></button>
    </div>}
    {error && <p role="alert" className="study-chat-error">{error}</p>}
    <div className="study-artifact-body">
      {loading && <LoadingStatus stage="synchronizing" detail="Membuka artefak…" />}
      {!loading && !active && !error && <p>Belum ada artefak. Minta Momo membuat artefak atau pilih “Jadikan artefak” pada jawaban.</p>}
      {active && view === "read" && <MarkdownView content={active.content} />}
      {active && view === "map" && <StudyMindmap nodes={boardMap(active.content, active.title)} onExplore={() => setView("read")} />}
      {active && view === "edit" && <Suspense fallback={<p>Menyiapkan editor…</p>}>
        <Editor key={active.id + ":" + active.revision} noteId="" title={active.title} content={active.content} label="Artefak tersimpan"
          onDirtyChange={setDirty} onSaved={() => { setDirty(false); setError(""); setView("read"); }}
          saveOverride={async content => {
            const response = await apiFetch("/api/study-artifacts", {
              method: "PUT", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: active.id, revision: active.revision, content }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setItems(previous => previous.map(item => item.id === data.id ? data : item));
            return data;
          }} />
      </Suspense>}
    </div>
    <footer>Hanya kamu yang dapat mengakses artefak percakapan ini. Perubahan disimpan sebagai revisi baru.</footer>
  </dialog>;
}
