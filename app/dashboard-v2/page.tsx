"use client";

import Image from "next/image";
import "./mobile.css";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Flame from "kubai-icons-react/icons/flame";
import FolderOpen from "kubai-icons-react/icons/folder-open";
import Globe from "kubai-icons-react/icons/globe";
import MessageCircle from "kubai-icons-react/icons/message-circle";
import Trophy from "kubai-icons-react/icons/trophy";
import Crown from "kubai-icons-react/icons/crown";
import { PhoneCall, Upload } from "lucide-react";
import PromptBar from "@/components/asisten/reactbits/PromptBar";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import DocumentAttachments from "@/components/dashboard/DocumentAttachments";
import V2MobileSidebar from "@/components/dashboard/V2MobileSidebar";
import PageTutorial from "@/components/tutorial/PageTutorial";
import StudyMode from "@/components/dashboard/StudyMode";
import ProfileChecklist from "@/components/tutorial/ProfileChecklist";
import { usePromptNoteJob } from "@/components/dashboard/usePromptNoteJob";
import PromptNoteProgress from "@/components/dashboard/PromptNoteProgress";
import SpeechInput from "@/components/asisten/SpeechInput";
import AiCallModal from "@/components/assistant/AiCallModal";
import CallIntroBanner from "@/components/dashboard/CallIntroBanner";
import { apiFetch } from "@/lib/apiClient";
import { usePremium } from "@/lib/usePremium";
import { ProLockedCard } from "@/components/ProGate";
import LoadingStatus from "@/components/ui/LoadingStatus";
import { getUserId } from "@/lib/identity";
import { useV2Progress } from "@/components/dashboard/V2Progress";
import { supabase } from "@/lib/supabase/client";
import { PENDING_PROMPT_KEY, type PendingPrompt } from "@/lib/assistant/pendingPrompt";
import type { NoteCreatePrefs } from "@/components/note/NoteCreateWizard";
import "./v2.css";
import "./simple-home.css";
import "./study-mode.css";

