"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Alias bahasa umum → nama bahasa highlight.js. */
const LANG_ALIAS: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  py: "python",
  md: "markdown",
  html: "xml",
  htm: "xml",
  xml: "xml",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "css",
  sql: "sql",
  txt: "plaintext",
  text: "plaintext",
  plaintext: "plaintext",
};

/** Bahasa yang didaftarkan ke highlight.js (dinamis, hemat bundle). */
const LANGUAGES: { name: string; loader: () => Promise<unknown> }[] = [
  { name: "javascript", loader: () => import("highlight.js/lib/languages/javascript") },
  { name: "typescript", loader: () => import("highlight.js/lib/languages/typescript") },
  { name: "xml", loader: () => import("highlight.js/lib/languages/xml") },
  { name: "css", loader: () => import("highlight.js/lib/languages/css") },
  { name: "bash", loader: () => import("highlight.js/lib/languages/bash") },
  { name: "python", loader: () => import("highlight.js/lib/languages/python") },
  { name: "json", loader: () => import("highlight.js/lib/languages/json") },
  { name: "sql", loader: () => import("highlight.js/lib/languages/sql") },
  { name: "markdown", loader: () => import("highlight.js/lib/languages/markdown") },
  { name: "plaintext", loader: () => import("highlight.js/lib/languages/plaintext") },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface CodeBlockProps {
  /** Isi kode mentah (tanpa fence). */
  code: string;
  /** Label bahasa opsional (mis. "jsx"). */
  language?: string;
  /** Dari ReactMarkdown: className berisi "language-jsx". */
  className?: string;
}

/** Blok kode dengan syntax highlighting + tombol salin. */
export default function CodeBlock({ code, language, className }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const rawLang = (language || className?.match(/language-([\w+-]+)/)?.[1] || "")
    .toLowerCase()
    .trim();
  const hljsLang = LANG_ALIAS[rawLang] ?? rawLang;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hljs = (await import("highlight.js/lib/core")).default;
        for (const { name, loader } of LANGUAGES) {
          if (!hljs.getLanguage(name)) {
            const mod = await loader();
            hljs.registerLanguage(name, (mod as { default: unknown }).default as never);
          }
        }
        const safeLang =
          hljsLang && hljs.getLanguage(hljsLang) ? hljsLang : "plaintext";
        const value =
          safeLang === "plaintext"
            ? escapeHtml(code)
            : hljs.highlight(code, { language: safeLang, ignoreIllegals: true }).value;
        if (!cancelled) setHtml(value);
      } catch {
        if (!cancelled) setHtml(escapeHtml(code));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, hljsLang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard tidak tersedia (http non-https) — abaikan.
    }
  };

  return (
    <div className="eureka-code my-4 overflow-hidden rounded-clay-md border-2 border-clay-shadow/20 bg-[#1B1A2E] shadow-clay-sm">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#23213A] px-3 py-2">
        <span className="truncate text-[11px] font-extrabold uppercase tracking-wider text-[#A9A5C4]">
          {rawLang || "kode"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-clay-full bg-clay-cream/10 px-2.5 py-1 text-[11px] font-extrabold text-white transition-colors hover:bg-white/20"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copied ? "Tersalin!" : "Salin"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed sm:p-4">
        <code
          className="eureka-hljs block min-w-max font-mono text-[#E8E6F0]"
          dangerouslySetInnerHTML={{ __html: html ?? escapeHtml(code) }}
        />
      </pre>
    </div>
  );
}
