"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import MermaidDiagram from "./MermaidDiagram";

/**
 * AI Ustoz javoblarini render qiladi:
 * - $...$ va $$...$$ ichidagi kimyoviy formulalar KaTeX bilan chiziladi.
 * - ```mermaid``` bloklari Krebs sikli/Mendel katagi kabi diagrammalarga aylanadi.
 * - Qolgan kod bloklari oddiy monospace ko'rinishda chiqadi.
 */
export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-p:my-2 prose-headings:my-3">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const isMermaid = className === "language-mermaid";
            if (isMermaid) {
              return <MermaidDiagram chart={String(children).trim()} />;
            }
            return (
              <code className={`${className ?? ""} rounded bg-black/40 px-1.5 py-0.5`} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
