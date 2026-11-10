import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const orderId = "00000000-0000-4000-8000-000000000001";
const mayarId = "00000000-0000-4000-8000-000000000002";
const transactionId = "00000000-0000-4000-8000-000000000003";
const returnUrl = `https://www.eureka-ai.web.id/id/payments/return?order=${orderId}`;
const order = { order_id: orderId, mayar_id: mayarId, amount: 15000, status: "pending" };

function load(file, dependencies, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports, URL, Response, Request, AbortSignal, console,
    process: { env: { MAYAR_API_KEY: "server-only-test-key" } },
    require: name => name in dependencies ? dependencies[name] : require(name),
    ...globals,
  }, { filename: file });
  return exports;
}

function client(response) {
  let settled = 0;
  let requests = 0;
  const api = load("lib/mayar.ts", {
    "@/lib/paymentIds": { isPaymentId: value => typeof value === "string" && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value) },
    "@/lib/supabase/admin": { db: () => ({
      rpc: async (name, args) => {
        settled++;
        assert.equal(name, "settle_mayar_checkout");
        assert.equal(args.p_order_id, orderId);
        assert.equal(args.p_amount, 15000);
        return { data: true, error: null };
      },
    }) },
  }, {
    fetch: async (url, options) => {
      requests++;
      assert.ok(url.startsWith("https://api.mayar.id/hl/v2/payments/"));
      assert.equal(options.headers.Authorization, "Bearer server-only-test-key");
      if (options.method === "POST") {
        const body = JSON.parse(options.body);
        assert.equal(body.redirectUrl, returnUrl);
        assert.equal(body.amount, 15000);
      }
      return Response.json({ data: response });
    },
  });
  return { ...api, settled: () => settled, requests: () => requests };
}

test("checkout requires an echoed return URL and a trusted HTTPS payment destination", async () => {
  const valid = { id: mayarId, transactionId, redirectUrl: returnUrl, link: "https://eureka.myr.id/pl/test" };
  assert.equal((await client(valid).createMayarCheckout({ amount: 15000, email: "qa@example.com", redirectUrl: returnUrl })).id, mayarId);
  for (const invalid of [
    { ...valid, redirectUrl: undefined },
    { ...valid, redirectUrl: "https://example.com" },
    { ...valid, link: "https://mayar.id.example.com/payment" },
    { ...valid, link: "http://eureka.myr.id/payment" },
  ]) {
    await assert.rejects(client(invalid).createMayarCheckout({ amount: 15000, email: "qa@example.com", redirectUrl: returnUrl }));
  }
});

test("only an exact paid order settles, unpaid, wrong amount, and wrong IDs never grant Pro", async () => {
  const unpaid = client({ id: mayarId, amount: 15000, status: "unpaid" });
  assert.equal(await unpaid.confirmMayarCheckout(order), "pending");
  assert.equal(unpaid.settled(), 0);
  for (const response of [
    { id: mayarId, amount: 1000, status: "paid" },
    { id: transactionId, amount: 15000, status: "paid" },
  ]) {
    const mismatch = client(response);
    await assert.rejects(mismatch.confirmMayarCheckout(order));
    assert.equal(mismatch.settled(), 0);
  }
  const paid = client({ id: mayarId, amount: 15000, status: "paid" });
  assert.equal(await paid.confirmMayarCheckout(order), "paid");
  assert.equal(paid.settled(), 1);
  assert.equal(await paid.confirmMayarCheckout({ ...order, status: "paid" }), "paid");
  assert.equal(paid.requests(), 1);
});

test("payment confirmation requires ownership before contacting Mayar", async () => {
  let upstream = 0;
  let auth = { userId: "owner" };
  const filters = [];
  const route = load("app/api/payments/mayar/confirm/route.ts", {
    "@/lib/assistant/auth": { requireAuth: async () => auth },
    "@/lib/mayar": {
      isPaymentId: () => true,
      confirmMayarCheckout: async () => { upstream++; return "paid"; },
    },
    "@/lib/rateLimit": { ensureRateLimitPrune() {}, checkRateLimit: () => ({ ok: true }) },
    "@/lib/premium": { getPremiumStatus: async () => ({ isPremium: false }) },
    "@/lib/supabase/admin": { db: () => ({ from: () => ({
      select: () => ({
        eq(key, value) { filters.push([key, value]); return this; },
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    }) }) },
  });
  const request = () => new Request("https://eureka.test/api/payments/mayar/confirm", { method: "POST", body: JSON.stringify({ order: orderId }) });
  assert.equal((await route.POST(request())).status, 404);
  assert.ok(filters.some(([key, value]) => key === "user_id" && value === "owner"));
  assert.equal(upstream, 0);
  auth = { userId: "", error: "Unauthorized", status: 401 };
  assert.equal((await route.POST(request())).status, 401);
  assert.equal(upstream, 0);
});
