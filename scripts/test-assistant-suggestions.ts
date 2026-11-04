import assert from "node:assert/strict";
import { parseAssistantSuggestions } from "../lib/assistant/suggestions";

const valid = { suggestions: [
  { label: "Bandingkan dengan respirasi", kind: "send", prompt: "Apa perbedaan fotosintesis dan respirasi sel?" },
  { label: "Kuis fotosintesis", kind: "quiz" },
  { label: "Kartu tahapan fotosintesis", kind: "flashcards" },
] };
assert.deepEqual(parseAssistantSuggestions(valid), valid.suggestions);
assert.deepEqual(parseAssistantSuggestions({ suggestions: valid.suggestions.slice(0, 2) }), []);
assert.deepEqual(parseAssistantSuggestions({ suggestions: [...valid.suggestions, valid.suggestions[0]] }), []);
assert.deepEqual(parseAssistantSuggestions({ suggestions: [valid.suggestions[0], { label: "Tidak dikenal", kind: "delete" }, valid.suggestions[2]] }), []);
assert.deepEqual(parseAssistantSuggestions({ suggestions: [{ label: "Tanpa prompt", kind: "send" }, valid.suggestions[1], valid.suggestions[2]] }), []);
assert.deepEqual(parseAssistantSuggestions({ suggestions: [{ ...valid.suggestions[0], label: "x".repeat(91) }, valid.suggestions[1], valid.suggestions[2]] }), []);
assert.deepEqual(parseAssistantSuggestions(null), []);
console.log("PASS: exactly three validated AI suggestions, safe action allowlist, no template fallback");
