"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Bot, LoaderCircle, Send, Sparkles, User } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

type Message = { role: "user" | "assistant"; content: string };
const STARTERS = ["Jelaskan dengan contoh lain", "Apa bagian yang paling penting?", "Beri petunjuk untuk latihannya"];

export function LessonTutor({ courseId, lessonId, lessonTitle }: { courseId: string; lessonId: string; lessonTitle: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    requestController.current?.abort();
    setMessages([]);
    setQuestion("");
    setSending(false);
    setError("");
    return () => requestController.current?.abort();
  }, [courseId, lessonId]);

  async function ask(value: string) {
    const clean = value.trim();
    if (!clean || sending) return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const isStale = () => controller.signal.aborted || requestController.current !== controller;
    const next = [...messages, { role: "user" as const, content: clean }];
    setMessages(next);
    setQuestion("");
    setSending(true);
    setError("");
    try {
      const response = await apiFetch(`/api/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/tutor`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ question: clean, history: messages }),
      });
      const data = await response.json().catch(() => null);
      if (isStale()) return;
      if (!response.ok) throw new Error(data?.error || "Momo belum dapat menjawab.");
      setMessages([...next, { role: "assistant", content: String(data?.answer ?? "") }]);
    } catch (reason) {
      if (!isStale()) setError(reason instanceof Error ? reason.message : "Momo belum dapat menjawab. Coba lagi.");
    } finally {
      if (!isStale()) {
        setSending(false);
        inputRef.current?.focus();
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void ask(question);
    }
  }

  return (
    <section className="lesson-tutor learning-tutor" id="tutor-momo" aria-labelledby="tutor-title">
      <div className="lesson-tutor-heading">
        <span className="lesson-tutor-avatar" aria-hidden="true"><Bot size={21} /></span>
        <div><h2 id="tutor-title">Tanya Momo</h2><p>Tutor untuk “{lessonTitle}”</p></div>
      </div>
      <div className="lesson-tutor-note"><Sparkles size={15} aria-hidden="true" />Momo membimbing, bukan membocorkan jawaban latihan.</div>
      {messages.length === 0 && (
        <div className="lesson-tutor-starters" aria-label="Contoh pertanyaan">
          {STARTERS.map((starter) => <button type="button" key={starter} onClick={() => void ask(starter)} disabled={sending}>{starter}</button>)}
        </div>
      )}
      {messages.length > 0 && (
        <div className="lesson-tutor-messages" aria-live="polite" aria-label="Percakapan dengan Momo">
          {messages.map((message, index) => (
            <div className={`lesson-tutor-message is-${message.role}`} key={`${message.role}-${index}`}>
              <span aria-hidden="true">{message.role === "assistant" ? <Bot size={16} /> : <User size={16} />}</span>
              <p>{message.content}</p>
            </div>
          ))}
        </div>
      )}
      {sending && <p className="lesson-tutor-status" role="status"><LoaderCircle size={16} className="spin" /> Momo sedang membaca konteks pelajaran…</p>}
      {error && <div className="lesson-tutor-error" role="alert">{error}</div>}
      <label className="sr-only" htmlFor="course-tutor-question">Pertanyaan tentang pelajaran ini</label>
      <textarea ref={inputRef} id="course-tutor-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={onKeyDown} placeholder="Tulis bagian yang belum kamu pahami…" rows={3} maxLength={1000} disabled={sending} />
      <button className="lesson-tutor-send" type="button" onClick={() => void ask(question)} disabled={sending || question.trim().length < 2}>
        {sending ? <LoaderCircle size={17} className="spin" /> : <Send size={17} />}Kirim pertanyaan
      </button>
      <p className="lesson-tutor-hint">Ctrl + Enter untuk mengirim · 30 pertanyaan/hari</p>
    </section>
  );
}
