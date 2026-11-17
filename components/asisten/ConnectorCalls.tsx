"use client";

import { Check, ChevronDown, CircleAlert, ExternalLink } from "lucide-react";
import { connectorById, connectorLogo } from "@/lib/connectors/catalog";
import type { ConnectorCall } from "@/lib/connectors/events";
import type { LoadingStage } from "@/lib/loading-stage";
import CanvaResultPreview from "./CanvaResultPreview";
import ChatResponseLoader from "./ChatResponseLoader";
import "./connector-calls.css";

export default function ConnectorCalls({ calls = [], streaming = false, detail, stage = "thinking", onCanvaPrompt }: {
  calls?: ConnectorCall[];
  streaming?: boolean;
  detail?: string;
  stage?: LoadingStage;
  onCanvaPrompt?: (prompt: string) => void;
}) {
  if (!calls.length && !streaming) return null;

  const latest = calls.at(-1);
  const provider = latest && connectorById(latest.provider);
  const label = latest?.status === "completed"
    ? streaming ? detail || "Menyusun jawaban…" : `${provider?.name || "Konektor"} · Selesai`
    : latest?.label ?? detail;
  const previews = calls.flatMap(call => call.previews ?? []).slice(0, 3);
  const canvaPrompt = streaming ? undefined : onCanvaPrompt;
  const gallery = latest?.links.find(link => link.url === "https://www.canva.com/templates/");

  return <div className="connector-flow">
    <details className="connector-process" data-streaming={streaming || undefined}>
      <summary aria-label={latest ? "Tampilkan atau sembunyikan proses konektor" : undefined}
        tabIndex={latest ? 0 : -1} onClick={event => { if (!latest) event.preventDefault(); }}>
        <ChatResponseLoader stage={stage} busy={streaming} detail={label} iconKey={provider?.id || "orb"}
          icon={provider ? <img src={connectorLogo(provider.logo)} alt="" width={28} height={28} className="connector-process-logo" /> : undefined} />
        {latest && <ChevronDown size={15} aria-hidden="true" />}
      </summary>
      <div className="connector-calls">{calls.map(call => {
        const app = connectorById(call.provider);
        const links = call.links.filter(link => link.url.startsWith("https://") &&
          (call.provider !== "canva" || !link.url.startsWith("https://media.canva.com/")));
        return <article className="connector-call" data-state={call.status} key={call.id}>
          <div className="connector-call-top">
            {app && <img src={connectorLogo(app.logo)} alt="" width={24} height={24} />}
            <div><strong>{app?.name || "Konektor"}</strong><span>{call.label}</span></div>
            {call.status === "error" && <CircleAlert size={16} aria-hidden="true" />}
            {call.status === "completed" && <Check size={16} aria-hidden="true" />}
          </div>
          {!!links.length && <div className="connector-call-results">{links.map(link => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.title}<ExternalLink size={13} aria-hidden="true" /></a>
          ))}</div>}
        </article>;
      })}</div>
    </details>
    {calls.flatMap(call => (call.updates ?? []).map(update => (
      <p className="connector-update" key={`${call.id}:${update}`}>{update}</p>
    )))}
    {!!previews.length && <div className="connector-previews" aria-label={latest?.canvaSearch ? "Template Canva" : "Desain Canva"}>
      {previews.map(preview => <CanvaResultPreview key={preview.id} initial={preview} onPrompt={canvaPrompt} />)}
    </div>}
    {canvaPrompt && latest?.canvaSearch?.continuation && <button type="button" className="canva-chat-action"
      onClick={() => canvaPrompt("Tampilkan template Canva berikutnya")}>Template berikutnya</button>}
    {gallery && !previews.length && <a className="canva-chat-action" href={gallery.url} target="_blank" rel="noopener noreferrer">
      Buka galeri Canva <ExternalLink size={13} aria-hidden="true" />
    </a>}
  </div>;
}
