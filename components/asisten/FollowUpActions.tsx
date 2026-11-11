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
        <div className="follow-up-options">
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
              className="follow-up-option"
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