export default function DashboardV2() {
  const { isPremium, loading: planLoading, error: planError, refresh: refreshPlan } = usePremium();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [draft, setDraft] = useState("");
  const generation = usePromptNoteJob();
  const [workspace, setWorkspace] = useState<"chat" | "study">("chat");
  const [mode, setMode] = useState<"ask" | "note">("ask");
  const [openingChat, setOpeningChat] = useState(false);
  const chatLock = useRef(false);
  const [effort, setEffort] = useState("Seimbang");
  const { stats } = useV2Progress();
  const [inputError, setInputError] = useState("");
  const [callOpen, setCallOpen] = useState<"default" | "chat" | null>(null);
  useEffect(() => {
    if (generation.job?.status === "done" && generation.job.noteId) router.push(`/dashboard-v2/note/${encodeURIComponent(generation.job.noteId)}`);
  }, [generation.job?.status, generation.job?.noteId, router]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "note") setMode("note");
    else if (params.get("workspace") === "study") setWorkspace("study");
    // Keep previously shared collection links working after the move.
    if (params.has("subject") || window.location.hash === "#dv2-notes-title") {
      router.replace("/dashboard-v2/catatan" + (params.has("subject") ? "?subject=" + encodeURIComponent(params.get("subject") || "") : ""));
    }
  }, [router]);
  function selectWorkspace(next: typeof workspace) {
    setWorkspace(next);
    const url = new URL(window.location.href);
    if (next === "study") {
      url.searchParams.delete("mode");
      url.searchParams.set("workspace", "study");
    } else {
      url.searchParams.delete("workspace");
    }
    window.history.replaceState(null, "", url);
  }

  function attach(selected: FileList | null) {
    if (!selected?.length || generation.busy || chatLock.current) return;
    const incoming = Array.from(selected);
    if (files.length + incoming.length > 5) { setInputError("Lampirkan maksimal 5 file."); return; }
    if (incoming.some(file => !file.size || file.size > 4 * 1024 * 1024)) { setInputError("Setiap file harus berisi materi dan berukuran maksimal 4 MB."); return; }
    if (incoming.some(file => !/\.(pdf|doc|docx|ppt|pptx|xlsx|xls|csv|txt|md|rtf|odt|mp3|wav|m4a|ogg|flac|aac|mp4|webm|mov)$/i.test(file.name))) { setInputError("Gunakan dokumen PDF/Office/teks, audio, atau video yang didukung."); return; }
    setMode("note");
    setFiles(previous => [...previous, ...incoming]); setInputError("");
    if (!draft.trim()) setDraft("Buat catatan lengkap dari materi terlampir.");
  }
  function chooseNotePrompt(value: string) {
    if (generation.busy || chatLock.current) return;
    setMode("note");
    setInputError("");
    setDraft(value);
  }
  async function askMomo(question: string) {
    if (!question || chatLock.current) return;
    chatLock.current = true;
    setOpeningChat(true);
    setInputError("");
    try {
      const userId = (await supabase?.auth.getSession())?.data.session?.user.id;
      if (!userId) throw new Error("Masuk ke akunmu untuk memulai percakapan.");
      const response = await apiFetch("/api/assistant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.session?.id !== "string") {
        throw new Error(data.error || "Percakapan belum bisa dibuat.");
      }
      const pending: PendingPrompt = {
        prompt: question,
        sessionId: data.session.id,
        speedMode: effort === "Kilat" ? "fast" : effort === "Mendalam" ? "deep" : "normal",
      };
      sessionStorage.setItem(PENDING_PROMPT_KEY, JSON.stringify(pending));
      router.push(`/dashboard-v2/tanya-momo/${encodeURIComponent(data.session.id)}`);
    } catch (error) {
      chatLock.current = false;
      setOpeningChat(false);
      setInputError(error instanceof Error ? error.message : "Percakapan belum bisa dibuat.");
    }
  }
  function removeAttachment(index: number) {
    setFiles(previous => previous.filter((_, item) => item !== index));
    if (files.length === 1 && draft === "Buat catatan lengkap dari materi terlampir.") setDraft("");
  }
  const prefs: NoteCreatePrefs = { generationMode: effort === "Mendalam" ? "lengkap" : "cepat", chapterCount: effort === "Kilat" ? 2 : effort === "Mendalam" ? 5 : 3, studyMode: effort === "Kilat" ? "ringkas" : effort === "Mendalam" ? "lengkap" : "standar", noteType: "rangkuman" };
  function submit(text: string) {
    if (!isPremium) { router.push("/dashboard-v2/pricing"); return; }
    if (generation.busy || chatLock.current) return;
    if (mode === "ask") { void askMomo(text.trim()); return; }
    if (files.length) { setInputError(""); void generation.start(text.trim() || "Buat catatan dari materi terlampir", prefs, files); return; }
    if (text.trim().length < 10) { setInputError("Ceritakan topikmu sedikit lebih lengkap, minimal 10 karakter."); return; }
    setInputError("");
    const topic = text.trim().replace(/^(buatkan|buat|bikin)\s+(catatan\s+)?(tentang\s+)?/i, "");
    if (topic.length < 10 || topic.length > 2000) { setInputError("Isi topik belajar antara 10 dan 2.000 karakter."); return; }
    void generation.start(`Buat catatan tentang ${topic}`, prefs);
  }
  return <div className="dv2 dv2-simple">
    <header className="dv2-topbar dv2-mode-topbar">
      <V2MobileSidebar desktop />
      <Link className="dv2-brand" href="/dashboard-v2"><Image src="/icons/momo-192.png" alt="" width={32} height={32} className="eureka-brand-mark" />eureka! <span>V2 · Beta</span></Link>
      <nav aria-label="Navigasi Dashboard V2" className="dv2-topnav"><Link href={isPremium ? "/dashboard-v2/catatan" : "/dashboard-v2/pricing"}><FolderOpen trigger="parent" size={16} />Catatan</Link><Link href="/dashboard-v2/tanya-momo"><MessageCircle trigger="parent" size={16} />Tanya Momo</Link></nav>
      <div className="dv2-workspace-toggle" role="group" aria-label="Mode Eureka" data-workspace={workspace}>
        <span aria-hidden="true" />
        <button type="button" aria-pressed={workspace === "chat"} onClick={() => selectWorkspace("chat")}>Chat</button>
        <button type="button" aria-pressed={workspace === "study"} onClick={() => selectWorkspace("study")}>Belajar</button>
      </div>
      <div className="dv2-account"><PageTutorial guideId={workspace === "study" ? "study-mode" : "dashboard"} /><Link href="/dashboard-v2/aktivitas" className="dv2-stat dv2-streak"><Flame trigger="parent" size={16} />{stats ? `${stats.streak} hari` : "Streak"}</Link><Link href="/dashboard-v2/profil" className="dv2-stat dv2-level"><Trophy trigger="parent" size={16} />{stats ? `Level ${stats.level}` : "Profil"}</Link><Link href="/dashboard-v2/pricing" className="dv2-stat dv2-upgrade"><Crown trigger="parent" size={16} />Upgrade</Link></div>
    </header>
    <main className="dv2-main">
      <StudyMode active={workspace === "study"} />
      <section className="dv2-workspace" hidden={workspace === "study"} aria-labelledby="dv2-title">
        <div className="dv2-greeting"><div className="dv2-momo" data-momo-splash-target><MomoCompanion mode={effort === "Kilat" ? "fast" : effort === "Mendalam" ? "deep" : "normal"} thinking={openingChat} question={draft} /></div><h1 id="dv2-title">Mau belajar apa hari ini?</h1></div>
        <div className={`dv2-compose-area${!planLoading && !isPremium ? " is-pro-locked" : ""}`}>
          {planLoading ? <LoadingStatus stage="synchronizing" detail="Memeriksa paketmu" /> : planError ? <div className="eureka-pro-lock"><p role="alert">{planError}</p><button type="button" className="eureka-pro-cta" onClick={() => void refreshPlan()}>Coba lagi</button></div> : !isPremium ? <ProLockedCard /> : <>
          {generation.job ? <PromptNoteProgress generation={generation} /> : <>
          {mode === "note" && files.length > 0 && <DocumentAttachments files={files} onRemove={removeAttachment} />}
          <div className="dv2-prompt">
            <PromptBar clearOnSend={false} value={draft} onDraftChange={setDraft}
              placeholder={mode === "ask" ? "Tanya Momo apa saja…" : "Tulis topik atau tempel tautan materi…"}
              onSend={submit} disabled={openingChat} background="transparent" color="var(--v2-ink)"
              menuBackground="var(--v2-popover)" sparkColor="transparent" width={700}
              models={[]} efforts={["Kilat", "Seimbang", "Mendalam"]} defaultEffort={effort}
              onEffortChange={setEffort} commands={[]}
              leadingSlot={<div className="dv2-mode-slider" role="group" aria-label="Mode prompt" data-mode={mode}>
                <span className="dv2-mode-indicator" aria-hidden="true" />
                <button type="button" aria-pressed={mode === "ask"} disabled={openingChat}
                  onClick={() => { setMode("ask"); setInputError(""); }}>Chat</button>
                <button type="button" aria-pressed={mode === "note"} disabled={openingChat}
                  onClick={() => { setMode("note"); setInputError(""); }}>Note</button>
              </div>}
              voiceSlot={<SpeechInput userId={getUserId()} disabled={openingChat || generation.busy}
                  onText={text => { setInputError(""); setDraft(previous => previous + (previous && !/\s$/.test(previous) ? " " : "") + text); }}
                  onError={setInputError} />}
              sources={[
                ...(mode === "ask" && !openingChat ? [{ key: "momo-call", name: "Panggilan Momo atau Lala", description: "Panggilan suara dan kamera untuk Lala", icon: <PhoneCall size={16} />, action: () => setCallOpen("default") }] : []),
                { key: "upload", name: "Unggah materi", description: "Dokumen, slide, atau audio", icon: <Upload size={16} /> },
                { key: "web", name: "Tautan web", description: "Ringkas artikel menjadi catatan", icon: <Globe trigger="parent" size={16} /> },
                { key: "youtube", name: "YouTube", description: "Pelajari isi video", icon: <span className="dv2-youtube-logo" aria-hidden="true" /> },
              ]}
              onAttach={() => fileInput.current?.click()}
              onSourceSelect={source => source.key === "upload" ? fileInput.current?.click() : chooseNotePrompt(`Buat catatan dari ${source.key === "youtube" ? "video YouTube" : "artikel web"}: `)} />
          </div>

        {inputError && <p className="dv2-error" role="alert">{inputError}</p>}
        {openingChat && <p className="dv2-chat-opening" role="status">Membuka percakapan…</p>}
        </>}
        </>}
        </div>

      </section>

    </main>
    <ProfileChecklist />
    {isPremium && <CallIntroBanner paused={Boolean(callOpen || openingChat || generation.busy || workspace === "study")} onTry={() => setCallOpen("chat")} />}
    <AiCallModal open={callOpen !== null} chat={callOpen === "chat"} onClose={() => setCallOpen(null)} />
    <input ref={fileInput} className="sr-only" type="file" multiple aria-label="Lampirkan materi belajar" accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.xls,.csv,.txt,.md,.rtf,.odt,.mp3,.wav,.m4a,.ogg,.flac,.aac,.mp4,.webm,.mov" onChange={event => { attach(event.target.files); event.target.value = ""; }} />
  </div>;
}
