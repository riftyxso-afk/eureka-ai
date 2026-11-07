"use client";
/* eslint-disable @next/next/no-img-element -- favicons come from source domains, with a generated fallback. */
import { useState } from "react";
import { ArrowUpRight, FileText, Link2 } from "lucide-react";
import type { SearchSource } from "@/lib/types";

function youtubeId(raw: string) {
  try { const url = new URL(raw); const host = url.hostname.replace(/^www\./, ""); if (host === "youtu.be") return /^[\w-]{11}$/.test(url.pathname.slice(1)) ? url.pathname.slice(1) : null; if (host === "youtube.com" || host === "m.youtube.com") { const value = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1]; return value && /^[\w-]{11}$/.test(value) ? value : null; } } catch {} return null;
}
function sourceName(host: string) { if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return "YouTube"; if (/(^|\.)wikipedia\.org$/.test(host)) return "Wikipedia"; if (host === "docs.google.com") return "Google Docs"; if (host === "drive.google.com") return "Google Drive"; if (/(^|\.)notion\.(so|site)$/.test(host)) return "Notion"; return host.replace(/^www\./, ""); }
function Brand({ host }: { host: string }) {
  const [failed, setFailed] = useState(false);
  const name = sourceName(host);
  if (name === "YouTube") return <span className="rm-source-brand is-youtube" aria-hidden="true"><span className="dv2-youtube-logo" /></span>;
  return <span className="rm-source-brand" aria-hidden="true">{failed ? <span className="rm-nav-illustration" style={{ backgroundPosition: "100% 50%" }} /> : <img src={name === "Wikipedia" ? "/brands/wikipedia.png" : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`} alt="" width={32} height={32} referrerPolicy="no-referrer" onError={() => setFailed(true)} />}</span>;
}

export default function SourceMaterials({ files, sources, sourceUrl }: { files: { name: string; size: number }[]; sources: SearchSource[]; sourceUrl?: string }) {
  return <section className="rm-sources"><div className="rm-feature-heading"><div><h1>Sumber materi</h1><p>Buka kembali materi asli yang digunakan dalam catatan ini.</p></div><span className="rm-source-count">{files.length + sources.length} sumber</span></div>
    {files.length > 0 && <div className="rm-source-group"><h2><FileText size={16} />Materi unggahan <span>{files.length}</span></h2><div className="rm-source-grid">{files.map((file, i) => <div className="rm-source-card is-file" key={`${file.name}:${i}`}><span className="rm-source-brand" aria-hidden="true"><span className="rm-nav-illustration" style={{ backgroundPosition: "50% 0%" }} /></span><div><small>{file.name.split('.').pop()?.toUpperCase() || "DOKUMEN"} · {Math.ceil(file.size / 1024)} KB</small><strong>{file.name}</strong><p>Materi unggahan untuk catatan ini.</p></div></div>)}</div></div>}
    <div className="rm-source-group"><h2><Link2 size={16} />Tautan & referensi <span>{sources.length}</span></h2>{sources.length ? <div className="rm-source-grid">{sources.map(source => {
      const url = new URL(source.url); const name = sourceName(url.hostname); const video = youtubeId(source.url); const primary = source.url === sourceUrl;
      return <a className={`rm-source-card ${video ? "has-video" : ""}`} key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"><Brand host={url.hostname} /><div><small>{name}{primary ? " · SUMBER UTAMA" : " · REFERENSI"}</small><strong>{source.title === "Materi sumber" ? `${name} · Materi utama` : source.title}</strong><p>{source.snippet?.trim() || `${url.hostname.replace(/^www\./, "")}${url.pathname !== "/" ? url.pathname : ""}`}</p><span className="rm-source-open">Buka di {name} <ArrowUpRight size={13} /></span></div>{video && <div className="rm-source-thumbnail"><img src={`https://i.ytimg.com/vi/${video}/hqdefault.jpg`} alt="Pratinjau video sumber" loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = "none"; }} /><span className="dv2-youtube-logo" aria-hidden="true" /></div>}<ArrowUpRight className="rm-source-arrow" size={17} /></a>;
    })}</div> : <div className="rm-source-empty"><span className="rm-nav-illustration" style={{ backgroundPosition: "100% 50%" }} /><h3>Belum ada tautan sumber</h3><p>Referensi akan tampil di sini ketika materi menyertakan tautan web atau video.</p></div>}</div>
  </section>;
}
