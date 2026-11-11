"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Square } from "lucide-react";
import V2MobileSidebar from "@/components/dashboard/V2MobileSidebar";
import PageTutorial from "@/components/tutorial/PageTutorial";
import StudyArt from "@/components/dashboard/StudyArt";
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

type Turn = { id: string; role: "user" | "assistant"; content: string; sources: StudySource[]; study?: SavedStudyResponse };

function fromMessage(message: AssistantChatMessage): Turn {
  return {
    id: message.id, role: message.role, content: message.content, study: message.study,
    sources: (message.webResults ?? []).map(item => ({
      title: item.title, url: item.url, excerpt: item.description, byline: item.domain, kind: "web",
    })),
  };
}

export default function StudyConversation({ sessionId, initialMessages }: { sessionId: string; initialMessages?: AssistantChatMessage[] }) {
  const agent = useStudyAgent();
  const [turns, setTurns] = useState<Turn[]>(initialMessages?.map(fromMessage) ?? []);
  const [title, setTitle] = useState("Belajar bersama Momo");
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(!!initialMessages);
  const [error, setError] = useState("");
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
        if (!controller.signal.aborted) { setLoaded(true); setError(cause instanceof Error ? cause.message : "Coba lagi."); }
      }
    }
    void load();
    return () => controller.abort();
  }, [sessionId, initialMessages]);

  async function send(prompt: string, selectedNote = noteId) {
    const text = prompt.trim();
    if (!text || !loaded || sending.current) return;
    sending.current = true;
    setDraft("");
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
      const response = await agent.run(text, { sessionId, noteId: selectedNote });
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
  }, [turns, agent.text, agent.status]);

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
      <Link href="/dashboard-v2?workspace=study" className="study-chat-brand"><StudyArt name="map" size={30} /><span>Belajar</span></Link>
      <span className="study-chat-title">{title}</span>
      <PageTutorial guideId="study-conversation" />
      <Link className="study-chat-new" href="/dashboard-v2?workspace=study">Baru</Link>
    </header>
    <div className="study-chat-transcript" ref={transcript} onScroll={event => {
      const el = event.currentTarget;
      followBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 180;
    }}>
      <div className="study-chat-width">
        <details className="study-chat-research" open={researchOpen} onToggle={event => setResearchOpen(event.currentTarget.open)}>
          <summary>Proyek riset bersama teman</summary>
          {researchOpen && <div className="study-flow"><ResearchStudio sourcesEnabled /></div>}
        </details>
        {!loaded && <LoadingStatus stage="synchronizing" detail="Memuat percakapan belajar" />}
        {loaded && !turns.length && !agent.busy && <div className="study-chat-empty"><h1>Mau belajar atau membuat apa?</h1><p>Tanya konsep, kirim tautan YouTube, cari sumber, atau buat dokumen bersama Momo.</p></div>}
        {turns.map(turn => <article className={"study-chat-turn " + turn.role} key={turn.id}>
          {turn.role === "user" ? <p>{turn.content}</p> : <>
            <div className="study-chat-assistant-label"><StudyArt name="target" size={26} /><strong>Momo · Belajar</strong></div>
            <MarkdownView content={turn.content} />
            <StudyVideoCards sources={turn.sources} />
            {turn.study && <StudyActivities storageKey={"eureka:study-checklist:" + getUserId() + ":" + sessionId + ":" + turn.content.slice(0, 70)} data={turn.study.interaction} disabled={agent.busy} onSend={prompt => void send(prompt)} />}
            <div className="study-chat-response-actions"><button type="button" onClick={() => void download(turn)}>Unduh DOCX</button>
              {turn.sources.length > 0 && <details><summary>Sumber · {turn.sources.length}</summary><ol>{turn.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ol></details>}
            </div>
          </>}
        </article>)}
        {agent.busy && <article className="study-chat-live" aria-busy="true">
          {agent.status && <LoadingStatus stage={agent.status.stage} detail={agent.status.label} />}
          {agent.text && <p className="study-chat-stream">{agent.text}</p>}
        </article>}
        {(agent.error || error) && <div className="study-chat-error" role="alert"><p>{error || agent.error}</p>
          {lastPrompt && !agent.busy && <button type="button" onClick={() => void send(lastPrompt, lastNote)}>Coba lagi</button>}
        </div>}
        {exportError && <p className="study-chat-error" role="alert">{exportError}</p>}
      </div>
    </div>
    <footer className="study-chat-footer"><form className="study-chat-composer" onSubmit={event => { event.preventDefault(); void send(draft); }}>
      <label className="sr-only" htmlFor="study-chat-prompt">Pesan belajar</label>
      <textarea id="study-chat-prompt" rows={2} maxLength={6000} value={draft} disabled={!loaded} onChange={event => setDraft(event.target.value)} placeholder="Tanya, cari video, atau minta Momo membuat sesuatu…" />
      <div><span>{noteId ? "Menggunakan catatanmu" : "Pencarian sumber otomatis"}</span>
        {agent.busy ? <button type="button" aria-label="Hentikan respons" onClick={agent.stop}><Square size={17} /></button>
          : <button type="submit" aria-label="Kirim pesan belajar" disabled={!loaded || !draft.trim()}><ArrowUp size={20} /></button>}
      </div>
    </form></footer>
  </main>;
}
