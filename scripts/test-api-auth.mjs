import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../lib/assistant/auth.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function authFor(environment, configured = false, premium = false) {
  const exports = {};
  runInNewContext(source, {
    exports,
    process: { env: { NODE_ENV: environment, ALLOW_INSECURE_DEV_AUTH: "true" } },
    require: name => name === "../premium" ? {
      getPremiumStatus: async () => ({ isPremium: premium }),
    } : ({
      isSupabaseConfigured: () => configured,
      db: () => ({
        auth: {
          getUser: async token => token === "valid"
            ? { data: { user: { id: "owner" } }, error: null }
            : { data: { user: null }, error: true },
        },
      }),
    }),
  });
  return Object.assign(exports.requireAuth, { requirePro: exports.requirePro });
}

test("insecure fallback requires development even when explicitly enabled", async () => {
  assert.equal((await authFor("production")(null, "owner")).status, 503);
  assert.equal((await authFor(undefined)(null, "owner")).status, 503);
  assert.equal((await authFor("development")(null, "owner")).userId, "owner");
});

test("configured authentication uses the verified user and rejects invalid or mismatched credentials", async () => {
  const requireAuth = authFor("production", true);
  assert.equal((await requireAuth(null, "owner")).status, 401);
  assert.equal((await requireAuth("Bearer invalid", "owner")).status, 401);
  assert.equal((await requireAuth("Bearer valid", "another-user")).status, 403);
  assert.equal((await requireAuth("Bearer valid", "owner")).userId, "owner");
});

test("Pro entitlement cannot replace authentication and cannot be borrowed with a supplied user ID", async () => {
  const free = authFor("production", true).requirePro;
  assert.equal((await free("Bearer valid", "owner")).status, 402);
  assert.equal((await free(null, "owner")).status, 401);
  const pro = authFor("production", true, true).requirePro;
  assert.equal((await pro("Bearer valid", "another-user")).status, 403);
  assert.equal((await pro("Bearer valid", "owner")).userId, "owner");
});
