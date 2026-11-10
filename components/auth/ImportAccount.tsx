"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { restoreInstalledAccount } from "@/lib/installedAccount";

export default function ImportAccount({ fromLink = false }: { fromLink?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [ticket, setTicket] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!fromLink) return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    setTicket(hash.get("account") || "");
    window.history.replaceState(null, "", window.location.pathname);
  }, [fromLink]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      let transfer = ticket;
      if (!fromLink) {
        const url = new URL(value.trim());
        const aliases = ["eureka-ai.web.id", "www.eureka-ai.web.id"];
        const sameSite = url.origin === window.location.origin || (url.protocol === "https:" && window.location.protocol === "https:" &&
          aliases.includes(url.hostname) && aliases.includes(window.location.hostname));
        if (!sameSite || !/^\/(id\/|en\/)?auth\/import\/?$/.test(url.pathname)) {
          throw new Error("Gunakan tautan impor dari Eureka di browser yang sama.");
        }
        transfer = new URLSearchParams(url.hash.slice(1)).get("account") || "";
      }
      if (!transfer) throw new Error("Tautan impor belum tersedia. Salin tautan dari browser yang sudah masuk.");
      if (await restoreInstalledAccount(transfer)) {
        setValue(""); setTicket("");
        router.replace("/dashboard-v2");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Akun belum bisa diimpor.");
    } finally { setBusy(false); }
  }

  const content = <div className="space-y-3 py-3">
    <p className="text-sm leading-relaxed text-clay-muted">Di browser yang sudah masuk, buka panduan Tambah ke layar utama, lalu pilih Salin tautan impor. Tautan berlaku 10 menit dan hanya bisa digunakan sekali.</p>
    {!fromLink && <label className="block text-sm font-bold">Tautan impor akun
      <input type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={value} onChange={e => setValue(e.target.value)}
        placeholder="Tempel tautan dari browser" className="mt-2 block w-full min-h-12 rounded-xl border border-clay-shadow bg-clay-cream px-3 text-base font-normal text-clay-dark" />
    </label>}
    {fromLink && getSession()?.userId && <p className="text-sm text-clay-muted">Mengimpor akan mengganti akun yang sedang digunakan di aplikasi ini.</p>}
    <button type="button" onClick={() => void submit()} disabled={busy || (fromLink ? !ticket : !value.trim())}
      className="min-h-12 w-full rounded-xl bg-clay-primary px-4 py-3 font-bold text-white disabled:opacity-50">
      {busy ? "Mengimpor akun…" : "Impor akun & buka Eureka"}
    </button>
    {message && <p role="alert" className="text-sm text-red-600">{message}</p>}
  </div>;
  return fromLink ? content : <details className="mt-5 rounded-2xl border border-clay-shadow/40 px-4 text-clay-dark">
    <summary className="min-h-12 cursor-pointer py-3 text-sm font-bold">Sudah masuk di browser? Impor akun</summary>{content}
  </details>;
}
