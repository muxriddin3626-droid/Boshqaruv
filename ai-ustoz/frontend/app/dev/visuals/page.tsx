"use client";

import { notFound } from "next/navigation";

import MarkdownRenderer from "@/components/chat/MarkdownRenderer";

const SAMPLE = `Reaksiya: $$\\ce{2H2 + O2 -> 2H2O}$$ va $\\ce{Fe^3+ + 3OH- -> Fe(OH)3 v}$

\`\`\`smiles
CCO | Etanol
CC(=O)O | Sirka kislota
c1ccccc1 | Benzol
\`\`\`

\`\`\`atom
Fe, Fe3+
\`\`\`

\`\`\`punnett
{"p1": "AaBb", "p2": "AaBb", "traits": {"A": "sariq", "a": "yashil", "B": "silliq", "b": "burishgan"}}
\`\`\`

\`\`\`dna
{"strand": "TACAAACCGATT", "kind": "dna"}
\`\`\`

\`\`\`cell
{"type": "osimlik", "highlight": ["xloroplast"]}
\`\`\`

\`\`\`cell
{"type": "hayvon", "highlight": ["yadrocha"]}
\`\`\`

\`\`\`mermaid
flowchart LR
  A[Glyukoza] --> B[Glikoliz] --> C[Krebs sikli] --> D[ATF]
\`\`\`

\`\`\`punnett
Ab x ab
\`\`\`
`;

/** Faqat dev rejimida: barcha chizma turlarini OpenAI'siz ko'rib chiqish. */
export default function VisualsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-2xl p-4">
      <MarkdownRenderer content={SAMPLE} />
    </main>
  );
}
