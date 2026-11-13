"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import { Mathematics } from "@tiptap/extension-mathematics";
import { Bold, Code, Download, Italic, Link2, List, ListOrdered, Minus, Quote, Redo2, Save, Sigma, SquareCode, Strikethrough, Table2, Underline, Undo2 } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import EditorSelectionActions from "./EditorSelectionActions";
import "katex/dist/katex.min.css";

type Props = { noteId: string; title: string; content: string; chapterId?: number; label: string; onDirtyChange: (dirty: boolean) => void; onSaved: (title: string, content: string, warning?: string) => void; saveOverride?: (content:string,original:string)=>Promise<{title:string;content:string;warning?:string}> };
export default function DocumentEditor({ noteId, title, content, chapterId, label, onDirtyChange, onSaved, saveOverride }: Props) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [tool, setTool] = useState<"link" | "math" | null>(null);
  const [toolValue, setToolValue] = useState("");
  const base = useRef({ title, content });
  const currentTitle = useRef(title);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ link: { openOnClick: false, protocols: ["https", "http", "mailto"] } }), Markdown, TableKit.configure({ table: { resizable: true } }), Placeholder.configure({ placeholder: "Mulai menulis catatanmu…" }), Mathematics.configure({ katexOptions: { throwOnError: false, trust: false } })],
    content, contentType: "markdown",
    editorProps: { attributes: { "aria-label": "Isi catatan", class: "sr-editor-content" } },
    onUpdate: ({ editor }) => {
      const changed = editor.getMarkdown() !== base.current.content || currentTitle.current !== base.current.title;
      setDirty(changed); onDirtyChange(changed);
    },
  });
  const state = useEditorState({ editor, selector: ({ editor }) => editor ? { bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"), strike: editor.isActive("strike"), code: editor.isActive("code"), quote: editor.isActive("blockquote"), bullet: editor.isActive("bulletList"), ordered: editor.isActive("orderedList"), block: editor.isActive("codeBlock"), table: editor.isActive("table"), heading: editor.isActive("heading", { level: 1 }) ? "1" : editor.isActive("heading", { level: 2 }) ? "2" : editor.isActive("heading", { level: 3 }) ? "3" : "0", undo: editor.can().undo(), redo: editor.can().redo() } : null });
  useEffect(() => { editor?.setEditable(!saving, false); }, [editor, saving]);
  async function save() {
    if (!editor || saving) return;
    if (!draftTitle.trim()) { setError("Judul catatan tidak boleh kosong."); return; }
    const markdown = editor.getMarkdown(); setSaving(true); setError("");
    try {
      if(saveOverride){const data=await saveOverride(markdown,base.current.content);base.current={title:data.title,content:data.content};setDirty(false);onDirtyChange(false);onSaved(data.title,data.content);return;}
      const response = await apiFetch(`/api/notes/${encodeURIComponent(noteId)}/document`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chapterId, title: draftTitle.trim(), content: markdown, original: base.current.content, originalTitle: base.current.title }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Perubahan belum tersimpan.");
      base.current = { title: data.title, content: data.content }; currentTitle.current = data.title; setDraftTitle(data.title);
      setDirty(false); onDirtyChange(false); onSaved(data.title, data.content, data.warning);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Perubahan belum tersimpan."); }
    finally { setSaving(false); }
  }
  async function exportPdf() {
    if (dirty || saving || exporting) return;
    setExporting(true); setError("");
    try {
      const response = await apiFetch(`/api/notes/${encodeURIComponent(noteId)}/pdf?userId=${encodeURIComponent(getUserId())}`);
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || "PDF belum bisa dibuat."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `${draftTitle.replace(/[<>:"/\\|?*]+/g, "").slice(0, 100) || "catatan"}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "PDF belum bisa diunduh."); }
    finally { setExporting(false); }
  }
  const tools = editor ? [
    { label: "Undo", icon: Undo2, disabled: !state?.undo, action: () => editor.chain().focus().undo().run() },
    { label: "Redo", icon: Redo2, disabled: !state?.redo, action: () => editor.chain().focus().redo().run() },
    { label: "Tebal", icon: Bold, active: state?.bold, action: () => editor.chain().focus().toggleBold().run() },
    { label: "Miring", icon: Italic, active: state?.italic, action: () => editor.chain().focus().toggleItalic().run() },
    { label: "Garis bawah", icon: Underline, active: state?.underline, action: () => editor.chain().focus().toggleUnderline().run() },
    { label: "Coret", icon: Strikethrough, active: state?.strike, action: () => editor.chain().focus().toggleStrike().run() },
    { label: "Kode inline", icon: Code, active: state?.code, action: () => editor.chain().focus().toggleCode().run() },
    { label: "Daftar poin", icon: List, active: state?.bullet, action: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Daftar bernomor", icon: ListOrdered, active: state?.ordered, action: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Kutipan", icon: Quote, active: state?.quote, action: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Blok kode", icon: SquareCode, active: state?.block, action: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: "Pemisah", icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run() },
    { label: "Tautan", icon: Link2, action: () => { setTool("link"); setToolValue(editor.getAttributes("link").href ?? ""); } },
    { label: "Sisipkan tabel", icon: Table2, action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { label: "Rumus matematika", icon: Sigma, action: () => { setTool("math"); setToolValue(""); } },
  ] : [];
  return <section className="sr-editor" aria-label="Editor catatan">
    {!saveOverride && <EditorSelectionActions editor={editor} noteId={noteId} disabled={saving} />}
    <p className="sr-editor-mobile-hint">Geser alat format untuk melihat semua opsi.{!saveOverride && " Blok teks untuk bantuan AI."}</p>
    <div className="sr-editor-toolbar" role="toolbar" aria-label="Format catatan">
      <select aria-label="Gaya paragraf" value={state?.heading ?? "0"} disabled={!editor || saving} onChange={event => { const level = Number(event.target.value); if (level) editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run(); else editor?.chain().focus().setParagraph().run(); }}><option value="0">Paragraf</option><option value="1">Judul 1</option><option value="2">Judul 2</option><option value="3">Judul 3</option></select>
      {tools.map(item => <button key={item.label} title={item.label} aria-label={item.label} aria-pressed={item.active ?? undefined} disabled={saving || item.disabled} onMouseDown={event => event.preventDefault()} onClick={item.action}><item.icon size={16} /></button>)}
      {!saveOverride && <button className="sr-editor-export" aria-label="Ekspor PDF lengkap" title={dirty ? "Simpan perubahan sebelum ekspor" : "Unduh ringkasan dan semua bab"} disabled={dirty || saving || exporting} onClick={() => void exportPdf()}><Download size={16} /><span>{exporting ? "Menyiapkan PDF…" : "Ekspor PDF"}</span></button>}
    </div>
    {state?.table && <div className="sr-table-tools"><button onClick={() => editor?.chain().focus().addRowAfter().run()}>+ Baris</button><button onClick={() => editor?.chain().focus().addColumnAfter().run()}>+ Kolom</button><button onClick={() => editor?.chain().focus().deleteRow().run()}>Hapus baris</button><button onClick={() => editor?.chain().focus().deleteColumn().run()}>Hapus kolom</button><button onClick={() => editor?.chain().focus().deleteTable().run()}>Hapus tabel</button></div>}
    {tool && <form className="sr-editor-insert" onSubmit={event => {
      event.preventDefault(); if (!editor) return;
      if (tool === "link") {
        if (!toolValue.trim()) editor.chain().focus().unsetLink().run();
        else { try { const url = new URL(toolValue); if (!["http:", "https:", "mailto:"].includes(url.protocol)) throw new Error(); editor.chain().focus().extendMarkRange("link").setLink({ href: url.href }).run(); } catch { setError("Masukkan tautan HTTP/HTTPS yang valid."); return; } }
      } else if (toolValue.trim()) editor.chain().focus().insertInlineMath({ latex: toolValue.trim() }).run();
      setTool(null); setError("");
    }}><label>{tool === "link" ? "Alamat tautan" : "Rumus LaTeX"}<input autoFocus value={toolValue} onChange={event => setToolValue(event.target.value)} placeholder={tool === "link" ? "https://…" : "E = mc^2"} /></label><button type="submit">Sisipkan</button><button type="button" onClick={() => setTool(null)}>Batal</button></form>}
    <div className="sr-editor-savebar"><span role="status">{saving ? "Menyimpan perubahan…" : dirty ? "Perubahan belum disimpan" : "Tersimpan"}</span><div>{dirty && <button disabled={saving} onClick={() => { editor?.commands.setContent(base.current.content, { contentType: "markdown" }); currentTitle.current = base.current.title; setDraftTitle(base.current.title); setDirty(false); onDirtyChange(false); setError(""); }}>Batalkan perubahan</button>}<button className="dv2-button" disabled={!dirty || saving} onClick={() => void save()}><Save size={15} />{saving ? "Menyimpan…" : "Simpan"}</button></div></div>
    {error && <p className="sr-editor-error" role="alert">{error}</p>}
    <div className="sr-editor-paper"><p className="sr-eyebrow">{label}</p><label className="sr-editor-title"><span className="sr-only">Judul catatan</span><textarea rows={2} value={draftTitle} disabled={saving} maxLength={200} onChange={event => { setDraftTitle(event.target.value); currentTitle.current = event.target.value; const changed = event.target.value !== base.current.title || (editor?.getMarkdown() ?? content) !== base.current.content; setDirty(changed); onDirtyChange(changed); }} /></label><EditorContent editor={editor} /></div>
  </section>;
}
