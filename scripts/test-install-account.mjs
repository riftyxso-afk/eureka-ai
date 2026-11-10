import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const env = { SUPABASE_SERVICE_ROLE_KEY: "test-only-signing-key" };
function load(file, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => dependencies[name] ?? require(name),
    Buffer, Date, Number, JSON, process: { env }, console }, { filename: file });
  return exports;
}
const tickets = load("lib/auth/installTicket.ts");

test("Transfer expires after ten minutes and rejects tampered tickets", () => {
  const now = Date.now();
  const value = tickets.createInstallTicket("one-time-hash", "account-a", now);
  assert.equal(tickets.readInstallTicket(value, now).userId, "account-a");
  assert.equal(tickets.readInstallTicket(value, now + 600_000), null);
  const payload = Buffer.from(JSON.stringify({ hash: "one-time-hash", userId: "account-b", expires: now + 600_000 })).toString("base64url");
  assert.equal(tickets.readInstallTicket(payload + "." + value.split(".")[1], now), null);
  assert.equal(tickets.readInstallTicket(value + ".extra", now), null);
});

function endpoint(authorized = true) {
  let used = false;
  let generated = 0;
  const admin = { auth: { admin: {
    getUserById: async () => ({ data: { user: { email: "test@example.com", email_confirmed_at: "verified" } } }),
    generateLink: async () => { generated++; return { data: { properties: { hashed_token: "one-time-hash" } } }; },
  } } };
  const route = load("app/api/auth/install-account/route.ts", {
    "@/lib/auth/installTicket": tickets,
    "@/lib/supabase/admin": { db: () => admin },
    "@/lib/assistant/auth": { requireAuth: async () => authorized ? { userId: "account-a" } : { userId: "", status: 401 } },
    "@/lib/rateLimit": { ensureRateLimitPrune() {}, checkRateLimit: () => ({ ok: true }) },
    "@supabase/supabase-js": { createClient: () => ({ auth: {
      verifyOtp: async ({ token_hash }) => {
        assert.equal(token_hash, "one-time-hash");
        if (used) return { error: true, data: {} };
        used = true;
        return { data: { user: { id: "account-a" }, session: { access_token: "test-access", refresh_token: "test-refresh" } } };
      },
    } }) },
  });
  const request = (body, origin = "https://eureka.example", cookie) => ({
    nextUrl: new URL("https://eureka.example/api/auth/install-account"),
    headers: new Headers({ origin }),
    cookies: { get: () => cookie ? { value: cookie } : undefined },
    json: async () => body,
  });
  return { ...route, request, generated: () => generated };
}

test("Only authenticated same-origin requests can prepare account import", async () => {
  const denied = endpoint(false);
  assert.equal((await denied.POST(denied.request({ action: "link" }))).status, 401);
  assert.equal(denied.generated(), 0);
  const route = endpoint();
  assert.equal((await route.POST(route.request({ action: "link" }, "https://other.example"))).status, 403);
  assert.equal(route.generated(), 0);
});

test("Prepared cookie transfers the same account once and does not cache credentials", async () => {
  const route = endpoint();
  const prepared = await route.POST(route.request({ action: "prepare" }));
  const body = await prepared.json();
  assert.equal(body.ready, true);
  assert.equal(body.ticket, undefined);
  const cookie = prepared.cookies.get(tickets.INSTALL_COOKIE);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true);
  assert.equal(cookie.maxAge, 600);
  const restored = await route.POST(route.request({ action: "restore" }, undefined, cookie.value));
  assert.equal(restored.status, 200);
  assert.equal(restored.headers.get("cache-control"), "no-store");
  assert.equal((await restored.json()).access_token, "test-access");
  assert.equal((await route.POST(route.request({ action: "restore", ticket: cookie.value }))).status, 410);
});
