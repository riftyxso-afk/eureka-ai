"use client";

import { Check, Globe, Search } from "lucide-react";
import { SiteLogo } from "./WebSources";
import { normalizeWebResults } from "@/lib/assistant/webSources";
import type { WebSearchItem, WebSearchStage } from "@/lib/assistant/types";
import "./web-search.css";

const STEPS: { id: WebSearchStage; label: string; title: string }[] = [
  { id: "preparing", label: "Siapkan", title: "Menyiapkan penelusuran" },
  { id: "searching", label: "Telusuri", title: "Momo sedang menelusuri web" },
  { id: "analyzing", label: "Baca hasil", title: "Membaca hasil pencarian" },
  { id: "writing", label: "Tulis", title: "Menyusun jawaban dari hasil penelusuran" },
];

export default function WebSearchPipeline({ stage, results, query = "", notice }: {
  stage: WebSearchStage | null;
  results: WebSearchItem[];
  query?: string;
  notice?: string | null;
}) {
  const active = Math.max(0, STEPS.findIndex(step => step.id === stage));
  const sources = normalizeWebResults(results);
  const sites = [...new Map(sources.map(source => [source.domain, source])).values()];
  return <section className="web-search-live" aria-label="Progres pencarian web" aria-busy="true">
    <header><span className="web-search-orbit" aria-hidden="true"><Search size={17} /></span>
      <div><span className="web-search-title" role="status">{STEPS[active].title}</span>
        {query && <p className="web-search-query">{query}</p>}
      </div>
    </header>
    <ol className="web-search-steps" aria-label="Tahap pencarian">
      {STEPS.map((step, index) => <li key={step.id} data-state={index < active ? "done" : index === active ? "active" : "pending"}
        aria-current={index === active ? "step" : undefined}>
        <span aria-hidden="true">{index < active ? <Check size={11} /> : <i />}</span>{step.label}
      </li>)}
    </ol>
    {sources.length > 0 && <div className="web-search-found">
      <div aria-hidden="true">{sites.slice(0, 5).map(source => <SiteLogo key={source.domain} domain={source.domain} />)}</div>
      <p><strong>{sources.length} hasil ditemukan</strong><span>{sites.slice(0, 3).map(source => source.domain).join(" · ")}{sites.length > 3 ? ` +${sites.length - 3}` : ""}</span></p>
    </div>}
    {!sources.length && (stage === "searching" || stage === "preparing") && <div className="web-search-placeholder" aria-hidden="true"><Globe size={15} /><span /><span /></div>}
    {notice && <p className="web-search-notice" role="status">{notice}</p>}
  </section>;
}
