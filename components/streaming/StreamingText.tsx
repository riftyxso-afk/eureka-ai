"use client";

import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * STREAMING TEXT — real SSE, not mock
 * Words resolve out of blur, inline citations appear in
 * context, then actions and follow-up prompts become usable.
 * ───────────────────────────────────────────────────────── */

export type StreamingToken = { text: string; cite?: boolean };
export type StreamingSource = { name: string; domain: string; href: string; image: string };

// Fallback mock only for Storybook/demo when no content prop is passed
const MOCK_TOKENS: StreamingToken[] = [
  ..."Pistachio is your fastest-growing flavor — sales are up 23% this month and margins beat vanilla by 8 points."
    .split(" ")
    .map((text) => ({ text })),
  { text: "", cite: true },
  ..."Stone-fruit flavors are trending in the same range.".split(" ").map((text) => ({ text })),
];

const MOCK_SOURCES: StreamingSource[] = [
  { name: "Scoop Data", domain: "scoopdata.io", href: "https://scoopdata.io/", image: "" },
  { name: "Trends Index", domain: "trends.google.com", href: "https://trends.google.com/trends/", image: "" },
  { name: "Market Basket", domain: "marketbasket.io", href: "https://marketbasket.io/", image: "" },
];

const WORD_MS = 18; // real streaming: fast, will be overridden by real SSE (content grows via props)
const HOLD_MS = 3400;

function SourceChip({ source }: { source?: StreamingSource }) {
  if (!source) return null;
  return (
    <a href={source.href} target="_blank" rel="noreferrer" className="ml-0 mr-1 inline-flex h-4.5 translate-y-[-1px] items-center gap-1 rounded-[5px] bg-clay-beige pr-[3px] pl-[3px] align-middle font-mono text-[10.5px] text-clay-muted shadow-sm transition-colors hover:bg-clay-beige/80 hover:text-clay-dark" style={{ animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" }}>
      <span className="size-3 rounded-[3px] bg-clay-primary/20" />
      <span>{source.domain}</span>
    </a>
  );
}

export default function StreamingText({
  content,
  sources,
  followUps = ["Which flavors sell best in winter", "Compare gelato and soft serve margins"],
  labels,
  loop = false,
  fill = false,
  onDone,
  onFollowUp,
}: {
  content?: StreamingToken[] | string;
  sources?: StreamingSource[];
  followUps?: string[];
  labels?: Partial<{ sources: string; followUps: string }>;
  loop?: boolean;
  fill?: boolean;
  onDone?: () => void;
  onFollowUp?: (text: string, index: number) => void;
}) {
  // Real mode: content is string from SSE (streaming.content) — split per word, no mock timer
  const isRealString = typeof content === "string";
  const tokens: StreamingToken[] = isRealString
    ? (content as string).split(/\s+/).filter(Boolean).map((t) => ({ text: t }))
    : (content as StreamingToken[] | undefined) ?? MOCK_TOKENS;
  const realSources = sources ?? MOCK_SOURCES;

  const l = { sources: "10 sources", followUps: "Follow-ups", ...labels };
  const [count, setCount] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // For real string, count is just tokens.length (show all), no timer
  const done = isRealString ? true : count >= tokens.length;

  // onDone boleh inline (identitas berubah tiap render parent) — jaga agar
  // hanya dipanggil TEPAT SEKALI per pesan (pemicu "Maximum update depth"
  // bila parent setState di dalamnya).
  const doneFiredRef = useRef(false);
  useEffect(() => {
    if (isRealString) {
      // Stream baru selalu mulai dari konten pendek: hitungan menyusut =
      // pesan baru → reset penjaga onDone. Tanpa ini komponen reuse bisa
      // melewatkan onDone untuk pesan berikutnya.
      if (tokens.length < count) doneFiredRef.current = false;
      // Bail-out eksplisit: jangan jadwalkan render bila tak ada perubahan.
      if (count !== tokens.length) setCount(tokens.length);
      if (tokens.length > 0 && !doneFiredRef.current) {
        doneFiredRef.current = true;
        onDone?.();
      }
      return;
    }
    if (done && !loop) {
      onDone?.();
      return;
    }
    const t = setTimeout(() => setCount((c) => (c >= tokens.length ? 0 : c + 1)), done ? HOLD_MS : WORD_MS);
    return () => clearTimeout(t);
  }, [count, done, loop, tokens.length, isRealString, onDone]);

  const displayTokens = isRealString ? tokens : tokens.slice(0, count);

  return (
    <div className={fill ? "w-full" : "min-h-[15.5rem] w-full max-w-95"}>
      <p className="text-[13px] leading-relaxed text-clay-dark">
        {displayTokens.map((token, i) =>
          (token as StreamingToken).cite ? (
            <SourceChip key={i} source={realSources[0]} />
          ) : (
            <span key={i} className="inline">
              {(token as StreamingToken).text}{" "}
            </span>
          )
        )}
        {!done && !isRealString && <span className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-full bg-clay-dark" style={{ animation: "fade-in 150ms ease-out both" }} />}
      </p>
      <div className="mt-2 flex items-center gap-0.5 transition-opacity duration-400" style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}>
        {([0, 1, 2, 3] as const).map((i) => (
          <button key={i} type="button" aria-label="Action" className="flex size-6 items-center justify-center rounded-[6px] text-clay-muted transition-colors hover:bg-clay-beige hover:text-clay-dark">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {i === 0 ? <><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></> : i === 1 ? <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /> : i === 2 ? <path d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z" /> : <path d="M17 14V2M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z" />}
            </svg>
          </button>
        ))}
        <button type="button" aria-expanded={sourcesOpen} onClick={() => setSourcesOpen((c) => !c)} className="ml-1.5 flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 text-left transition-colors hover:bg-clay-beige">
          <span className="flex -space-x-1">
            {realSources.map((s) => (
              <span key={s.domain} className="size-3.5 rounded-full bg-clay-beige border-2 border-white shadow-sm" />
            ))}
          </span>
          <span className="text-[12px] text-clay-muted">{l.sources}</span>
        </button>
      </div>
      <div className="grid transition-[grid-template-rows,opacity] duration-300" style={{ gridTemplateRows: done && sourcesOpen ? "1fr" : "0fr", opacity: done && sourcesOpen ? 1 : 0, transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        <div className="overflow-hidden">
          <div className="mt-1.5 flex flex-col rounded-[10px] bg-clay-beige/40 p-1 shadow-sm">
            {realSources.map((s) => (
              <a key={s.domain} href={s.href} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 text-[12px] text-clay-muted transition-colors hover:bg-clay-beige hover:text-clay-dark">
                <span className="size-4 rounded-[4px] bg-clay-primary/20" />
                <span className="animated-underline">{s.name}</span>
                <span className="ml-auto font-mono text-[10.5px] text-clay-muted">{s.domain}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2.5 transition-opacity duration-400" style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}>
        <p className="text-[12px] font-medium text-clay-muted">{l.followUps}</p>
        <div className="mt-0.5 flex flex-col">
          {followUps.map((text, i) => (
            <button key={text} onClick={() => onFollowUp?.(text, i)} className="-mx-1.5 flex items-center gap-2 rounded-[7px] border-b border-clay-borderLight px-1.5 py-1.5 text-left text-[12.5px] text-clay-dark transition-colors hover:bg-clay-beige/60" style={done ? { animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${i * 90}ms both` } : { opacity: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--clay-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M9 10l-5 5 5 5" /><path d="M20 4v7a4 4 0 0 1-4 4H4" /></svg>
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
