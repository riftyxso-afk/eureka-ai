// Unit test untuk lib/assistant/plainText.ts (markdownToPlainText).
// Jalan tanpa framework: node:test bawaan + type-stripping Node 26.
//   node --test scripts/test-plaintext.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToPlainText } from "../lib/assistant/plainText.ts";

test("bold & italic tanpa simbol markdown", () => {
  assert.equal(
    markdownToPlainText("**ringkasan** dan *penting*"),
    "ringkasan dan penting"
  );
});

test("heading jadi baris sendiri tanpa #", () => {
  assert.equal(
    markdownToPlainText("# Bab 1\n\n## Sub Bab"),
    "Bab 1\n\nSub Bab"
  );
});

test("list bullet & ordered ber-prefix", () => {
  assert.equal(markdownToPlainText("- item a\n- item b"), "- item a\n- item b");
  assert.equal(markdownToPlainText("1. satu\n2. dua"), "1. satu\n2. dua");
});

test("code block & inline code tanpa backtick", () => {
  assert.equal(
    markdownToPlainText("Ini `variabel`.\n\n```js\nconst x = 1;\n```"),
    "Ini variabel.\n\nconst x = 1;"
  );
});

test("tautan jadi teks label", () => {
  assert.equal(
    markdownToPlainText("[Klik di sini](https://x.com)"),
    "Klik di sini"
  );
});

test("math inline & block tanpa delimiter", () => {
  assert.equal(
    markdownToPlainText("Rumus \\(x^2 + 1\\)"),
    "Rumus x^2 + 1"
  );
  assert.equal(markdownToPlainText("\\[E = mc^2\\]"), "E = mc^2");
});

test("tidak ada simbol * # atau backtick tersisa di output", () => {
  const out = markdownToPlainText(
    "# Judul\n\n**teks** dengan `kode` dan *miring*"
  );
  assert.ok(!out.includes("*"), `output mengandung '*': ${out}`);
  assert.ok(!out.includes("#"), `output mengandung '#': ${out}`);
  assert.ok(!out.includes("`"), `output mengandung backtick: ${out}`);
});

test("konten kosong menghasilkan string kosong", () => {
  assert.equal(markdownToPlainText(""), "");
  assert.equal(markdownToPlainText("   "), "");
});
