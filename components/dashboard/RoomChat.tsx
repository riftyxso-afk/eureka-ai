"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Copy, Square } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { getUserId } from "@/lib/identity";
import MomoCompanion from "@/components/asisten/MomoCompanion";
import MarkdownView from "@/components/asisten/MarkdownView";
type Message = { id: string; role: "user" | "assistant"; content: string };

export default function RoomChat({ noteId, title }: { noteId: string; title: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const request = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const key = `eureka:v2:note-chat:${getUserId()}:${noteId}`;
  useEffect(() => { try { const data = JSON.parse(sessionStorage.getItem(key) || "[]"); if (Array.isArray(data)) setMessages(data.filter(m => m && typeof m.content === "string" && ["user", "assistant"].includes(m.role)).slice(-30)); } catch {} return () => request.current?.abort(); }, [key]);
  useEffect(() => { if (follow.current) bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages, busy]);
  async function send(question = draft) {
    question = question.trim(); if (!question || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setDraft(""); follow.current = true;
    const id = crypto.randomUUID(); const history = messages.slice(-8);
    const next: Message[] = [...messages, { id: crypto.randomUUID(), role: "user", content: question }, { id, role: "assistant", content: "" }];
    setMessages(next);
    const controller = new AbortController(); request.current = controller;
    let answer = "";
    try {
      const response = await apiFetch(`/api/notes/${noteId}/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, userId: getUserId(), history, stream: true }), signal: controller.signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Momo belum dapat menjawab."); }
      if (!response.body) throw new Error("Respons kosong.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "token") { answer += event.text; const content = answer; setMessages(current => current.map(m => m.id === id ? { ...m, content } : m)); }
        }
        if (done) break;
      }
      if (!answer.trim()) throw new Error("Jawaban belum tersedia. Coba tanyakan kembali.");
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Momo belum dapat menjawab."); }
    finally {
      const saved = next.map(m => m.id === id ? { ...m, content: answer } : m).filter(m => m.content);
      setMessages(saved);
      try { sessionStorage.setItem(key, JSON.stringify(saved.slice(-30))); } catch {}
      lock.current = false; setBusy(false);
    }
  }
  const suggestions = ["Jelaskan inti materi ini dengan sederhana", "Berikan contoh penerapan materi ini", "Uji pemahamanku dengan satu pertanyaan"];
  return <section className="rm-chat"><div className="rm-feature-heading"><div><h1>Tanya Momo</h1><p>Pendamping belajar untuk catatan ini.</p></div><span className="rm-context-label">Berdasarkan materi</span></div>
    <div className="rm-chat-thread" ref={scroll} onScroll={() => { const el = scroll.current; if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
      {!messages.length && <div className="rm-chat-welcome"><div className="sr-momo"><MomoCompanion mode="normal" /></div><h2>Ayo, kita pahami bersama.</h2><p>Aku sudah punya konteks “{title}”. Bagian mana yang ingin kamu bahas?</p><div>{suggestions.map(text => <button key={text} onClick={() => void send(text)}>{text}<ArrowUp size={14} /></button>)}</div></div>}
      {messages.map(m => <article key={m.id} className={`rm-chat-message is-${m.role}`}>{m.role === "assistant" && <div className="rm-message-momo"><MomoCompanion response={m.content} question={messages[messages.indexOf(m) - 1]?.content} thinking={busy && !m.content} /></div>}<div>{m.role === "user" ? <p>{m.content}</p> : m.content ? <><MarkdownView content={m.content} /><button className="rm-copy" aria-label="Salin jawaban" onClick={() => { void navigator.clipboard.writeText(m.content).then(() => setCopied(m.id)).catch(() => setError("Jawaban belum bisa disalin.")); }}><Copy size={13} />{copied === m.id ? "Tersalin" : "Salin"}</button></> : <p className="rm-thinking" role="status"><span />Momo sedang membaca materi…</p>}</div></article>)}<div ref={bottom} />
    </div>{error && <p className="rm-error" role="alert">{error}</p>}
    <form className="rm-chat-composer" onSubmit={e => { e.preventDefault(); void send(); }}><label className="sr-only" htmlFor="room-question">Pertanyaan untuk Momo</label><textarea id="room-question" maxLength={500} value={draft} rows={2} placeholder="Tanyakan tentang materi ini…" onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><div><span className="rm-composer-context"><span aria-hidden="true" />Berdasarkan catatan ini</span><small className="rm-composer-keyhint">Enter untuk kirim</small>{busy ? <button type="button" aria-label="Hentikan jawaban" onClick={() => request.current?.abort()}><Square size={17} /></button> : <button type="submit" disabled={!draft.trim()} aria-label="Kirim pertanyaan"><ArrowUp size={19} /></button>}</div></form>
  </section>;
}
