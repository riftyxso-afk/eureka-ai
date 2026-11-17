"use client";
import { Check, ChevronDown, CircleAlert, ExternalLink } from "lucide-react";
import { connectorById, connectorLogo } from "@/lib/connectors/catalog";
import type { ConnectorCall } from "@/lib/connectors/events";
import type { LoadingStage } from "@/lib/loading-stage";
import ChatResponseLoader from "./ChatResponseLoader";
import "./connector-calls.css";
export default function ConnectorCalls({ calls = [], streaming = false, detail, stage = "thinking" }: { calls?: ConnectorCall[]; streaming?: boolean; detail?: string; stage?: LoadingStage }) {
  if (!calls.length && !streaming) return null;
  const latest = calls.at(-1);
  const provider = latest && connectorById(latest.provider);
  const active = calls.some(call => call.status === "running" || call.status === "pending");
  return <details className="connector-process" data-streaming={streaming || undefined}>
    <summary aria-label={calls.length ? "Tampilkan atau sembunyikan proses konektor" : undefined} tabIndex={calls.length ? 0 : -1} onClick={event => {if(!calls.length)event.preventDefault();}}>
      <ChatResponseLoader stage={stage} busy={streaming || active} detail={active ? latest?.label : latest ? streaming ? detail || "Menyusun jawaban…" : latest.status === "error" ? "Koneksi aplikasi perlu diperiksa" : `${provider?.name || "Konektor"} · Selesai` : detail}
        iconKey={provider?.id || "orb"} icon={provider ? <img src={connectorLogo(provider.logo)} alt="" width={28} height={28} style={{objectFit:"contain"}} /> : undefined} />
      {!!calls.length && <ChevronDown size={15} aria-hidden="true" />}</summary>
    <div className="connector-calls">{calls.map(call => {
    const provider = connectorById(call.provider);
    return <article className="connector-call" data-state={call.status} key={call.id}>
      <div className="connector-call-top">
        {provider && <img src={connectorLogo(provider.logo)} alt="" width={28} height={28} />}
        <div><strong>{provider?.name || "Konektor"}</strong><span>{call.label}</span></div>
        {call.status === "error" ? <CircleAlert size={17} /> : call.status === "completed" ? <Check size={17} /> : <span>Diproses</span>}
      </div>
      {!!call.links.length && <div className="connector-call-results">{call.links.filter(link => link.url.startsWith("https://")).map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.title}<ExternalLink size={13} /></a>)}</div>}
    </article>;
  })}</div></details>;
}
