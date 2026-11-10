import { supabase, getAccessToken } from "@/lib/supabase/client";
import { finishGoogleOAuth } from "@/lib/auth";

export function isInstalledEureka() {
  return typeof window !== "undefined" && (matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export async function prepareInstalledAccount(link = false) {
  const token = await getAccessToken();
  if (!token) throw new Error("Masuk ke akunmu terlebih dahulu.");
  const response = await fetch("/api/auth/install-account", {
    method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ action: link ? "link" : "prepare" }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Akun belum bisa disiapkan.");
  return data as { ticket?: string; ready: boolean };
}

let restore: Promise<boolean> | undefined;
export function restoreInstalledAccount(ticket?: string): Promise<boolean> {
  if (!ticket && !isInstalledEureka()) return Promise.resolve(false);
  if (restore) return restore;
  restore = (async () => {
    if (!supabase) return false;
    const response = await fetch("/api/auth/install-account", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", ticket }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Akun belum bisa diimpor.");
    if (!data.restored) return false;
    const { error } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (error) throw new Error("Sesi belum tersimpan. Buat tautan impor baru.");
    const result = await finishGoogleOAuth();
    if (!result.ok) throw new Error("Akun belum bisa dimuat.");
    return true;
  })().finally(() => { restore = undefined; });
  return restore;
}
