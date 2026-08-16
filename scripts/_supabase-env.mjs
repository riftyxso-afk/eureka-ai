#!/usr/bin/env node
/**
 * Helper bersama untuk skrip test: membaca kredensial dari environment
 * (process.env) dengan fallback ke .env.local. Tidak pernah menyimpan
 * nilai rahasia di source code.
 */
import { readFileSync } from "node:fs";

export function loadEnvValue(name) {
  if (process.env[name]) return process.env[name];
  try {
    const line = readFileSync(".env.local", "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${name}=`));
    return line ? line.replace(`${name}=`, "").trim() : undefined;
  } catch {
    return undefined;
  }
}

export function getSupabaseConfig() {
  const url =
    loadEnvValue("NEXT_PUBLIC_SUPABASE_URL") ||
    "https://ruajiywsdixhsketfurf.supabase.co";
  const key = loadEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) {
    console.error("❌ SUPABASE_SERVICE_ROLE_KEY not set (env atau .env.local)");
    process.exit(1);
  }
  return { url, key };
}