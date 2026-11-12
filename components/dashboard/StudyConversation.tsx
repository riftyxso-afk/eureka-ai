"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ArrowUp from "kubai-icons-react/icons/arrow-up";
import BookOpen from "kubai-icons-react/icons/book-open";
import ChevronDown from "kubai-icons-react/icons/chevron-down";
import Download from "kubai-icons-react/icons/download";
import FolderOpen from "kubai-icons-react/icons/folder-open";
import Globe from "kubai-icons-react/icons/globe";
import Link2 from "kubai-icons-react/icons/link";
import NotebookPen from "kubai-icons-react/icons/notebook-pen";
import Square from "kubai-icons-react/icons/square";
import V2MobileSidebar from "@/components/dashboard/V2MobileSidebar";
import PageTutorial from "@/components/tutorial/PageTutorial";
import MarkdownView from "@/components/asisten/MarkdownView";
import LoadingStatus from "@/components/ui/LoadingStatus";
import ResearchStudio from "@/components/dashboard/ResearchStudio";
import "@/app/dashboard-v2/study-flows.css";
import "./research-studio.css";
import StudyActivities from "@/components/dashboard/StudyActivities";
import StudyVideoCards from "@/components/dashboard/StudyVideoCards";
import { useStudyAgent } from "@/components/dashboard/StudyAgentResult";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { STUDY_CHAT_PENDING, type StudyChatPending } from "@/lib/study-chat-pending";
import type { AssistantChatMessage } from "@/lib/assistant/types";
import type { StudySource } from "@/lib/study-sources-types";
import type { SavedStudyResponse } from "@/lib/study-interaction";
import "./study-conversation.css";
import StudyBrowserPanel from "./StudyBrowserPanel";

type Turn = { id: string; role: "user" | "assistant"; content: string; sources: StudySource[]; study?: SavedStudyResponse };

function fromMessage(message: AssistantChatMessage): Turn {
  return {
    id: message.id, role: message.role, content: message.content, study: message.study,
    sources: (message.webResults ?? []).map(item => ({
      title: item.title, url: item.url, excerpt: item.description, byline: item.domain, kind: "web",
    })),
  };
}

