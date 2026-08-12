"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { Loader2, Send, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface NoteAIChatProps {
  noteId: string;
  notify: (msg: string) => void;
}

/** "Tanya AI tentang catatannya" â€” RAG Q&A satu pertanyaan â†’ jawaban. */
export const NoteAIChat = ({ noteId, notify }: NoteAIChatProps) => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const res = await apiFetch(`/api/notes/${noteId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
      } else {
        notify(data.error ?? "AI gagal menjawab. Coba lagi.");
      }
    } catch {
      notify("Terjadi kesalahan koneksi. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-clay mt-6 p-6">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles size={18} className="text-clay-primary" />
        <h3 className="text-base font-extrabold text-clay-dark sm:text-lg">
          Tanya AI tentang catatannya
        </h3>
      </div>
      <p className="mb-1 text-sm font-bold text-clay-muted">
        Jawaban berdasarkan isi catatanmu
      </p>
      <p className="mb-4 text-xs font-medium text-clay-muted/70">
        AI bisa membuat kesalahan. Periksa info penting.
      </p>

      {messages.length > 0 && (
        <div className="mb-4 max-h-72 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-clay-md px-4 py-3 text-sm font-medium leading-relaxed ${
                  m.role === "user"
                    ? "bg-clay-primary text-white shadow-clay-sm"
                    : "bg-clay-beige text-clay-dark shadow-clay-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-clay-md bg-clay-beige px-4 py-3 text-sm font-bold text-clay-muted shadow-clay-sm">
                <Loader2 size={16} className="animate-spin" />
                AI sedang berpikir...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          placeholder="Tanyakan tentang catatan ini..."
          className="input-clay flex-1"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="btn-clay-primary !min-h-[56px] !px-6 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Kirim pertanyaan"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
