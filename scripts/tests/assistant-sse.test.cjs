const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/assistant/sse.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { module: moduleUnderTest, exports: moduleUnderTest.exports, TextDecoder });
const { readSseData } = moduleUnderTest.exports;
const encoder = new TextEncoder();

test('delivers the first real token while the network stream is still open', async () => {
  let controller;
  const stream = new ReadableStream({ start(c) { controller = c; } });
  const iterator = readSseData(stream);
  controller.enqueue(encoder.encode('data: {"type":"token","text":"Halo"}\n\n'));
  assert.equal((await iterator.next()).value, '{"type":"token","text":"Halo"}');
  controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
  controller.close();
  assert.equal((await iterator.next()).value, '{"type":"done"}');
  assert.equal((await iterator.next()).done, true);
});

test('handles byte-split UTF-8, CRLF, heartbeat comments and multiline data', async () => {
  const bytes = encoder.encode(': keep-alive\r\n\r\ndata: {"text":"Pelajaran 🧠",\r\ndata: "type":"token"}\r\n\r\n');
  const stream = new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } });
  const events = [];
  for await (const value of readSseData(stream)) events.push(JSON.parse(value));
  assert.deepEqual(events, [{ text: 'Pelajaran 🧠', type: 'token' }]);
});

test('flushes the final event without a trailing newline', async () => {
  const stream = new ReadableStream({ start(c) { c.enqueue(encoder.encode('data: {"type":"done"}')); c.close(); } });
  const events = [];
  for await (const value of readSseData(stream)) events.push(value);
  assert.deepEqual(events, ['{"type":"done"}']);
});

test('cancels the reader when the consumer stops after an event', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(encoder.encode('data: hello\n\n')); }, cancel() { cancelled = true; } });
  for await (const value of readSseData(stream)) { assert.equal(value, 'hello'); break; }
  assert.equal(cancelled, true);
  assert.equal(stream.locked, false);
});
