"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
// CSS katex dimuat di komponen ini (bukan global) — hanya halaman yang
// menampilkan math yang mengunduhnya.
import "katex/dist/katex.min.css";
import rehypeKatex from "rehype-katex";
import { normalizeMathDelimiters } from "@/lib/mathText";
import CodeBlock from "@/components/note/CodeBlock";

interface MarkdownViewProps {
  content: string;
  className?: string;
}

/**
 * Render konten jawaban AI (markdown + GFM + math KaTeX).
 * Gaya dibungkus agar konsisten dengan tema clay Eureka.
 */
export default function MarkdownView({ content, className = "" }: MarkdownViewProps) {
  // AI sering menulis rumus dengan \(...\), \[...\], atau \begin{align}...
  // yang tidak dikenali remark-math. Normalisasi dulu agar KaTeX merendernya.
  const normalized = normalizeMathDelimiters(content);
  return (
    <div className={`asisten-md ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
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
            <blockquote {...props} className="my-3 rounded-clay-md border-l-8 border-clay-secondary bg-clay-secondary/10 px-4 py-2.5 text-clay-dark" />
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
            <div className="my-3 overflow-x-auto">
              <table {...props} className="w-full border-collapse text-sm" />
            </div>
          ),
          th: ({ ...props }) => (
            <th {...props} className="border-2 border-clay-shadow/30 bg-clay-beige px-3 py-2 text-left font-extrabold" />
          ),
          td: ({ ...props }) => (
            <td {...props} className="border-2 border-clay-shadow/30 px-3 py-2" />
          ),
          h1: ({ ...props }) => <h1 {...props} className="mb-2 mt-4 text-xl font-extrabold" />,
          h2: ({ ...props }) => <h2 {...props} className="mb-2 mt-4 text-lg font-extrabold" />,
          h3: ({ ...props }) => <h3 {...props} className="mb-1.5 mt-3 text-base font-extrabold" />,
          p: ({ ...props }) => <p {...props} className="my-2 leading-relaxed" />,
          hr: ({ ...props }) => <hr {...props} className="my-4 border-clay-shadow/30" />,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}