"use client";

import "katex/contrib/mhchem";

import katex from "katex";

const ARROW = /\s*((?:<=>|<->|⇄|⇌|->|→|⟶)(?:\[[^\]]*\])*)\s*/;

function tex(text: string): string {
  return katex.renderToString(`\\ce{${text}}`, { throwOnError: false, displayMode: false, trust: false });
}

/**
 * Kimyoviy tenglama (mhchem). \ce{...} butunligicha bo'linmaydigan bitta blok bo'lib chiqadi —
 * shuning uchun har bir modda, "+" va strelka alohida chiziladi: telefonda qator "+" yoki
 * strelkadan keyin o'z-o'zidan keyingi qatorga o'tadi, ekrandan chiqib ketmaydi.
 */
export default function ChemEquation({ text, testId }: { text: string; testId?: string }) {
  const match = text.match(ARROW);
  const sides = match && match.index !== undefined ? [text.slice(0, match.index), text.slice(match.index + match[0].length)] : [text];
  const terms = (side: string) => side.split(/\s+\+\s+/).filter(Boolean);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[16px]" data-testid={testId}>
      {terms(sides[0]).map((term, i) => (
        <span key={`l${i}`} className="flex items-center gap-x-1.5">
          {i > 0 && <span className="text-gray-300">+</span>}
          <span dangerouslySetInnerHTML={{ __html: tex(term) }} />
        </span>
      ))}
      {match && <span className="px-0.5" dangerouslySetInnerHTML={{ __html: tex(match[1]) }} />}
      {sides[1] !== undefined &&
        terms(sides[1]).map((term, i) => (
          <span key={`r${i}`} className="flex items-center gap-x-1.5">
            {i > 0 && <span className="text-gray-300">+</span>}
            <span dangerouslySetInnerHTML={{ __html: tex(term) }} />
          </span>
        ))}
    </div>
  );
}
