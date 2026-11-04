import assert from "node:assert/strict";
import { noteSearchTerms, serializeNoteEmbedding } from "../lib/rag/vector";

assert.equal(serializeNoteEmbedding(Array(384).fill(0.25)), null);
assert.equal(serializeNoteEmbedding(Array(1535).fill(0.25)), null);
assert.equal(serializeNoteEmbedding([...Array(1535).fill(0), Number.NaN]), null);
assert.equal(serializeNoteEmbedding(Array(1536).fill(0.25)), `[${Array(1536).fill("0.250000").join(",")}]`);
assert.equal(serializeNoteEmbedding(undefined), null);
assert.deepEqual(noteSearchTerms("Apa fungsi klorofil? Klorofil; OR 1=1"), ["apa", "fungsi", "klorofil"]);
assert.deepEqual(noteSearchTerms("a i"), []);
console.log("PASS: no cross-model vector padding; safe keyword fallback");
