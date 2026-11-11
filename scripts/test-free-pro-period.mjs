import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
let now = Date.now();
class TestDate extends Date {
  static now() { return now; }
}

function load(file, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    exports, Date: TestDate, Response, Request, console,
    process: { env: { NODE_ENV: "production" } },
    require: name => name in dependencies ? dependencies[name] : require(name),
  });
  return exports;
}

const period = load("lib/free-pro-period.ts");
const start = Date.parse(period.FREE_PRO_START);
const end = start + 7 * 86_400_000;

test("the shared Pro period lasts exactly seven days", () => {
  assert.equal(period.getFreeProUntil(start - 1), null);
  assert.equal(period.getFreeProUntil(start), new Date(end).toISOString());
  assert.equal(period.getFreeProUntil(end - 1), new Date(end).toISOString());
  assert.equal(period.getFreeProUntil(end), null);
});

test("free access expires automatically and stored subscriptions keep their original term", async () => {
  const paidUntil = new Date(end + 3 * 86_400_000).toISOString();
  const accounts = {
    free: { is_premium: false, premium_tier: "trial", premium_until: "2025-01-01T00:00:00Z" },
    paid: { is_premium: true, premium_tier: "normal", premium_until: paidUntil },
  };
  const { getPremiumStatus, getSubscriptionStatus } = load("lib/premium.ts", {
    "./free-pro-period": period,
    "./supabase/admin": { db: () => ({
      from: () => ({ select: () => ({ eq: (_column, id) => ({
        maybeSingle: async () => ({ data: accounts[id] ?? null }),
      }) }) }),
    }) },
  });
  now = start;
  assert.equal((await getPremiumStatus("")).isPremium, false);
  for (const account of ["free", "new-account"]) {
    const status = await getPremiumStatus(account);
    assert.equal(status.isPremium, true);
    assert.equal(status.premiumUntil, new Date(end).toISOString());
    assert.equal((await getSubscriptionStatus(account)).isPremium, false);
  }
  assert.equal((await getPremiumStatus("paid")).premiumUntil, paidUntil);
  now = end;
  assert.equal((await getPremiumStatus("free")).isPremium, false);
  assert.equal((await getPremiumStatus("paid")).premiumUntil, paidUntil);
  assert.equal((await getPremiumStatus("paid")).freeAccessUntil, undefined);
});

test("checkout is paused during the free period after authentication", async () => {
  now = start;
  let userId = "";
  const { POST } = load("app/api/payments/checkout/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/assistant/auth": { requireAuth: async () => userId ? { userId } : { userId, status: 401 } },
    "@/lib/free-pro-period": period,
    "@/lib/mayar": { isMayarConfigured() { throw new Error("Checkout reached Mayar during free access"); } },
    "@/lib/paymentPricing": {},
    "@/lib/discount": {},
    "@/lib/rateLimit": {},
    "@/lib/supabase/admin": {},
  });
  const request = () => new Request("https://eureka.test/api/payments/checkout", { method: "POST", body: "{}" });
  assert.equal((await POST(request())).status, 401);
  userId = "verified-user";
  const response = await POST(request());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).freeAccessUntil, new Date(end).toISOString());
});
