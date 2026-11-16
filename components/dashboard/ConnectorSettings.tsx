"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CircleHelp, ExternalLink, Loader2, Plug, Search, ShieldCheck, X } from "lucide-react";
import { CONNECTORS, connectorLogo, type ConnectorId } from "@/lib/connectors/catalog";
import { apiFetch } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import "./connectors.css";

type Provider = typeof CONNECTORS[number] & { ready: boolean; connection: { permission: "read" | "write" } | null };

function ConnectorDialog({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="connector-dialog-backdrop" aria-labelledby={label}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="connector-guide">{children}</section>
  </dialog>;
}

export default function ConnectorSettings({ selected, configurationOnly = true }: { selected?: string; configurationOnly?: boolean }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [tutorial, setTutorial] = useState<number | null>(null);
  const [disconnect, setDisconnect] = useState<ConnectorId | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    if (configurationOnly) {
      setProviders(CONNECTORS.map(provider => ({ ...provider, ready: false, connection: null })));
      setLoading(false);
      return;
    }
    try {
      const response = await apiFetch("/api/connectors", { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Daftar konektor belum dapat dimuat.");
      setProviders(data.providers);
      if (data.warning) setError(data.warning);
      else if (new URLSearchParams(location.search).get("connection") === "failed") setError("Koneksi belum berhasil. Pilih aplikasi dan hubungkan lagi.");
    } catch (failure) {
      if (!signal?.aborted) setError((failure as Error).message);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [configurationOnly]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const status = new URLSearchParams(location.search).get("connection");
    if (!configurationOnly && status === "success") toast.success("Aplikasi berhasil dihubungkan.");
    if (!configurationOnly && status === "failed") setError("Koneksi belum berhasil. Kembali ke aplikasi dan coba hubungkan lagi.");
    return () => controller.abort();
  }, [load, configurationOnly]);

  const current = providers.find(provider => provider.id === selected);
  async function connect() {
    if (!current || busy) return;
    setBusy(current.id);
    setError("");
    try {
      const response = await apiFetch("/api/connectors/authorize", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: current.id, permission }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const url = new URL(result.url);
      if (!["accounts.google.com", "www.canva.com", "api.notion.com"].includes(url.hostname) || url.protocol !== "https:") throw new Error("Alamat login provider tidak valid.");
      location.assign(url.href);
    } catch (failure) { setError((failure as Error).message); setBusy(""); }
  }
  async function remove() {
    if (!disconnect || busy) return;
    setBusy(disconnect);
    try {
      const response = await apiFetch("/api/connectors", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: disconnect }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success("Akses aplikasi dilepas dari Eureka.");
      setDisconnect(null);
      await load();
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(""); }
  }
  const steps = [
    { title: "Pilih aplikasi yang kamu gunakan", text: "Cari Canva, Google Drive, atau aplikasi lain di daftar. Status Terhubung berarti akunmu sudah memberikan akses.", target: ".connector-grid" },
    { title: "Tinjau izin sebelum menghubungkan", text: "Pilih hanya baca untuk mencari materi. Pilih baca & tulis bila ingin membuat dokumen. Login dan pilih akunmu di halaman resmi provider.", target: ".connector-grid" },
    { title: "Minta lewat chat", text: "Sebutkan aplikasinya, misalnya “Cari materi biologi di Google Drive”. Untuk Canva, pilih template lalu minta AI mengisinya. Hasil dan tautannya muncul di chat.", target: ".connector-example" },
  ];
  const visible = providers.filter(provider => provider.name.toLowerCase().includes(query.toLowerCase()));
  return <div className={selected ? "connector-surface connector-consent-surface" : "connector-surface"}>
    <div className="connector-orbit" aria-hidden="true">{CONNECTORS.filter(p => ["drive", "canva", "notion", "sheets"].includes(p.id)).map(p => <img key={p.id} src={connectorLogo(p.logo)} alt="" />)}</div>
    <div className="connector-content">
      <Link href={selected ? "/dashboard-v2/pengaturan/konektor" : "/dashboard-v2/pengaturan"} className="connector-back"><ArrowLeft size={16} />{selected ? "Semua konektor" : "Pengaturan"}</Link>
      {selected ? loading ? <div className="connector-skeleton" aria-label="Memuat izin aplikasi" /> : !current ? <div className="connector-empty"><h1>Aplikasi tidak ditemukan</h1><Link href="/dashboard-v2/pengaturan/konektor">Pilih aplikasi lain</Link></div> :
        <section className="connector-consent" aria-labelledby="consent-title">
          <div className="connector-pair"><img src="/icons/momo-192.png" alt="Eureka" /><span>↔</span><img src={connectorLogo(current.logo)} alt={current.name} /></div>
          <h1 id="consent-title">Hubungkan {current.name}<br />ke Eureka</h1>
          <p>Gunakan aplikasimu langsung dari percakapan.</p>
          <div className="connector-permissions">
            <fieldset><legend>Akses aplikasi</legend><div className="connector-segment">
              <label><input type="radio" name="permission" checked={permission === "read"} onChange={() => setPermission("read")} disabled={!!busy} /><span>Hanya baca</span></label>
              {!!current.write.length && <label><input type="radio" name="permission" checked={permission === "write"} onChange={() => setPermission("write")} disabled={!!busy} /><span>Baca & tulis</span></label>}
            </div></fieldset>
            <ul>{[...current.read, ...(permission === "write" ? current.write : [])].map(item => <li key={item}><Check size={16} />{item}</li>)}</ul>
            <div className="connector-account-note"><ShieldCheck size={18} /><span>Pilih akun dan file yang boleh diakses di halaman resmi {current.name}. Izin dapat kamu cabut dari Pengaturan.</span></div>
          </div>
          {!current.ready && <p className="connector-not-ready" role="status">Pengelola sedang menyiapkan koneksi {current.name}. Tombol akan aktif setelah konfigurasi selesai.</p>}
          {error && <p className="connector-error" role="alert">{error}</p>}
          <div className="connector-consent-actions"><Link href="/dashboard-v2/pengaturan/konektor">Batal</Link><button disabled={!current.ready || !!busy} onClick={() => void connect()}>{busy ? <Loader2 className="connector-spin" size={17} /> : <ExternalLink size={16} />}Lanjut ke {current.name}</button></div>
          <small>Eureka menyimpan akses secara terenkripsi.</small>
        </section> : <>
        <header className="connector-heading"><div><h1>Aplikasi untuk cara belajarmu.</h1><p>Ambil materi, buat sesuatu, dan lanjutkan di chat.</p></div><button onClick={() => setTutorial(0)} aria-label="Buka panduan konektor"><CircleHelp size={19} />Panduan</button></header>
        <div className="connector-toolbar"><label><Search size={18} /><input aria-label="Cari aplikasi" placeholder="Cari aplikasi…" value={query} onChange={event => setQuery(event.target.value)} /></label><span>{providers.filter(p => p.connection).length} terhubung</span></div>
        {error && <div className="connector-error" role="alert">{error}<button onClick={() => void load()}>Coba lagi</button></div>}
        <section className="connector-grid" aria-label="Aplikasi tersedia">{loading ? [0, 1, 2, 3].map(i => <div className="connector-skeleton" key={i} />) : visible.map(provider => <article key={provider.id}>
          <div className="connector-card-header"><img src={connectorLogo(provider.logo)} alt={provider.name} /><span className="connector-status" data-on={!!provider.connection}>{provider.connection ? "Terhubung" : provider.ready ? "Tersedia" : "Sedang disiapkan"}</span></div>
          <h2>{provider.name}</h2><p>{provider.description}</p>
          <footer><Link href={`/dashboard-v2/pengaturan/konektor/${provider.id}`}>{provider.connection ? "Atur akses" : "Hubungkan"}<ArrowRight size={15} /></Link>{provider.connection && <button disabled={!!busy} onClick={() => setDisconnect(provider.id)}>Lepas</button>}</footer>
        </article>)}</section>
        {!loading && !visible.length && <p className="connector-empty">Aplikasi tidak ditemukan. Coba nama lain.</p>}
        <section className="connector-example"><div className="connector-example-icon"><Plug size={23} /></div><div><h2>Satu percakapan, terhubung ke materimu.</h2><p>“Cari materi biologi di Drive, lalu buat ringkasannya.”</p><Link href="/dashboard-v2">Buka chat <ArrowRight size={15} /></Link></div></section>
      </>}
    </div>
    {tutorial !== null && <ConnectorDialog label="connector-guide-title" onClose={() => setTutorial(null)}>
        <button className="connector-close" autoFocus aria-label="Tutup panduan" onClick={() => setTutorial(null)}><X size={20} /></button>
        <small>Langkah {tutorial + 1} dari {steps.length}</small><h2 id="connector-guide-title">{steps[tutorial].title}</h2><p>{steps[tutorial].text}</p>
        <div><button disabled={tutorial === 0} onClick={() => setTutorial(tutorial - 1)}>Sebelumnya</button><button onClick={() => {
          if (tutorial === steps.length - 1) setTutorial(null);
          else { setTutorial(tutorial + 1); document.querySelector(steps[tutorial + 1].target)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" }); }
        }}>{tutorial === steps.length - 1 ? "Mengerti" : "Berikutnya"}<ArrowRight size={16} /></button></div>
    </ConnectorDialog>}
    {disconnect && <ConnectorDialog label="disconnect-title" onClose={() => { if (!busy) setDisconnect(null); }}><h2 id="disconnect-title">Lepas {providers.find(p => p.id === disconnect)?.name}?</h2><p>Eureka akan menghapus akses tersimpan untuk aplikasi ini. Kamu bisa menghubungkannya kembali.</p><div><button autoFocus disabled={!!busy} onClick={() => setDisconnect(null)}>Batal</button><button disabled={!!busy} onClick={() => void remove()}>{busy ? "Melepas…" : "Lepas koneksi"}</button></div></ConnectorDialog>}
  </div>;
}
