"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import type { Mark, Node as DocumentNode } from "@tiptap/pm/model";
import { ArrowUp, Check, ChevronLeft, ChevronRight, MessageCircleQuestion, Scissors, Smile, Sparkles, CaseSensitive, X, Square } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { plainSelectionText, selectionReplacement } from "@/lib/selectionEdit";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import "./editor-selection.css";

type Pick = { from: number; to: number; selected: string; doc: DocumentNode };
type Result = { text: string; explain: boolean; state: "idle" | "streaming" | "ready" | "error"; error: string };
const EMPTY: Result = { text: "", explain: false, state: "idle", error: "" };
const TOUCH_LAYOUT = "(pointer: coarse), (max-width: 700px)";
const ACTIONS = [
  { name: "Explain", icon: MessageCircleQuestion, prompt: "Jelaskan kutipan ini secara ringkas dan mudah dipahami.", explain: true },
  { name: "Improve", icon: Sparkles, prompt: "Perbaiki kejelasan dan alur teks tanpa mengubah makna." },
  { name: "Shorten", icon: Scissors, prompt: "Persingkat teks sambil mempertahankan informasi utama." },
  { name: "Grammar", icon: CaseSensitive, prompt: "Perbaiki tata bahasa, ejaan, dan tanda baca tanpa mengubah makna." },
];

