import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const project = process.env.PAKASIR_PROJECT?.trim() ?? "";
const apiKey = process.env.PAKASIR_API_KEY?.trim() ?? "";
const orderId = process.argv[2]?.trim() ?? "";
const amount = Number(process.argv[3]) || 59000;

if (!project || !apiKey) {
  console.error("PAKASIR_PROJECT/PAKASIR_API_KEY tidak ada di .env.local");
  process.exit(1);
}
if (!orderId) {
  console.error("Pemakaian: npx tsx scripts/verify-order.ts <order_id> [amount]");
  process.exit(1);
}

const params = new URLSearchParams({
  project,
  amount: String(amount),
  order_id: orderId,
  api_key: apiKey,
});
const url = `https://app.pakasir.com/api/transactiondetail?${params.toString()}`;
console.log("GET", url.replace(apiKey, "<redacted>"));

const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
const body = (await res.json().catch(() => null)) as unknown;
console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(body, null, 2));
