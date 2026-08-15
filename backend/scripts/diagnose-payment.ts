import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
);

const redactEmail = (e) => {
  const s = String(e ?? "");
  const at = s.indexOf("@");
  if (at <= 0) return s;
  return s.slice(0, 3) + "…" + s.slice(at);
};

async function main() {
  const { data: users } = await sb.from("users").select("id, email, name, is_premium, premium_tier, premium_until, trial_claimed_at, created_at").order("created_at", { ascending: true });
  console.log("=== SEMUA USER ===");
  for (const u of users ?? []) {
    console.log(`${u.id.slice(0, 8)} | ${redactEmail(u.email)} | ${u.name ?? ""} | prem=${u.is_premium} tier=${u.premium_tier ?? "-"} until=${u.premium_until ?? "-"} | trial=${u.trial_claimed_at ?? "-"}`);
  }

  const { data: reqs } = await sb.from("pakasir_payment_requests").select("*");
  console.log("\n=== Payment request per user ===");
  for (const r of reqs ?? []) {
    console.log(`${r.order_id} | user=${r.user_id.slice(0, 8)} | ${r.amount} | ${r.status} | created=${r.created_at}`);
  }
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
