"use client";

import { useState } from "react";
import { ArrowUpRight, Layers3, ListChecks, Loader2 } from "lucide-react";
import type { AssistantSuggestion } from "@/lib/assistant/types";

interface FollowUpActionsProps {
  suggestions: AssistantSuggestion[];
  loading?: boolean;
  disabled?: boolean;
  onSend: (question: string) => void;
  onQuiz: () => void;
  onFlashcards: () => void;
}

const actionClass = "inline-flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-clay-full bg-clay-beige px-3.5 py-2 text-start text-xs font-semibold text-clay-dark transition-colors hover:bg-clay-primary/15 active:bg-clay-primary/25 focus-visible:outline-2 focus-visible:outline-clay-primary disabled:cursor-not-allowed disabled:opacity-50";

/** AI-written next steps. Only the three known client actions can be dispatched. */
export default function FollowUpActions({ suggestions, loading = false, disabled = false, onSend, onQuiz, onFlashcards }: FollowUpActionsProps) {
  const [submitted, setSubmitted] = useState(false);
  const locked = disabled || submitted;
  return (
    <section className="chat-follow-up" aria-label="Saran langkah belajar berikutnya" aria-busy={loading}>
      <p className="mb-2 text-xs font-semibold text-clay-muted">
        {loading ? <span role="status" className="inline-flex items-center gap-2"><Loader2 aria-hidden="true" size={13} className="motion-safe:animate-spin" /> Menyiapkan saran dari jawaban…</span> : "Pilih langkah berikutnya"}
      </p>
      {!loading && suggestions.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              disabled={locked}
              onClick={() => {
                if (suggestion.kind === "quiz") return onQuiz();
                if (suggestion.kind === "flashcards") return onFlashcards();
                if (!suggestion.prompt) return;
                setSubmitted(true);
                onSend(suggestion.prompt);
              }}
              className={actionClass}
            >
              {suggestion.kind === "quiz" ? <ListChecks aria-hidden="true" size={15} className="shrink-0 text-clay-primary" /> : suggestion.kind === "flashcards" ? <Layers3 aria-hidden="true" size={15} className="shrink-0 text-clay-primary" /> : <ArrowUpRight aria-hidden="true" size={15} className="shrink-0 text-clay-primary" />}
              <span className="[overflow-wrap:anywhere]">{suggestion.label}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
