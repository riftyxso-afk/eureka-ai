import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, console, URL, URLSearchParams, Response, Request, AbortSignal,
    require: name => name in dependencies ? dependencies[name] : require(name), ...globals,
  }, { filename: file });
  return exports;
}

test("dashboard notes tolerate incomplete rows, discard duplicate IDs, and preserve real source filters", () => {
  const { normalizeDashboardNotes, noteSource } = load("lib/dashboard-notes.ts");
  const notes = normalizeDashboardNotes([null, {}, { id: "one", title: null, createdAt: "not-a-date", sourceUrl: "https://youtu.be/video" }, { id: "one", title: "Duplicate" }, { id: "two", title: "Web", subject: null, sourceUrl: "https://example.com/article" }]);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].title, "Catatan tanpa judul");
  assert.equal(notes[0].createdAt, "");
  assert.equal(noteSource(notes[0]), "YouTube");
  assert.equal(noteSource(notes[1]), "Web");
  assert.equal(noteSource({ subject: "Video" }), "Video");
});

test("daily attendance is idempotent and never rewrites XP", async () => {
  let row = { active_days: ["2026-11-10"], xp: 700 };
  let writes = 0;
  const today = "2026-11-11";
  const client = { from: () => ({
    async upsert(value, options) { assert.equal(options.ignoreDuplicates, true); assert.equal(value.xp, undefined); return { error: null }; },
    select() { return { eq() { return { single: async () => ({ data: row, error: null }) }; } }; },
    update(patch) {
      assert.equal(patch.xp, undefined);
      const filters = [];
      return { eq(key, value) { filters.push([key, value]); return this; }, async select() {
        assert.ok(filters.some(([key, value]) => key === "user_id" && value === "alice"));
        assert.ok(filters.some(([key]) => key === "active_days"));
        row = { ...row, ...patch }; writes++; return { data: [{ user_id: "alice" }], error: null };
      } };
    },
  }) };
  const store = load("lib/progress-store.ts", { "./supabase/admin": { db: () => client }, "./friends-store": {}, "./streak": { studyDay: () => today } });
  await store.checkInToday("alice");
  await store.checkInToday("alice");
  assert.equal(writes, 1);
  assert.equal(row.xp, 700);
  assert.equal(row.active_days.filter(day => day === today).length, 1);
});

test("catalog merges actual provider schemas, caches repeated queries, and reports partial outages", async () => {
  let calls = 0;
  const { searchLibrary } = load("lib/library-catalog.ts", {}, { fetch: async url => {
    calls++;
    const parsed = new URL(url);
    if (parsed.hostname === "openlibrary.org") return Response.json({ numFound: 40, docs: [{ key: "/works/OL123W", title: "Buku", author_name: ["Penulis"], cover_i: 123, ebook_access: "public" }, { key: "javascript:bad", title: "Invalid" }] });
    return Response.json({ count: 1, next: null, results: [{ id: 11, title: "Alice", authors: [{ name: "Carroll" }], copyright: false }, { id: 12, title: "Restricted", copyright: true }] });
  } });
  const result = await searchLibrary("alice", "all", 1);
  assert.equal(result.books.length, 2);
  assert.equal(result.books[0].url, "https://openlibrary.org/works/OL123W");
  assert.equal(result.books[1].url, "https://www.gutenberg.org/ebooks/11");
  assert.equal(result.hasMore, true);
  await searchLibrary("alice", "all", 1);
  assert.equal(calls, 2);
  const partial = load("lib/library-catalog.ts", {}, { fetch: async url => {
    if (url.includes("gutendex.com")) throw new Error("offline");
    return Response.json({ docs: [{ key: "/works/OL123W", title: "Buku" }] });
  } });
  const degraded = await partial.searchLibrary("hello", "all", 1);
  assert.equal(degraded.books.length, 1);
  assert.equal(degraded.warnings.length, 1);
});

test("library rejects non-Pro access and invalid paging before contacting providers", async () => {
  let searches = 0;
  let auth = { userId: "", error: "Pro required", status: 402 };
  const api = load("app/api/library/route.ts", {
    "@/lib/assistant/auth": { requirePro: async () => auth },
    "@/lib/library-catalog": { searchLibrary: async () => { searches++; return {}; } },
    "@/lib/rateLimit": { ensureRateLimitPrune() {}, checkRateLimit: () => ({ ok: true }) },
  });
  assert.equal((await api.GET(new Request("https://eureka.test/api/library"))).status, 402);
  auth = { userId: "alice" };
  assert.equal((await api.GET(new Request("https://eureka.test/api/library?page=-1"))).status, 400);
  assert.equal((await api.GET(new Request("https://eureka.test/api/library?source=untrusted"))).status, 400);
  assert.equal(searches, 0);
});

test("storybook creation validates AI output and saves only to the authenticated account", async () => {
  const parser = load("lib/storybook.ts");
  assert.throws(() => parser.parseStorybook('{"title":"Invalid","scenes":[]}'));
  const story = { title: "Dongeng", scenes: Array.from({ length: 3 }, (_, index) => ({ title: `Adegan ${index}`, text: "Momo belajar merawat tanaman bersama teman-temannya. Cahaya pagi menemani perjalanan mereka.", imagePrompt: "A gentle illustrated garden" })) };
  let saved;
  let generated = 0;
  let auth = { userId: "", error: "Pro required", status: 402 };
  const api = load("app/api/library/story/route.ts", {
    "@/lib/assistant/auth": { requirePro: async () => auth },
    "@/lib/ai": { hasAiKey: () => true, aiChatStream: async () => { generated++; return { content: JSON.stringify(story) }; } },
    "@/lib/rateLimit": { ensureRateLimitPrune() {}, checkRateLimit: () => ({ ok: true }) },
    "@/lib/storybook": parser,
    "@/lib/storybook-starter": { STARTER_STORY: story },
    "@/lib/rag/store": { saveNoteWithChunks: async note => { saved = note; } },
  });
  const request = () => new Request("https://eureka.test/api/library/story", { method: "POST", body: JSON.stringify({ userId: "mallory", prompt: "Cerita tentang kebun ajaib" }) });
  assert.equal((await api.POST(request())).status, 402);
  assert.equal(generated, 0);
  auth = { userId: "alice" };
  const response = await api.POST(request());
  assert.equal(response.status, 200);
  assert.equal(saved.user_id, "alice");
  assert.equal(saved.noteType, "dongeng");
  assert.equal(saved.chapters.length, 3);
  assert.equal((await response.json()).story.id, saved.id);
});