export default function EditorSelectionActions({ editor, noteId, disabled }: { editor: Editor | null; noteId: string; disabled: boolean }) {
  const [pick, setPick] = useState<Pick | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<Result>(EMPTY);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const [stale, setStale] = useState(false);
  const flyout = useRef<HTMLElement>(null); const rail = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLFormElement>(null); const input = useRef<HTMLInputElement>(null);
  const output = useRef<HTMLParagraphElement>(null);
  const controller = useRef<AbortController | null>(null);
  const active = useRef(false); const closing = useRef(false); const keyboard = useRef(false);
  const previousWidth = useRef(0); const follow = useRef(true);
  const pointerSelecting = useRef(false);
  const busy = result.state === "streaming";

  const close = useCallback((focus = false) => {
    if (closing.current) return;
    controller.current?.abort(); active.current = false; closing.current = true;
    const finish = () => { setPick(null); setResult(EMPTY); closing.current = false; if (focus && editor && !editor.isDestroyed) editor.commands.focus(); };
    if (flyout.current && !keyboard.current && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      flyout.current.animate([{ opacity: 1, transform: "translateY(0) scale(1)" }, { opacity: 0, transform: "translateY(-3px) scale(.98)" }], { duration: 125, easing: "cubic-bezier(.23,1,.32,1)", fill: "forwards" }).finished.then(finish, finish);
    } else finish();
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    let settle = 0;
    const inspect = () => {
      if (active.current || disabled || closing.current || pointerSelecting.current || !editor.view.dom.contains(document.activeElement)) return;
      const { from, to, empty, $from, $to } = editor.state.selection;
      const selected = editor.state.doc.textBetween(from, to, "\n");
      if (empty || !selected.trim()) { setPick(null); return; }
      if (pick?.from === from && pick.to === to && pick.doc.eq(editor.state.doc)) return;
      const crossesCells = editor.isActive("table") && $from.parent !== $to.parent;
      setPick({ from, to, selected, doc: editor.state.doc }); setExpanded(false); setInstruction(""); setStale(false);
      setResult({ ...EMPTY, error: selected.length > 3000 ? "Pilih maksimal 3.000 karakter." : crossesCells ? "Pilih teks di dalam satu sel tabel." : "" });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      const inspectNextFrame = () => { frame = requestAnimationFrame(inspect); };
      // Touch handles can continue changing the selection after pointerup.
      if (matchMedia(TOUCH_LAYOUT).matches) settle = window.setTimeout(inspectNextFrame, 240);
      else inspectNextFrame();
    };
    const pointerDown = (event: PointerEvent) => { if (editor.view.dom.contains(event.target as Node)) { pointerSelecting.current = true; keyboard.current = false; } };
    const pointerUp = () => { if (pointerSelecting.current) { pointerSelecting.current = false; schedule(); } };
    const keyUp = (event: KeyboardEvent) => { if (editor.view.dom.contains(event.target as Node) && (event.shiftKey || ["Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key))) { keyboard.current = true; schedule(); } };
    const changed = () => { if (pick && !pick.doc.eq(editor.state.doc)) setStale(true); };
    document.addEventListener("pointerdown", pointerDown); document.addEventListener("pointerup", pointerUp); document.addEventListener("pointercancel", pointerUp); document.addEventListener("keyup", keyUp); editor.on("selectionUpdate", schedule); editor.on("update", changed);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(settle); document.removeEventListener("pointerdown", pointerDown); document.removeEventListener("pointerup", pointerUp); document.removeEventListener("pointercancel", pointerUp); document.removeEventListener("keyup", keyUp); editor.off("selectionUpdate", schedule); editor.off("update", changed); };
  }, [editor, disabled, pick]);

  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => {
    if (!pick) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !flyout.current?.contains(event.target)) { keyboard.current = false; if (editor?.view.dom.contains(event.target)) { controller.current?.abort(); active.current = false; setPick(null); setResult(EMPTY); } else close(); }
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); keyboard.current = true; close(true); } };
    document.addEventListener("pointerdown", dismiss); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [pick, editor, close]);

  useLayoutEffect(() => {
    if (!pick || !editor || !flyout.current) return;
    const place = () => {
      if (editor.isDestroyed || !flyout.current) return;
      const viewport = window.visualViewport; const leftEdge = viewport?.offsetLeft ?? 0; const topEdge = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? innerWidth; const height = viewport?.height ?? innerHeight;
      let start; let end;
      try { start = editor.view.coordsAtPos(pick.from); end = editor.view.coordsAtPos(pick.to); } catch { return; }
      const bounds = flyout.current.getBoundingClientRect();
      if (matchMedia(TOUCH_LAYOUT).matches) {
        // Leave the space around both selection handles to the native menu.
        const bottomDock = Math.max(topEdge + 16, topEdge + height - bounds.height - 20);
        const topDock = topEdge + 16;
        const spaceAbove = start.top - topDock;
        const spaceBelow = bottomDock - end.bottom;
        setPosition({
          left: leftEdge + Math.max(12, (width - bounds.width) / 2),
          top: spaceBelow < 88 && spaceAbove > spaceBelow + bounds.height ? topDock : bottomDock,
        });
        return;
      }
      const below = end.bottom + 8;
      const top = below + bounds.height < topEdge + height - 12 ? below : start.top - bounds.height - 8;
      setPosition({ left: Math.max(leftEdge + 12, Math.min(start.left, leftEdge + width - bounds.width - 12)), top: Math.max(topEdge + 12, Math.min(top, topEdge + height - bounds.height - 12)) });
    };
    place(); const observer = new ResizeObserver(place); observer.observe(flyout.current);
    const viewport = window.visualViewport;
    window.addEventListener("scroll", place, true); window.addEventListener("resize", place); viewport?.addEventListener("resize", place); viewport?.addEventListener("scroll", place);
    return () => { observer.disconnect(); window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place); viewport?.removeEventListener("resize", place); viewport?.removeEventListener("scroll", place); };
  }, [editor, pick, expanded]);

  useLayoutEffect(() => {
    if (!pick || !rail.current || !row.current) return;
    const reduced = keyboard.current || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (previousWidth.current && !reduced) {
      const ratio = previousWidth.current / rail.current.offsetWidth;
      rail.current.getAnimations().forEach(animation => animation.cancel());
      rail.current.animate([{ transform: `scaleX(${ratio})` }, { transform: "scaleX(1)" }], { duration: 200, easing: "cubic-bezier(.23,1,.32,1)" });
      row.current.animate([{ opacity: .35, transform: `translateX(${expanded ? 5 : -5}px)` }, { opacity: 1, transform: "translateX(0)" }], { duration: 180, easing: "cubic-bezier(.23,1,.32,1)" });
    }
    previousWidth.current = 0;
  }, [expanded, pick]);

  useEffect(() => { if (follow.current && output.current) output.current.scrollTop = output.current.scrollHeight; }, [result.text]);
  function toggle(expand: boolean, pointer: boolean) { keyboard.current = !pointer; previousWidth.current = rail.current?.getBoundingClientRect().width ?? 0; setExpanded(expand); }

  async function generate(prompt: string, explain = false) {
    if (!pick || !editor || active.current || disabled || stale || pick.selected.length > 3000 || result.error && result.state === "idle" || !prompt.trim()) return;
    active.current = true; follow.current = true; const request = new AbortController(); controller.current = request;
    setResult({ ...EMPTY, state: "streaming", explain });
    try {
      const response = await apiFetch(`/api/notes/${encodeURIComponent(noteId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "selection-preview", selected: pick.selected, instruction: prompt, explain }), signal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]) });
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => null))?.error || "AI belum bisa mengolah teks.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let text = "";
      try {
        for (;;) { const { value, done } = await reader.read(); text += decoder.decode(value, { stream: !done }); if (request.signal.aborted) return; setResult(current => ({ ...current, text: plainSelectionText(text) })); if (done) break; }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const clean = plainSelectionText(text).trim();
      if (!clean) throw new Error("AI tidak mengirim hasil. Silakan coba lagi.");
      if (!request.signal.aborted) setResult({ text: clean, explain, state: "ready", error: "" });
    } catch (failure) {
      if (!request.signal.aborted) setResult(current => ({ ...current, state: "error", error: failure instanceof Error && failure.name === "TimeoutError" ? "AI membutuhkan waktu lebih lama. Coba lagi." : "Proses terputus. Coba lagi untuk mendapatkan hasil lengkap." }));
    } finally { if (controller.current === request) active.current = false; }
  }

  function apply() {
    if (!editor || !pick || busy || disabled || result.explain || result.state !== "ready") return;
    if (!pick.doc.eq(editor.state.doc)) { setStale(true); return; }
    if (result.text.length > 6000) { setResult(current => ({ ...current, error: "Hasil terlalu panjang. Coba aksi Shorten." })); return; }
    // Keep formatting shared by the entire range, rather than spreading a bold first word over the replacement.
    let marks: readonly Mark[] | null = null;
    pick.doc.nodesBetween(pick.from, pick.to, node => { if (node.isText) marks = marks === null ? node.marks : marks.filter(mark => node.marks.some(other => other.eq(mark))); });
    const inserted = editor.chain().focus().setTextSelection({ from: pick.from, to: pick.to }).command(({ tr }) => { tr.setStoredMarks(marks ?? []); return true; }).insertContentAt({ from: pick.from, to: pick.to }, selectionReplacement(result.text)).run();
    if (inserted) close(); else setResult(current => ({ ...current, error: "Pilihan ini tidak bisa diganti. Pilih satu paragraf lalu coba lagi." }));
  }

  if (!pick || !editor) return null;
  const unavailable = disabled || busy || stale || pick.selected.length > 3000 || !!(result.state === "idle" && result.error);
  return createPortal(<section ref={flyout} data-editor-selection className={`esa-flyout ${expanded ? "is-expanded" : ""} ${keyboard.current ? "is-keyboard" : ""}`} aria-label="Selection Actions" style={position}>
    <div className="esa-shell"><div ref={rail} className="esa-rail" aria-hidden="true" />
      <form ref={row} className="esa-pill" role="toolbar" aria-label="Aksi teks terpilih" onPointerDown={event => { if (!(event.target instanceof HTMLInputElement)) event.preventDefault(); }} onSubmit={event => { event.preventDefault(); void generate(instruction); }}>
        {!expanded && <div className="esa-instruction"><input ref={input} aria-label="Instruksi perubahan" placeholder="Describe edits" maxLength={500} disabled={unavailable} value={instruction} onChange={event => setInstruction(event.target.value)} />{instruction.trim() && <button type="submit" disabled={unavailable} aria-label="Kirim instruksi"><ArrowUp size={14} /></button>}</div>}
        {ACTIONS.slice(0, 2).map(action => <button key={action.name} type="button" disabled={unavailable} onClick={() => void generate(action.prompt, action.explain)}><action.icon size={14} />{action.name}</button>)}
        {expanded && <><button type="button" disabled={unavailable} onClick={() => void generate(ACTIONS[2].prompt)}><Scissors size={14} />Shorten</button><button type="button" disabled={unavailable} onClick={event => { toggle(false, event.detail !== 0); setInstruction("Ubah nada menjadi lebih ramah dan formal."); requestAnimationFrame(() => input.current?.focus()); }}><Smile size={14} />Tone</button><button type="button" disabled={unavailable} onClick={() => void generate(ACTIONS[3].prompt)}><CaseSensitive size={15} />Grammar</button></>}
        <button type="button" className="esa-more" aria-expanded={expanded} aria-label={expanded ? "Kembali ke instruksi" : "Tampilkan aksi lainnya"} onClick={event => toggle(!expanded, event.detail !== 0)}>{expanded ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}</button>
      </form>
    </div>
    {(result.state !== "idle" || result.error || stale) && <div className="esa-result" aria-busy={busy}>
      <header><div className={`esa-momo ${busy ? "is-dreaming" : ""}`} aria-hidden="true"><MomoCompanion thinking={busy} mode={busy ? "deep" : "normal"} response={result.state === "ready" ? "Selesai!" : ""} error={result.state === "error"} /></div><div><small>{busy ? "MOMO DREAMING" : result.explain ? "PENJELASAN MOMO" : "PRATINJAU EDIT"}</small><strong role="status">{busy ? result.text ? "Merangkai hasilnya…" : "Memahami teks pilihanmu…" : stale ? "Teks telah berubah" : result.state === "error" ? "Belum selesai" : "Siap untuk kamu tinjau"}</strong></div>{busy ? <button type="button" className="esa-close" aria-label="Hentikan AI" onClick={() => { controller.current?.abort(); active.current = false; setResult(current => ({ ...current, state: "error", error: "Proses dihentikan. Teks catatanmu tetap aman." })); }}><Square size={12} /></button> : <button type="button" className="esa-close" aria-label="Tutup aksi seleksi" onClick={event => { keyboard.current = event.detail === 0; close(true); }}><X size={16} /></button>}</header>
      {busy && !result.text && <div className="esa-dream-paper" aria-hidden="true"><i /><i /><i /><span className="esa-flow"><b /><b /><b /><b /><b /></span></div>}
      {result.text && <p ref={output} className="esa-output" tabIndex={0} aria-label={result.explain ? "Penjelasan Momo" : "Hasil edit Momo"} onScroll={event => { const el = event.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30; }}>{result.text}{busy && <span className="esa-cursor" aria-hidden="true" />}</p>}
      {(stale || result.error) && <p className="esa-error" role="alert">{stale ? "Isi editor sudah berubah. Pilih ulang teks agar perubahan diterapkan di tempat yang benar." : result.error}</p>}
      {result.state === "ready" && !stale && <footer><span>{result.explain ? "Penjelasan tidak mengubah catatan." : "Bisa di-undo. Simpan untuk memperbarui catatan."}</span>{!result.explain && <button className="esa-apply" type="button" disabled={disabled} onClick={apply}><Check size={14} />Terapkan</button>}</footer>}
    </div>}
  </section>, document.body);
}
