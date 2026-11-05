"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
// CSS katex dimuat di komponen ini (bukan global) — hanya halaman yang
// menampilkan math yang mengunduhnya.
import "katex/dist/katex.min.css";
import rehypeKatex from "rehype-katex";
import { normalizeMathDelimiters } from "@/lib/mathText";
import CodeBlock from "@/components/note/CodeBlock";
import { causalChainSteps, remarkAnswerLineBreaks, remarkTextTimelines } from "@/lib/assistant/answerFormatting";
import "./answer-content.css";

interface MarkdownViewProps {
  content: string;
  className?: string;
}

/**
 * Render konten jawaban AI (markdown + GFM + math KaTeX).
 * Gaya dibungkus agar konsisten dengan tema clay Eureka.
 */
// Memo: konten pesan selesai tidak berubah — lewati re-parse markdown/KaTeX
// saat state streaming memicu re-render halaman berkali-kali per detik.
function MarkdownView({ content, className = "" }: MarkdownViewProps) {
  // AI sering menulis rumus dengan \(...\), \[...\], atau \begin{align}...
  // yang tidak dikenali remark-math. Normalisasi dulu agar KaTeX merendernya.
  const normalized = normalizeMathDelimiters(content);
  return (
    <div className={`asisten-md ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkAnswerLineBreaks, remarkTextTimelines]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="font-bold text-clay-primary underline underline-offset-2" />
          ),
          ul: ({ ...props }) => (
            <ul {...props} className="my-2 list-disc space-y-1 pl-5" />
          ),
          ol: ({ ...props }) => (
            <ol {...props} className="my-2 list-decimal space-y-1 pl-5" />
          ),
          li: ({ ...props }) => <li {...props} className="leading-relaxed" />,
          blockquote: ({ ...props }) => (
            <blockquote {...props} className="answer-quote" />
          ),
          code: ({ className: codeClass, children, ...props }) => {
            const isBlock = /language-/.test(codeClass ?? "");
            if (isBlock) {
              return (
                <CodeBlock
                  code={String(children ?? "").replace(/\n$/, "")}
                  className={codeClass}
                />
              );
            }
            return (
              <code
                className="rounded-clay-md bg-clay-inputBg px-1.5 py-0.5 text-[13.5px] font-bold text-clay-primary"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ ...props }) => (
            <div className="answer-table-wrap" tabIndex={0} role="region" aria-label="Tabel jawaban">
              <table {...props} className="answer-table" />
            </div>
          ),
          th: ({ ...props }) => (
            <th {...props} scope="col" />
          ),
          td: ({ ...props }) => (
            <td {...props} />
          ),
          h1: ({ ...props }) => <h1 {...props} className="mb-2 mt-4 text-xl font-extrabold" />,
          h2: ({ ...props }) => <h2 {...props} className="mb-2 mt-4 text-lg font-extrabold" />,
          h3: ({ ...props }) => <h3 {...props} className="mb-1.5 mt-3 text-base font-extrabold" />,
          p: ({ node, children, ...props }) => {
            // Only plain text chains are promoted: preserve formulas, links and rich markdown.
            const plain = node?.children.every((child) => child.type === "text");
            const text = plain ? node?.children.map((child) => "value" in child ? child.value : "").join("") : "";
            const steps = text ? causalChainSteps(text) : null;
            if (!steps) return <p {...props} className="my-2 leading-relaxed">{children}</p>;
            return (
              <figure className="answer-flow">
                <figcaption>Alur sebab-akibat</figcaption>
                <ol>
                  {steps.map((step, index) => (
                    <li key={index}>
                      <span className="answer-flow-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </figure>
            );
          },
          hr: ({ ...props }) => <hr {...props} className="my-4 border-clay-shadow/30" />,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownView);
