/**
 * Test fallback web search (Tavily) tanpa memanggil API asli:
 * global fetch di-stub per URL (firecrawl.dev vs api.tavily.com).
 *
 * Jalankan: node --test scripts/test-websearch.mjs
 * (pakai tsx bila node native belum mendukung import TS:
 *  .\backend\node_modules\.bin\tsx.cmd --test scripts/test-websearch.mjs)
 *
 * Catatan: FIRECRAWL_API_KEY & TAVILY_API_KEY dibaca module saat load,
 * jadi env diset dulu sebelum import (dynamic import).
 */
process.env.FIRECRAWL_API_KEY = "fc-key-test";

import { test } from "node:test";
import assert from "node:assert/strict";

const { searchWeb, isFirecrawlConfigured, firecrawlSearch } = await import(
  "../lib/firecrawl.ts"
);
const { isTavilyConfigured, tavilySearch } = await import("../lib/tavily.ts");

const TAVILY_KEY = "tvly-test-key";

function stubFetch({ firecrawl, tavily }) {
  const calls = { firecrawl: 0, tavily: 0 };
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("firecrawl.dev")) {
      calls.firecrawl++;
      return {
        ok: firecrawl.ok,
        status: firecrawl.status ?? 200,
        json: async () => firecrawl.body,
      };
    }
    if (u.includes("api.tavily.com")) {
      calls.tavily++;
      return {
        ok: tavily.ok,
        status: tavily.status ?? 200,
        json: async () => tavily.body,
      };
    }
    throw new Error(`URL tak dikenal: ${u}`);
  };
  return calls;
}

const RESULT_OK = (over = {}) => ({
  url: "https://id.wikipedia.org/wiki/Contoh",
  title: "Contoh - Wikipedia",
  content: "Deskripsi hasil pencarian contoh yang cukup panjang untuk dibaca.",
  ...over,
});

test("tanpa TAVILY_API_KEY: fallback dilewati, hasil Firecrawl dipakai", async () => {
  delete process.env.TAVILY_API_KEY;
  assert.equal(isTavilyConfigured(), false);
  const calls = stubFetch({
    firecrawl: { ok: true, body: { data: [{ url: "https://a.example", title: "A", description: "A desc" }] } },
    tavily: { ok: true, body: { results: [RESULT_OK()] } },
  });
  const results = await searchWeb("contoh query", 3);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://a.example");
  assert.equal(calls.firecrawl, 1);
  assert.equal(calls.tavily, 0, "Tavily tidak boleh dipanggil tanpa key");
});

test("Firecrawl gagal (500) + key ada → fallback ke Tavily", async () => {
  process.env.TAVILY_API_KEY = TAVILY_KEY;
  assert.equal(isTavilyConfigured(), true);
  const calls = stubFetch({
    firecrawl: { ok: false, status: 500, body: {} },
    tavily: { ok: true, body: { results: [RESULT_OK()] } },
  });
  const results = await searchWeb("contoh query", 3);
  assert.equal(calls.firecrawl, 1);
  assert.equal(calls.tavily, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://id.wikipedia.org/wiki/Contoh");
});

test("Firecrawl kosong + key ada → fallback ke Tavily", async () => {
  process.env.TAVILY_API_KEY = TAVILY_KEY;
  const calls = stubFetch({
    firecrawl: { ok: true, body: { data: [] } },
    tavily: { ok: true, body: { results: [RESULT_OK()] } },
  });
  const results = await searchWeb("contoh query", 3);
  assert.equal(calls.firecrawl, 1);
  assert.equal(calls.tavily, 1);
  assert.equal(results.length, 1);
});

test("Firecrawl sukses → Tavily tidak dipanggil", async () => {
  process.env.TAVILY_API_KEY = TAVILY_KEY;
  const calls = stubFetch({
    firecrawl: { ok: true, body: { data: [{ url: "https://b.example", title: "B", description: "B desc" }] } },
    tavily: { ok: true, body: { results: [RESULT_OK()] } },
  });
  const results = await searchWeb("contoh query", 3);
  assert.equal(calls.tavily, 0);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://b.example");
});

test("Tavily: hasil noise (media sosial) difilter", async () => {
  process.env.TAVILY_API_KEY = TAVILY_KEY;
  stubFetch({
    firecrawl: { ok: false, status: 500, body: {} },
    tavily: {
      ok: true,
      body: {
        results: [
          RESULT_OK(),
          RESULT_OK({ url: "https://instagram.com/p/xyz", title: "Postingan" }),
        ],
      },
    },
  });
  const results = await searchWeb("contoh query", 3);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://id.wikipedia.org/wiki/Contoh");
});

test("tavilySearch: key hilang → [] tanpa error", async () => {
  delete process.env.TAVILY_API_KEY;
  const results = await tavilySearch("apa pun", 3);
  assert.deepEqual(results, []);
});

test("firecrawlSearch tetap berfungsi (tidak dipecah)", async () => {
  const calls = stubFetch({
    firecrawl: { ok: true, body: { data: [{ url: "https://c.example", title: "C", description: "C desc" }] } },
    tavily: { ok: true, body: { results: [] } },
  });
  const results = await firecrawlSearch("contoh", 3);
  assert.equal(results.length, 1);
  assert.equal(calls.firecrawl, 1);
  assert.equal(isFirecrawlConfigured(), true);
});