"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Search, X } from "lucide-react";
import { CONNECTORS, connectorLogo, type ConnectorId } from "@/lib/connectors/catalog";
import { apiFetch } from "@/lib/apiClient";
import "./connector-picker.css";

export default function ConnectorPicker({ selected, onSelect, onClose }: {
  selected?: string; onSelect: (id: ConnectorId) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [connected, setConnected] = useState<Record<string, "read" | "write">>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const request = new AbortController();
    setLoading(true); setError("");
    apiFetch("/api/connectors", { signal: request.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok || data.warning) throw new Error(data.error || data.warning || "Koneksi belum dapat diperiksa.");
      if (!request.signal.aborted) {
        setConnected(Object.fromEntries(data.providers.flatMap((provider: {
          id: string;
          connection: { permission: string } | null;
        }) => provider.connection ? [[provider.id, provider.connection.permission === "write" ? "write" : "read"]] : [])));
      }
    }).catch(cause => { if (!request.signal.aborted) setError(cause.message || "Koneksi belum dapat diperiksa."); })
      .finally(() => { if (!request.signal.aborted) setLoading(false); });
    return () => request.abort();
  }, [attempt]);
  useEffect(() => { if (matchMedia("(hover: hover) and (pointer: fine)").matches) search.current?.focus(); }, []);
  const filtered = CONNECTORS.filter(provider => provider.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="chat-connector-picker" aria-label="Pilih konektor" onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),input,a")];
    const current = controls.indexOf(document.activeElement as HTMLElement);
    event.preventDefault(); controls[(current + (event.key === "ArrowDown" ? 1 : controls.length - 1)) % controls.length]?.focus();
  }}>
    <header><button type="button" aria-label="Kembali ke menu alat" onClick={onClose}><ArrowLeft size={17} /></button><div><strong>Konektor</strong><span>Pilih aplikasi untuk pesanmu</span></div><a href="/dashboard-v2/pengaturan/konektor" target="_blank" rel="noopener noreferrer" aria-label="Atur konektor di tab baru"><ExternalLink size={16} /></a></header>
    <div className="chat-connector-search">
      <Search size={16} aria-hidden="true" />
      <input type="text" ref={search} value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari aplikasi…" aria-label="Cari konektor" />
      {query && <button type="button" aria-label="Hapus pencarian" onClick={() => { setQuery(""); search.current?.focus(); }}><X size={16} /></button>}
    </div>
    {loading && <p role="status">Memeriksa koneksi…</p>}
    {error && <div role="alert" className="chat-connector-error">{error}<button type="button" onClick={() => setAttempt(value => value + 1)}>Coba lagi</button></div>}
    <div className="chat-connector-list">{filtered.map(provider => {
      const permission = !loading && !error ? connected[provider.id] : undefined;
      return <div key={provider.id} className="chat-connector-item" data-selected={selected === provider.id || undefined}>
        <img src={connectorLogo(provider.logo)} alt="" width={24} height={24} />
        {permission ? <button type="button" aria-pressed={selected === provider.id} onClick={() => onSelect(provider.id)}><span>{provider.name}<small>{permission === "write" ? "Baca & tulis" : "Hanya baca"}</small></span>{selected === provider.id && <Check size={16} />}</button>
          : <a href={`/dashboard-v2/pengaturan/konektor/${provider.id}`} target="_blank" rel="noopener noreferrer"><span>{provider.name}<small>{loading ? "Memeriksa…" : error ? "Periksa koneksi" : "Hubungkan"}</small></span><ExternalLink size={14} /></a>}
      </div>;
    })}</div>
    {!filtered.length && <p>Tidak ada aplikasi dengan nama itu.</p>}
  </section>;
}
