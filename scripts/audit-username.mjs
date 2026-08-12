// Audit: keunikan username di tabel public.users (jalankan: node scripts/audit-username.mjs)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function envVal(key) {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = raw.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim() : "";
}

const url = envVal("NEXT_PUBLIC_SUPABASE_URL");
const key = envVal("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("Env Supabase belum terisi di .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// 1) Struktur kolom users
const { data: cols, error: colErr } = await supabase.from("users").select("*").limit(1);
console.log(
  "== Kolom tabel users ==",
  colErr ? `ERROR: ${colErr.message}` : Object.keys(cols?.[0] ?? {}).join(", ") || "(tabel kosong)"
);

// 3) Semua username terdaftar
const { data: rows, error: listErr } = await supabase
  .from("users")
  .select("id, username, email, user_number")
  .order("user_number", { ascending: true });
if (listErr) {
  console.error("Gagal baca users:", listErr.message);
  process.exit(1);
}
console.log(`\n== ${rows.length} baris users ==`);
for (const r of rows) {
  console.log(`#${r.user_number ?? "-"}  @${r.username ?? "(null)"}  (${r.email})  id=${r.id}`);
}

// 4) Deteksi duplikat username
const byUsername = new Map();
for (const r of rows) {
  const u = (r.username ?? "").toLowerCase();
  if (!u) continue;
  if (!byUsername.has(u)) byUsername.set(u, []);
  byUsername.get(u).push(r);
}
const dupes = [...byUsername.entries()].filter(([, v]) => v.length > 1);
if (dupes.length === 0) {
  console.log("\n[OK] Tidak ada username duplikat.");
} else {
  console.log("\n[!!] USERNAME DUPLIKAT DITEMUKAN:");
  for (const [u, list] of dupes) {
    console.log(`  @${u}:`);
    for (const r of list) console.log(`    - ${r.id} (${r.email})`);
  }
}

// 5) Bukti constraint unik (behavioral): buat 2 akun auth, beri username sama → salah satu harus ditolak
const probeName = "audit_probe_unik";
const { data: ua, error: uaErr } = await supabase.auth.admin.createUser({
  email: "audit-probe-a@eureka.local",
  password: "audit-probe-a-123",
  email_confirm: true,
});
const { data: ub, error: ubErr } = await supabase.auth.admin.createUser({
  email: "audit-probe-b@eureka.local",
  password: "audit-probe-b-123",
  email_confirm: true,
});
if (uaErr || ubErr || !ua?.user || !ub?.user) {
  console.log(`\n[SKIP] Tidak bisa membuat akun probe via admin API: ${uaErr?.message ?? ubErr?.message}`);
} else {
  const { error: eA } = await supabase.from("users").insert({
    id: ua.user.id,
    email: ua.user.email,
    name: "AUDIT PROBE A",
    username: probeName,
  });
  if (eA) {
    console.log(`\n[SKIP] Insert probe A gagal: ${eA.code ?? eA.message}`);
  } else {
    const { error: eB } = await supabase.from("users").insert({
      id: ub.user.id,
      email: ub.user.email,
      name: "AUDIT PROBE B",
      username: probeName,
    });
    if (eB) {
      console.log(`\n[OK] Constraint UNIQUE aktif: akun kedua dengan @${probeName} DITOLAK DB (${eB.code ?? eB.message}).`);
    } else {
      console.log(`\n[!!] BAHAYA: dua akun bisa memakai @${probeName} — constraint UNIQUE tidak ada di DB! Jalankan: ALTER TABLE public.users ADD CONSTRAINT users_username_uniq UNIQUE (username);`);
      await supabase.from("users").delete().eq("id", ub.user.id);
    }
    await supabase.from("users").delete().eq("id", ua.user.id);
  }
  await supabase.auth.admin.deleteUser(ua.user.id);
  await supabase.auth.admin.deleteUser(ub.user.id);
}
