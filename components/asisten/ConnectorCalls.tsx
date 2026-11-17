"use client";
import { Check, CircleAlert, ExternalLink, Loader2 } from "lucide-react";
import { connectorById, connectorLogo } from "@/lib/connectors/catalog";
import type { ConnectorCall } from "@/lib/connectors/events";
import "./connector-calls.css";
export default function ConnectorCalls({ calls = [] }: { calls?: ConnectorCall[] }) {
  if (!calls.length) return null;
  return <div className="connector-calls" aria-live="polite">{calls.map(call => {
    const provider = connectorById(call.provider);
    return <article className="connector-call" data-state={call.status} key={call.id}>
      <div className="connector-call-top">
        {provider && <img src={connectorLogo(provider.logo)} alt="" width={28} height={28} />}
        <div><strong>{provider?.name || "Konektor"}</strong><span>{call.label}</span></div>
        {call.status === "running" ? <Loader2 className="connector-call-spin" size={17} /> : call.status === "error" ? <CircleAlert size={17} /> : call.status === "completed" ? <Check size={17} /> : <span>Diproses</span>}
      </div>
      {!!call.links.length && <div className="connector-call-results">{call.links.filter(link => link.url.startsWith("https://")).map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.title}<ExternalLink size={13} /></a>)}</div>}
    </article>;
  })}</div>;
}
