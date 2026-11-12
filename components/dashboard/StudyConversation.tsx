"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BookOpen from "kubai-icons-react/icons/book-open";
import ChevronDown from "kubai-icons-react/icons/chevron-down";
import Download from "kubai-icons-react/icons/download";
import FolderOpen from "kubai-icons-react/icons/folder-open";
import Monitor from "kubai-icons-react/icons/monitor";
import Plus from "kubai-icons-react/icons/circle-plus";
import Globe from "kubai-icons-react/icons/globe";
import Link2 from "kubai-icons-react/icons/link";
import V2MobileSidebar from "@/components/dashboard/V2MobileSidebar";
import PageTutorial from "@/components/tutorial/PageTutorial";
import MessageBubble from "@/components/asisten/MessageBubble";
import ChatSidebar from "@/components/asisten/ChatSidebar";
import PromptBar from "@/components/asisten/reactbits/PromptBar";
import SpeechInput from "@/components/asisten/SpeechInput";
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
import type { AssistantChatSession, AssistantChatMessage } from "@/lib/assistant/types";
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
  const router = useRouter();
  const [sessions, setSessions] = useState<AssistantChatSession[]>([]);
  const [speedMode, setSpeedMode] = useState<"fast" | "normal" | "deep">("normal");
  const [micError, setMicError] = useState("");
  useEffect(() => {
    if (agent.busy) return;
    const controller = new AbortController();
    apiFetch("/api/assistant/sessions?userId=" + encodeURIComponent(getUserId()), { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted && data?.sessions) setSessions(data.sessions); }).catch(() => {});
    return () => controller.abort();
  }, [sessionId, agent.busy]);
  async function changeSession(id: string, newTitle?: string) {
    const response = await apiFetch("/api/assistant/sessions/" + encodeURIComponent(id) + (newTitle === undefined ? "?userId=" + encodeURIComponent(getUserId()) : ""), {
      method: newTitle === undefined ? "DELETE" : "PATCH",
      ...(newTitle === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: getUserId(), title: newTitle }) }),
    });
    if (!response.ok) { setError("Percakapan belum bisa diubah. Coba lagi."); return; }
    setSessions(previous => newTitle === undefined ? previous.filter(session => session.id !== id) : previous.map(session => session.id === id ? { ...session, title: newTitle } : session));
    if (id === sessionId) {
      if (newTitle === undefined) router.replace("/dashboard-v2?workspace=study");
      else setTitle(newTitle);
    }
  }
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
        const previous = [...(messages ?? [])].reverse().find(message => message.role === "assistant" && message.study);
        if (previous?.study?.computerUse !== undefined) setBrowserSelected(previous.study.computerUse);
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
    if (text.length > 6000) { setError("Tulis pesan maksimal 6.000 karakter."); return; }
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
      const response = await agent.run(text, { sessionId, noteId: selectedNote, browser: browserSelected, speedMode });
      if (response) {
        setTitle(response.title);
        setTurns(previous => [...previous, {
          id: crypto.randomUUID(), role: "assistant", content: response.text, sources: response.sources,
          study: { title: response.title, document: response.document, browser: response.browser, computerUse: response.computerUse, interaction: response.interaction ?? { steps: [], suggestions: [] } },
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

  useEffect(() => {
    const element = transcript.current;
    const content = element?.firstElementChild;
    if (!element || !content) return;
    const observer = new ResizeObserver(() => {
      if (followBottom.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  async function download(turn: Turn) {
    setExportError("");
    try {
      const { downloadStudyDocx } = await import("@/lib/study-docx");
      downloadStudyDocx(turn.study?.title || title, turn.content, turn.sources);
    } catch { setExportError("Dokumen belum bisa diunduh. Coba lagi."); }
  }

  function message(turn: Turn): AssistantChatMessage {
    return { ...turn, sessionId, mentions: [], sources: [], model: "eureka-study", createdAt: "", study: turn.study };
  }

  return <div className="momo-session study-session flex h-dvh overflow-hidden bg-clay-beige p-0">
    <ChatSidebar sessions={sessions} activeId={sessionId} onNew={() => router.push("/dashboard-v2?workspace=study")} onSelect={() => {}} onRename={async (id, newTitle) => { await changeSession(id, newTitle); }} onDelete={async id => { await changeSession(id); }} />
    <main className="study-conversation">
    <header className="study-chat-header chat-session-header">
      <V2MobileSidebar sessions={sessions} />
      <Link href="/dashboard-v2?workspace=study" className="study-chat-brand"><BookOpen size={19} aria-hidden="true" /><span>Belajar</span></Link>
      <span className="study-chat-title">{title}</span>
      <PageTutorial guideId="study-conversation" />
      <Link className="study-chat-new" href="/dashboard-v2?workspace=study" aria-label="Percakapan belajar baru"><Plus size={16} /></Link>
    </header>
    <div className="study-chat-transcript chat-session-messages" ref={transcript} onScroll={event => {
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
        {turns.map(turn => <article className="study-chat-turn" key={turn.id}>
          <MessageBubble message={message(turn)} videoEnabled={false} />
          {turn.role === "assistant" && <div className="study-chat-extras">
            <StudyVideoCards sources={turn.sources} />
            {turn.study && <StudyActivities storageKey={"eureka:study-checklist:" + getUserId() + ":" + sessionId + ":" + turn.content.slice(0, 70)} data={turn.study.interaction} disabled={agent.busy} onSend={prompt => void send(prompt)} />}
            <div className="study-chat-response-actions"><button type="button" onClick={() => void download(turn)}><Download size={16} aria-hidden="true" />Unduh DOCX</button>
              {turn.sources.length > 0 && <details><summary><Link2 size={16} aria-hidden="true" />Sumber · {turn.sources.length}<ChevronDown size={15} aria-hidden="true" /></summary><ol>{turn.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ol></details>}
            </div>
          </div>}
        </article>)}
        {agent.browserActivity.length > 0 && <StudyBrowserPanel activities={agent.browserActivity} busy={agent.busy} />}
        {agent.busy && <article className="study-chat-live" aria-busy="true">
          {agent.status && <LoadingStatus stage={agent.status.stage} detail={agent.status.label} />}
          {agent.text && <MessageBubble message={message({ id: "study-stream", role: "assistant", content: agent.text, sources: [] })} isStreaming videoEnabled={false} />}
        </article>}
        {(agent.error || error) && <div className="study-chat-error" role="alert"><p>{error || agent.error}</p>
          {error && !loaded && <button type="button" onClick={() => { setError(""); setLoadAttempt(n => n + 1); }}>Muat ulang percakapan</button>}
          {lastPrompt && !agent.busy && <button type="button" onClick={() => void send(lastPrompt, lastNote)}>Coba lagi</button>}
        </div>}
        {exportError && <p className="study-chat-error" role="alert">{exportError}</p>}
      </div>
    </div>
    <footer className="study-chat-footer momo-session-composer">
      {browserSelected && <div className="study-computer-controls"><div className="study-computer-chip"><Monitor color="#8253d4" size={17} aria-hidden="true" /><span>Computer Use</span><button type="button" disabled={agent.busy} aria-label="Nonaktifkan Computer Use" onClick={() => setBrowserSelected(false)}>×</button></div><PageTutorial guideId="computer-use" /></div>}
      {micError && <p className="study-chat-error" role="alert">{micError}</p>}
      <div className="eureka-prompt-wrap study-chat-composer">
        <PromptBar value={draft} onDraftChange={setDraft} busy={agent.busy} disabled={!loaded} placeholder="Tanya Momo atau minta bahan belajar…"
          sources={[
            { key: "computer-use", name: "Computer Use", description: browserEnabled ? browserSelected ? "Aktif · klik untuk menonaktifkan" : "Lihat AI bekerja secara langsung" : "Belum tersedia untuk akun ini", icon: <Monitor color="#8253d4" size={20} />, action: () => {
              if (agent.busy) return;
              if (!browserEnabled) { setError("Computer Use belum diaktifkan untuk akun ini."); return; }
              setBrowserSelected(previous => !previous);
            } },
            { key: "research", name: "Proyek riset", icon: <FolderOpen size={16} />, action: () => setResearchOpen(true) },
            { key: "video", name: "Cari video", icon: <Globe size={16} />, action: () => setDraft("Carikan video pembelajaran tentang ") },
            { key: "document", name: "Buat dokumen", icon: <Download size={16} />, action: () => setDraft("Buatkan dokumen yang rapi tentang ") },
          ]}
          background="rgb(var(--clay-cream))" color="rgb(var(--clay-dark))" menuBackground="rgb(var(--clay-cream))" sparkColor="#a983e8" width={760} radius={18} maxRows={5} commands={[]} defaultEffort="Seimbang"
          models={[]} efforts={["Kilat", "Seimbang", "Mendalam"]} onEffortChange={effort => setSpeedMode(effort === "Kilat" ? "fast" : effort === "Mendalam" ? "deep" : "normal")}
          onSend={prompt => { void send(prompt); }} onStop={agent.stop}
          voiceSlot={<SpeechInput userId={getUserId()} disabled={!loaded || agent.busy} onText={text => setDraft(previous => (previous + " " + text).trim())} onError={setMicError} />}
        />
      </div>
    </footer>
  </main></div>;
}
