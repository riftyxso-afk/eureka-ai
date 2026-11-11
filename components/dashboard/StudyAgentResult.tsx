"use client";

import { useEffect, useRef, useState } from "react";
import MarkdownView from "@/components/asisten/MarkdownView";
import LoadingStatus from "@/components/ui/LoadingStatus";
import { apiFetch } from "@/lib/apiClient";
import type { StudyAgentEvent } from "@/lib/study-agent-events";
import type { StudySource } from "@/lib/study-sources-types";

export function useStudyAgent() {
  const [text, setText] = useState("");
  const [sources, setSources] = useState<StudySource[]>([]);
  const [status, setStatus] = useState<Extract<StudyAgentEvent, { type: "status" }> | null>(null);
  const [result, setResult] = useState<Extract<StudyAgentEvent, { type: "done" }> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  async function run(prompt: string) {
    if (active.current) return;
    const request = new AbortController();
    active.current = request;
    setBusy(true);
    setError("");
    setText("");
    setResult(null);
    setSources([]);
    setStatus({ type: "status", stage: "thinking", label: "Menyiapkan ruang belajar…" });
    try {
      const response = await apiFetch("/api/study-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ prompt }),
        signal: request.signal,
      });
      if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Mode Belajar belum bisa dimulai.");
      }

      const decoder = new TextDecoder();
      const reader = response.body.getReader();
      let buffer = "";
      let done = false;
      try {
        while (!done) {
          const frame = await reader.read();
          if (frame.done) break;
          buffer += decoder.decode(frame.value, { stream: true });
          let boundary: number;
          while ((boundary = buffer.indexOf("\n\n")) !== -1) {
            const message = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            if (!message.startsWith("data: ")) continue;
            const event = JSON.parse(message.slice(6)) as StudyAgentEvent;
            if (event.type === "status") setStatus(event);
            if (event.type === "sources") setSources(event.sources);
            if (event.type === "token") setText(previous => previous + event.text);
            if (event.type === "reset") setText("");
            if (event.type === "error") throw new Error(event.message);
            if (event.type === "done") { setResult(event); done = true; break; }
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      if (!done && !request.signal.aborted) throw new Error("Aliran respons terputus. Coba lagi untuk hasil lengkap.");
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Coba lagi.");
    } finally {
      if (active.current === request) {
        active.current = null;
        setBusy(false);
        setStatus(null);
      }
    }
  }

  function stop() {
    active.current?.abort();
    setError("Penyusunan dihentikan.");
  }
  return { run, stop, text, sources, status, result, error, busy };
}

export default function StudyAgentResult({ agent }: { agent: ReturnType<typeof useStudyAgent> }) {
  if (!agent.busy && !agent.text && !agent.error) return null;
  return (
    <section className="dv2-study-result" aria-label="Hasil pekerjaan Mode Belajar">
      <div className="dv2-study-result-heading">
        <h2>{agent.result?.title || "Hasil belajar"}</h2>
        {agent.busy && <button type="button" onClick={agent.stop}>Hentikan</button>}
        {agent.result && <button type="button" onClick={async () => {
          const { downloadStudyDocx } = await import("@/lib/study-docx");
          downloadStudyDocx(agent.result!.title, agent.text, agent.sources);
        }}>Unduh DOCX</button>}
      </div>
      {agent.status && <LoadingStatus compact stage={agent.status.stage} detail={agent.status.label} />}
      {agent.text && (agent.busy ? <p className="dv2-study-stream-text">{agent.text}</p> : <MarkdownView content={agent.text} />)}
      {agent.error && <p className="dv2-error" role="alert">{agent.error}</p>}
      {agent.sources.length > 0 && <details className="dv2-study-result-sources">
        <summary>Sumber · {agent.sources.length}</summary>
        <ol>{agent.sources.map(source => <li key={source.url}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
          <small>{source.kind === "paper" ? "Preprint · " : ""}{source.byline}</small>
        </li>)}</ol>
      </details>}
    </section>
  );
}
