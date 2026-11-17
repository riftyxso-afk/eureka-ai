const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

function load(file, globals = {}) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  runInNewContext(outputText, { exports, setTimeout, clearTimeout, DOMException, ...globals });
  return exports;
}

test("welcome trial is exactly 28 days and excludes older and future accounts", () => {
  const { getWelcomeProUntil, WELCOME_PRO_START } = load("lib/free-pro-period.ts");
  const start = Date.parse(WELCOME_PRO_START);
  const expires = start + 28 * 86_400_000;
  assert.equal(getWelcomeProUntil(WELCOME_PRO_START, start), new Date(expires).toISOString());
  assert.equal(getWelcomeProUntil(WELCOME_PRO_START, expires), null);
  assert.equal(getWelcomeProUntil(WELCOME_PRO_START, start - 1), null);
  assert.equal(getWelcomeProUntil(new Date(start - 1).toISOString(), start), null);
  assert.equal(getWelcomeProUntil("invalid", start), null);
});

test("fractions get block spacing, inline delimiters, and no extra delimiters inside code", () => {
  const { normalizeMathDelimiters } = load("lib/mathText.ts");
  const block = String.raw`Pecahan: \[\frac{\frac{a}{b}}{c}\]`;
  const formatted = normalizeMathDelimiters(block);
  assert.match(formatted, /\n\$\$\n\\frac\{\\frac\{a\}\{b\}\}\{c\}\n\$\$\n/);
  assert.equal(normalizeMathDelimiters(formatted), formatted);
  assert.equal(normalizeMathDelimiters(String.raw`Nilai \(\frac{1}{2}\) cm`), String.raw`Nilai $\frac{1}{2}$ cm`);
  const sample = ["```latex", String.raw`f=\frac{1}{2}`, "```"].join("\n");
  assert.equal(normalizeMathDelimiters(sample), sample);
});

test("reopening a call reuses a disabled track and releases it when the page is hidden", async () => {
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = "visible";
  let opened = 0;
  const track = {
    enabled: true,
    readyState: "live",
    applyConstraints: async () => {},
    stop() { this.readyState = "ended"; },
  };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const navigator = { mediaDevices: { getUserMedia: async () => { opened++; return stream; } } };
  const { acquireCallMicrophone } = load("components/assistant/callMicrophone.ts", { navigator, document, window });
  const first = new AbortController();
  await acquireCallMicrophone(first.signal);
  first.abort();
  assert.equal(track.enabled, false);
  const second = await acquireCallMicrophone(new AbortController().signal);
  assert.equal(opened, 1);
  assert.equal(track.enabled, true);
  second.release();
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(track.readyState, "ended");
});
