"use client";

import "katex/contrib/mhchem";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { VISUAL_LANGUAGES } from "@/lib/visuals/blocks";

import VisualBlock from "../visuals/VisualBlock";

interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

/** ```lang``` blokining tili va matni (chizma bo'lsa), aks holda null. */
function visualBlockOf(pre: HastNode | undefined): { language: string; source: string } | null {
  const code = pre?.children?.find((child) => child.type === "element" && child.tagName === "code");
  const classes = Array.isArray(code?.properties?.className) ? (code?.properties?.className as string[]) : [];
  const language = classes.find((name) => name.startsWith("language-"))?.slice("language-".length);
  if (!code || !language || !VISUAL_LANGUAGES.has(language)) return null;
  return { language, source: textOf(code) };
}

/**
 * AI Ustoz javoblarini render qiladi:
 * - $...$ / $$...$$ — formulalar (KaTeX), $\ce{2H2 + O2 -> 2H2O}$ — reaksiyalar (mhchem);
 * - ```mermaid```, ```smiles```, ```atom```, ```punnett```, ```dna```, ```cell```, ```rasm``` — chizmalar;
 * - qolgan kod bloklari oddiy monospace.
 * `isStreaming` — javob hali kelayotgan bo'lsa chala chizma bloklari chizilmaydi.
 */
export default function MarkdownRenderer({ content, isStreaming = false }: { content: string; isStreaming?: boolean }) {
  return (
    <div className="prose prose-invert max-w-none prose-p:my-2 prose-headings:my-3">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre({ node, children, ...props }) {
            const visual = visualBlockOf(node as HastNode | undefined);
            if (visual) return <VisualBlock language={visual.language} source={visual.source} isStreaming={isStreaming} />;
            return <pre {...props}>{children}</pre>;
          },
          code({ className, children, ...props }) {
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
