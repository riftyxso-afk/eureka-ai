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

const USER_ID = "1258eab8-d692-41ee-ba8c-7e9194e8fc68";
// 30 hari dari aktivasi pertama (2026-08-15 05:53:03 UTC) = satu pembayaran.
const PREMIUM_UNTIL = "2026-09-14T05:53:03.542Z";

const { error } = await sb
  .from("users")
  .update({ is_premium: true, premium_until: PREMIUM_UNTIL })
  .eq("id", USER_ID);
if (error) {
  console.error("Update gagal:", error.message);
  process.exit(1);
}

const { data } = await sb
  .from("users")
  .select("id,email,is_premium,premium_tier,premium_until,pakasir_invoice_number")
  .eq("id", USER_ID)
  .maybeSingle();
console.log(JSON.stringify(data, null, 2));
