"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, BookOpen, CaseSensitive, ChevronLeft, ChevronRight, MessageCircleQuestion, Scissors, Smile, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import { PENDING_PROMPT_KEY, type PendingPrompt } from "@/lib/assistant/pendingPrompt";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import "./selection-actions.css";

function plainSelectionText(text: string) {
  return text
    .replace(/&(?:#x20|#32|nbsp);/gi, " ")
    .replace(/\\([*_.`#])/g, "$1")
    .replace(/\[([^\]\n]+)\]\(https?:\/\/[^\s)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^(\s*)[*+-][ \t]+/gm, "$1• ")
    .replace(/\*+|`+/g, "")
    .replace(/(^|\W)_{1,3}([^_\n]+)_{1,3}(?=\W|$)/g, "$1$2");
}

export default function SelectionActions({ noteId, chapterId, content, onChange, local = false, children }: {
  noteId: string; chapterId?: number; content: string; onChange: (content: string) => void; local?: boolean; children: ReactNode;
}) {
  const router = useRouter();
  const scope = useRef<HTMLDivElement>(null);
  const instructionRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLParagraphElement>(null);
  const [pick, setPick] = useState<{ selected: string; start: number; original: string; x: number; y: number } | null>(null);
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [explanation, setExplanation] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const streaming = busy && !ready;
  const url = `/api/notes/${encodeURIComponent(noteId)}`;

  useEffect(() => {
    if (streaming && resultRef.current) resultRef.current.scrollTop = resultRef.current.scrollHeight;
  }, [preview, streaming]);

  useEffect(() => {
    if (!pick || busy || openingChat) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !scope.current?.contains(event.target)) setPick(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [pick, busy, openingChat]);

  function selectText(target: EventTarget) {
    if (busy || openingChat || (target instanceof Element && target.closest("[data-selection-menu]"))) return;
    const selection = window.getSelection();
    const textarea = target instanceof HTMLTextAreaElement ? target : null;
    const selected = textarea ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) : selection?.toString().trim() ?? "";
    if (!selected.trim() || (!textarea && (!selection?.anchorNode || !selection.focusNode ||
        !scope.current?.contains(selection.anchorNode) || !scope.current.contains(selection.focusNode)))) {
      setPick(null);
      return;
    }
    const start = textarea ? textarea.selectionStart : content.indexOf(selected);
    const rect = textarea?.getBoundingClientRect() ?? selection!.getRangeAt(0).getBoundingClientRect();
    setPick({ selected, start, original: content, x: rect.left, y: rect.bottom });
    setPreview("");
    setReady(false);
    setExpanded(false);
    setExplanation(false);
    setInstruction("");
    setError(start < 0 || (!textarea && content.indexOf(selected, start + 1) !== -1)
      ? "Pilih satu potongan teks yang unik dan tidak melintasi format." : selected.length > 3000 ? "Pilih maksimal 3.000 karakter." : "");
  }

  async function generate(prompt: string, explain = false) {
    if (!pick || busy || openingChat || !prompt.trim() || pick.start < 0 || pick.selected.length > 3000 ||
      (!local && pick.original.indexOf(pick.selected, pick.start + 1) !== -1)) return;
    setBusy(true); setReady(false); setError(""); setPreview(""); setExplanation(explain); setGreeted(false);
    try {
      const response = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "selection-preview", selected: pick.selected, instruction: prompt, explain }) });
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => null))?.error || "AI belum bisa mengubah teks.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        setPreview(plainSelectionText(result));
      }
      result += decoder.decode();
      const clean = plainSelectionText(result).trim();
      if (!clean) throw new Error("AI tidak mengirim teks pengganti.");
      setPreview(clean);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI belum bisa mengubah teks.");
    } finally { setBusy(false); }
  }

  async function continueInChat(intent: "ask" | "learn") {
    if (!pick || !ready || busy || openingChat) return;
    setOpeningChat(true);
    setError("");
    try {
      const response = await apiFetch("/api/assistant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: getUserId() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.session?.id !== "string" || !data.session.id) {
        throw new Error("Chat baru belum bisa dibuka. Coba lagi.");
      }
      const instruction = intent === "learn"
        ? "Bantu saya mempelajari topik kutipan ini. Mulai dari konsep inti, beri satu contoh, lalu ajukan satu pertanyaan untuk mengecek pemahaman saya."
        : "Saya ingin bertanya lebih lanjut tentang kutipan ini. Jelaskan bagian pentingnya, lalu bantu saya menemukan pertanyaan lanjutan yang relevan.";
      // Keep both excerpts within the chat endpoint's 2,000-character limit.
      const excerpt = (value: string, limit: number) => value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`;
      const pending: PendingPrompt = {
        prompt: `${instruction}\n\nKutipan yang dipilih:\n${excerpt(pick.selected, 1050)}\n\nHasil Momo sebelumnya:\n${excerpt(preview, 670)}`,
      };
      sessionStorage.setItem(PENDING_PROMPT_KEY, JSON.stringify(pending));
      router.push(`/chat/${encodeURIComponent(data.session.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat baru belum bisa dibuka. Coba lagi.");
      setOpeningChat(false);
    }
  }

  async function apply() {
    if (!pick || busy || openingChat || !ready || explanation) return;
    if (content !== pick.original) { setError("Teks sudah berubah. Pilih ulang sebelum menyimpan."); return; }
    setBusy(true);
    try {
      const replacement = preview.trim();
      if (local) {
        const next = content.slice(0, pick.start) + replacement + content.slice(pick.start + pick.selected.length);
        if (next.length > 20000) throw new Error("Catatan pribadi maksimal 20.000 karakter.");
        onChange(next);
      } else {
        const response = await apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...pick, chapterId, action: "selection-apply", replacement }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        onChange(result.content);
      }
      window.getSelection()?.removeAllRanges();
      setPick(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Perubahan belum tersimpan.");
    } finally { setBusy(false); }
  }

  return <div ref={scope} onPointerUp={event => selectText(event.target)} onKeyUp={event => {
    if (event.key === "Escape" && !busy && !openingChat) setPick(null);
    else if (event.shiftKey || event.ctrlKey || event.metaKey) selectText(event.target);
  }}>
    {children}
    {pick && <section data-selection-menu aria-label="Selection Actions" className="selection-flyout" data-expanded={expanded || undefined}
      style={{ left: Math.max(12, Math.min(pick.x, window.innerWidth - (expanded ? 470 : 384))), top: Math.max(12, Math.min(pick.y + 8, window.innerHeight - (ready ? 360 : busy || preview || error ? 255 : 70))) }}>
      <form className="selection-pill" onSubmit={event => { event.preventDefault(); void generate(instruction); }}>
        {!expanded && <div className="selection-instruction">
          <input ref={instructionRef} aria-label="Instruksi perubahan" value={instruction} maxLength={500} onChange={event => setInstruction(event.target.value)} placeholder="Describe edits" />
          {instruction.trim() && <button type="submit" disabled={busy} aria-label="Kirim instruksi"><ArrowUp size={14} /></button>}
        </div>}
        <button type="button" disabled={busy} onClick={() => void generate("Jelaskan kutipan ini secara ringkas dan mudah dipahami.", true)}><MessageCircleQuestion size={14} /> Explain</button>
        <button type="button" disabled={busy} onClick={() => void generate("Perbaiki kejelasan dan alur teks tanpa mengubah makna.")}><Sparkles size={14} /> Improve</button>
        {expanded && <>
          <button type="button" disabled={busy} onClick={() => void generate("Persingkat teks sambil mempertahankan informasi utama.")}><Scissors size={14} /> Shorten</button>
          <button type="button" disabled={busy} onClick={() => { setExpanded(false); setInstruction("Ubah nada menjadi "); requestAnimationFrame(() => instructionRef.current?.focus()); }}><Smile size={14} /> Tone</button>
          <button type="button" disabled={busy} onClick={() => void generate("Perbaiki tata bahasa, ejaan, dan tanda baca.")}><CaseSensitive size={15} /> Grammar</button>
        </>}
        <button className="selection-more" type="button" aria-expanded={expanded} aria-label={expanded ? "Kembali ke instruksi" : "Tampilkan aksi lainnya"} onClick={() => setExpanded(value => !value)}>
          {expanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
      </form>
      {(busy || preview || error) && <div className="selection-result">
        <div className="selection-result-heading">
          <button type="button" className="selection-momo" aria-label="Sapa Momo" aria-pressed={greeted} onClick={() => setGreeted(value => !value)}>
            <MomoCompanion mode={greeted ? "fast" : "normal"} thinking={streaming && !greeted} response={greeted ? "Halo!" : ready ? "Selesai!" : ""} error={!!error && !greeted} />
          </button>
          <span role="status">{greeted ? "Halo!" : streaming ? preview ? "Momo sedang menulis…" : "Momo sedang berpikir…" : busy ? "Menyimpan perubahan…" : error ? "Proses belum selesai" : explanation ? "Penjelasan Momo" : "Pratinjau perubahan"}</span>
        </div>
        {streaming && !preview && <div aria-hidden="true" className="space-y-2"><div className="selection-skeleton h-3 rounded-full" /><div className="selection-skeleton h-3 w-2/3 rounded-full" /></div>}
        {preview && <p ref={resultRef} tabIndex={0} aria-label={explanation ? "Penjelasan Momo" : "Hasil edit Momo"} className="selection-result-text">{preview}{streaming && <span aria-hidden="true" className="selection-stream-cursor" />}</p>}
        {error && <p role="alert" className="mt-2 text-red-300">{error}</p>}
        {ready && <div className="selection-chat-actions" aria-label="Lanjutkan di chat">
          <button type="button" disabled={busy || openingChat} onClick={() => void continueInChat("ask")}><MessageCircleQuestion size={14} /> Tanya lebih lanjut</button>
          <button type="button" disabled={busy || openingChat} onClick={() => void continueInChat("learn")}><BookOpen size={14} /> Pelajari lebih lanjut</button>
        </div>}
        {openingChat && <p role="status" className="mt-2">Membuka chat…</p>}
        {!busy && <div className="selection-result-actions">
          {ready && !explanation && <button type="button" disabled={openingChat} onClick={() => void apply()}>Terapkan perubahan</button>}
          <button type="button" disabled={openingChat} onClick={() => setPick(null)} aria-label="Tutup aksi seleksi"><X size={16} /></button>
        </div>}
      </div>}
    </section>}
  </div>;
}