export default function StudyConversation({ sessionId, initialMessages, initialTitle }: { sessionId: string; initialTitle?: string; initialMessages?: AssistantChatMessage[] }) {
  const agent = useStudyAgent();
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const [browserSelected, setBrowserSelected] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    apiFetch("/api/study-agent", { signal: controller.signal }).then(response => response.ok ? response.json() : null).then(data => {
      if (!controller.signal.aborted) setBrowserEnabled(data?.browserEnabled === true);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  const [turns, setTurns] = useState<Turn[]>(initialMessages?.map(fromMessage) ?? []);
  const [title, setTitle] = useState(initialTitle || "Belajar bersama Momo");
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(!!initialMessages);
  const [error, setError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pending, setPending] = useState<StudyChatPending | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [lastNote, setLastNote] = useState<string | undefined>();
  const [noteId, setNoteId] = useState<string | undefined>();
  const [researchOpen, setResearchOpen] = useState(false);
  const [exportError, setExportError] = useState("");
  const autoStarted = useRef(false);
  const sending = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const scrollFrame = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        let messages = initialMessages;
        if (!messages) {
          const response = await apiFetch("/api/assistant/sessions/" + encodeURIComponent(sessionId) + "?userId=" + encodeURIComponent(getUserId()), { signal: controller.signal });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Percakapan belum bisa dimuat.");
          if (controller.signal.aborted) return;
          messages = data.messages;
          setTurns((messages ?? []).map(fromMessage));
          setTitle(data.session.title);
        }
        const contextKey = "eureka:study-chat-note:" + sessionId + ":" + getUserId();
        const context = localStorage.getItem(contextKey);
        if (context) setNoteId(context);
        const saved: StudyChatPending | null = JSON.parse(sessionStorage.getItem(STUDY_CHAT_PENDING) || "null");
        if (saved?.sessionId === sessionId && typeof saved.prompt === "string" && saved.prompt.trim()) {
          if (!messages?.some(message => message.role === "assistant")) setPending(saved);
          else sessionStorage.removeItem(STUDY_CHAT_PENDING);
          if (saved.noteId) {
            setNoteId(saved.noteId);
            localStorage.setItem(contextKey, saved.noteId);
          }
        }
        setLoaded(true);
      } catch (cause) {
        if (!controller.signal.aborted) { setLoaded(false); setError(cause instanceof Error ? cause.message : "Coba lagi."); }
      }
    }
    void load();
    return () => controller.abort();
  }, [sessionId, initialMessages, loadAttempt]);

  async function send(prompt: string, selectedNote = noteId) {
    const text = prompt.trim();
    if (!text || !loaded || sending.current) return;
    sending.current = true;
    setError("");
    setLastPrompt(text);
    setLastNote(selectedNote);
    setPending(null);
    sessionStorage.removeItem(STUDY_CHAT_PENDING);
    followBottom.current = true;
    setTurns(previous => previous.at(-1)?.role === "user" && previous.at(-1)?.content === text ? previous : [
      ...previous, { id: crypto.randomUUID(), role: "user", content: text, sources: [] },
    ]);
    try {
      const response = await agent.run(text, { sessionId, noteId: selectedNote, browser: browserSelected });
      if (response) {
        setTitle(response.title);
        setTurns(previous => [...previous, {
          id: crypto.randomUUID(), role: "assistant", content: response.text, sources: response.sources,
          study: { title: response.title, document: response.document, interaction: response.interaction ?? { steps: [], suggestions: [] } },
        }]);
      }
    } finally {
      sending.current = false;
    }
  }

  useEffect(() => {
    if (!loaded || !pending || autoStarted.current) return;
    autoStarted.current = true;
    void send(pending.prompt, pending.noteId);
    // A pending handoff is consumed once per mounted conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, pending]);

  useEffect(() => {
    if (!followBottom.current || !transcript.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      const el = transcript.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => { if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current); };
  }, [turns, agent.text, agent.status, agent.browserActivity]);

  async function download(turn: Turn) {
    setExportError("");
    try {
      const { downloadStudyDocx } = await import("@/lib/study-docx");
      downloadStudyDocx(turn.study?.title || title, turn.content, turn.sources);
    } catch { setExportError("Dokumen belum bisa diunduh. Coba lagi."); }
  }

  return <main className="study-conversation">
    <header className="study-chat-header">
      <V2MobileSidebar desktop />
      <Link href="/dashboard-v2?workspace=study" className="study-chat-brand"><BookOpen size={19} aria-hidden="true" /><span>Belajar</span></Link>
      <span className="study-chat-title">{title}</span>
      <PageTutorial guideId="study-conversation" />
      <Link className="study-chat-new" href="/dashboard-v2?workspace=study" aria-label="Percakapan belajar baru"><NotebookPen size={17} aria-hidden="true" /><span>Chat baru</span></Link>
    </header>
    <div className="study-chat-transcript" ref={transcript} onScroll={event => {
      const el = event.currentTarget;
      followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 180;
    }}>
      <div className="study-chat-width">
        <details className="study-chat-research" open={researchOpen} onToggle={event => setResearchOpen(event.currentTarget.open)}>
          <summary><FolderOpen size={18} aria-hidden="true" />Proyek riset bersama teman<ChevronDown size={16} aria-hidden="true" /></summary>
          {researchOpen && <div className="study-flow"><ResearchStudio sourcesEnabled /></div>}
        </details>
        {!loaded && !error && <LoadingStatus stage="synchronizing" detail="Memuat percakapan belajar" />}
        {loaded && !turns.length && !agent.busy && <div className="study-chat-empty"><Image src="/icons/momo-192.png" alt="" width={56} height={56} /><h1>Mau belajar atau membuat apa?</h1><p>Tanya konsep, kirim tautan YouTube, cari sumber, atau buat dokumen bersama Momo.</p></div>}
        {turns.map(turn => <article className={"study-chat-turn " + turn.role} key={turn.id}>
          {turn.role === "user" ? <p>{turn.content}</p> : <>
            <div className="study-chat-assistant-label"><Image src="/icons/momo-192.png" alt="" width={28} height={28} /><strong>Momo</strong></div>
            <MarkdownView content={turn.content} />
            <StudyVideoCards sources={turn.sources} />
            {turn.study && <StudyActivities storageKey={"eureka:study-checklist:" + getUserId() + ":" + sessionId + ":" + turn.content.slice(0, 70)} data={turn.study.interaction} disabled={agent.busy} onSend={prompt => void send(prompt)} />}
            <div className="study-chat-response-actions"><button type="button" onClick={() => void download(turn)}><Download size={16} aria-hidden="true" />Unduh DOCX</button>
              {turn.sources.length > 0 && <details><summary><Link2 size={16} aria-hidden="true" />Sumber · {turn.sources.length}</summary><ol>{turn.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ol></details>}
            </div>
          </>}
        </article>)}
        <StudyBrowserPanel activities={agent.browserActivity} busy={agent.busy} />
        {agent.busy && <article className="study-chat-live" aria-busy="true">
          {agent.status && <LoadingStatus stage={agent.status.stage} detail={agent.status.label} />}
          {agent.text && <p className="study-chat-stream">{agent.text}</p>}
        </article>}
        {(agent.error || error) && <div className="study-chat-error" role="alert"><p>{error || agent.error}</p>
          {error && !loaded && <button type="button" onClick={() => { setError(""); setLoadAttempt(n => n + 1); }}>Muat ulang percakapan</button>}
          {lastPrompt && !agent.busy && <button type="button" onClick={() => void send(lastPrompt, lastNote)}>Coba lagi</button>}
        </div>}
        {exportError && <p className="study-chat-error" role="alert">{exportError}</p>}
      </div>
    </div>
    <footer className="study-chat-footer">
      <div className="study-browser-control"><label title={browserEnabled ? "Momo menelusuri halaman publik dengan browser" : "Koneksi browser sedang disiapkan"}>
        <input type="checkbox" checked={browserSelected} disabled={!browserEnabled || agent.busy} onChange={event => setBrowserSelected(event.target.checked)} />
        <Globe size={16} aria-hidden="true" /> Lihat Momo bekerja <span>{browserEnabled ? "Browser" : "Segera tersedia"}</span>
      </label></div><form className="study-chat-composer" onSubmit={event => { event.preventDefault(); if (loaded && draft.trim() && !sending.current) { void send(draft); setDraft(""); } }}>
      <label className="sr-only" htmlFor="study-chat-prompt">Pesan belajar</label>
      <textarea id="study-chat-prompt" rows={1} maxLength={6000} value={draft} disabled={!loaded} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
          event.preventDefault();
          if (!agent.busy) event.currentTarget.form?.requestSubmit();
        }
      }} placeholder="Tanya Momo atau minta bahan belajar…" />
      <div><span>{noteId ? <BookOpen size={15} aria-hidden="true" /> : <Globe size={15} aria-hidden="true" />}{noteId ? "Menggunakan catatanmu" : "Pencarian sumber otomatis"}</span>
        {agent.busy ? <button type="button" aria-label="Hentikan respons" onClick={agent.stop}><Square size={17} /></button>
          : <button type="submit" aria-label="Kirim pesan belajar" disabled={!loaded || !draft.trim()}><ArrowUp size={20} /></button>}
      </div>
    </form></footer>
  </main>;
}
