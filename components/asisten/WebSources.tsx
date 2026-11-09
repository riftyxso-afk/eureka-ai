"use client";

import { useId, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { normalizeWebResults } from "@/lib/assistant/webSources";
import type { WebSearchItem } from "@/lib/assistant/types";
import "./web-search.css";

export function SiteLogo({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  return <span className="web-site-logo" aria-hidden="true">
    {failed ? domain.charAt(0).toUpperCase() : (
      // Favicons keep the site's branding, with a text fallback if unavailable.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
        width={18} height={18} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    )}
  </span>;
}

export default function WebSources({ results }: { results: WebSearchItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const sources = normalizeWebResults(results);
  const sites = [...new Map(sources.map(source => [source.domain, source])).values()];
  if (!sources.length) return null;
  return <section className="web-sources" aria-label="Sumber web">
    <button type="button" className="web-sources-toggle" aria-expanded={expanded} aria-controls={id}
      onClick={() => setExpanded(value => !value)} aria-label={`${expanded ? "Tutup" : "Buka"} ${sources.length} sumber web`}>
      <span className="web-sources-logos" aria-hidden="true">{sites.slice(0, 6).map(source => <SiteLogo key={source.domain} domain={source.domain} />)}</span>
      <span className="sr-only">{sources.length} sumber</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    <div id={id} hidden={!expanded}>
    <ul>{sources.map(source => <li key={source.url}>
      <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.title}>
        <SiteLogo key={source.domain} domain={source.domain} />
        <span><small>{source.domain}</small><strong>{source.title}</strong></span>
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
    </li>)}</ul></div>
  </section>;
}
