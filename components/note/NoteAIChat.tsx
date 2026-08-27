"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { Send, Sparkles } from "lucide-react";
import EurekaOrb from "@/components/ui/EurekaOrb";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface NoteAIChatProps {
  noteId: string;
  notify: (msg: string) => void;
}

/** "Tanya AI tentang catatannya" — RAG Q&A multi-giliran terikat materi. */
export const NoteAIChat = ({ noteId, notify }: NoteAIChatProps) => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  // Materi catatan masih diproses AI → tampil panel status, bukan toast retry.
  const [processing, setProcessing] = useState(false);
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
      // Kirim maksimal 4 giliran terakhir agar pertanyaan lanjutan nyambung.
      const history = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await apiFetch(`/api/notes/${noteId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        setProcessing(false);
        setMessages((m) => [...m, { role: "assistant", content: data.answer }]);
      } else if (res.status === 409 && data.code === "note_processing") {
        // Materi belum siap: panel status jelas + izinkan coba lagi nanti.
        setProcessing(true);
        notify(data.error ?? "Materi masih disiapkan.");
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

      {/* Panel status: catatan masih dalam proses olah AI */}
      {processing && (
        <div className="mb-4 overflow-hidden rounded-clay-md border-2 border-clay-primary/40 bg-clay-primary/10 p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold text-clay-dark">
            <EurekaOrb variant="working" scale="inline" label="Menyiapkan materi" />
            Materi sedang disiapkan…
          </p>
          <p className="mt-1 text-xs font-semibold text-clay-muted">
            Eureka sedang membaca dan memetakan isi catatan ini. Coba lagi
            beberapa saat — tidak perlu diulang terus.
          </p>
          {/* Indikator progres tak tentu */}
          <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-clay-inputBg shadow-clay-inset">
            <div className="animate-shimmer h-full w-1/3 rounded-full bg-clay-primary/60" />
          </div>
        </div>
      )}

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
                <EurekaOrb variant="thinking" scale="inline" label="Eureka sedang berpikir" />
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
          placeholder={
            processing ? "Menunggu materi siap..." : "Tanyakan tentang catatan ini..."
          }
          className="input-clay flex-1"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading || processing}
        />
        <button
          type="submit"
          disabled={loading || processing || !question.trim()}
          className="btn-clay-primary !min-h-[56px] !px-6 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Kirim pertanyaan"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
