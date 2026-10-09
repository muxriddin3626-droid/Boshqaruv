"use client";

import "katex/contrib/mhchem";

import katex from "katex";
import { useEffect, useRef, useState } from "react";

import { atomColors, prettyFormula, type ParticleLayout } from "@/lib/visuals/particles";
import { formatNumber, molarMassWorking, type Species } from "@/lib/visuals/reaction";
import type { ReactionSpec, ReactionView } from "@/lib/visuals/reactionView";

import { VisualFrame } from "./VisualFrame";

function Equation({ text, testId }: { text: string; testId?: string }) {
  const html = katex.renderToString(`\\ce{${text}}`, { throwOnError: false, displayMode: true, trust: false });
  // Telefonda kichikroq: KaTeX display satri bo'linmaydi, uzun tenglama ekrandan chiqib ketmasin.
  return <div className="overflow-x-auto text-[13px] sm:text-base" data-testid={testId} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Badge({ children, tone }: { children: string; tone: "cyan" | "amber" | "violet" | "gray" }) {
  const tones = {
    cyan: "border-neon-cyan/40 text-neon-cyan",
    amber: "border-amber-400/40 text-amber-300",
    violet: "border-violet-400/40 text-violet-300",
    gray: "border-white/15 text-gray-300",
  };
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] ${tones[tone]}`}>{children}</span>;
}

function SpeciesCard({ species, name, isProduct }: { species: Species; name?: string; isProduct: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5" data-testid="reaction-species">
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold text-white">
          {species.coefficient !== 1 && <span className="text-neon-cyan">{formatNumber(species.coefficient)}</span>}
          {prettyFormula(species.formula)}
        </span>
        {species.isGas && <span className="text-[10px] text-sky-300">{isProduct ? "gaz ↑" : "gaz"}</span>}
        {species.isPrecipitate && <span className="text-[10px] text-amber-300">cho&apos;kma ↓</span>}
      </div>
      {name && <div className="text-[11px] text-gray-400">{name}</div>}
      {species.molarMass > 0 && (
        <div className="text-[11px] text-gray-500">
          M = {molarMassWorking(species.atoms)} g/mol
        </div>
      )}
    </div>
  );
}

/** Atomlar reaksiyagacha -> keyin ko'chadi; ekranga chiqqanda bir marta o'zi o'ynaydi. */
function Particles({ layout }: { layout: ParticleLayout }) {
  const [after, setAfter] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !played.current) {
        played.current = true;
        timer = window.setTimeout(() => setAfter(true), 900);
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const side = after ? layout.after : layout.before;
  const labelY = layout.height - 8;
  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-widest text-gray-400" data-testid="particles-phase">
          {after ? "Reaksiyadan keyin" : "Reaksiyagacha"}
        </span>
        <button
          type="button"
          onClick={() => setAfter((value) => !value)}
          className="whitespace-nowrap rounded-full border border-neon-cyan/40 px-3 py-1 text-xs text-neon-cyan hover:bg-neon-cyan/10"
          data-testid="particles-toggle"
        >
          {after ? "↺ Qaytadan" : "▶ Boshlash"}
        </button>
      </div>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="mx-auto w-full max-w-md" role="img" aria-label="Atomlarning qayta guruhlanishi" data-testid="particles">
        {side.pluses.map((x) => (
          <text key={`p${x}`} x={x} y={(layout.height - 22) / 2 + 5} textAnchor="middle" fontSize={14} fill="#9ca3af">
            +
          </text>
        ))}
        {layout.atoms.map((atom, i) => {
          const point = after ? atom.after : atom.before;
          const colors = atomColors(atom.element);
          return (
            <g
              key={atom.id}
              className="particle-atom"
              style={{ transform: `translate(${point.x}px, ${point.y}px)`, transition: "transform 1.4s cubic-bezier(.6,.05,.3,1)", transitionDelay: `${(i % 6) * 40}ms` }}
            >
              <circle r={atom.radius} fill={colors.fill} stroke="rgba(0,0,0,0.45)" strokeWidth={0.8} />
              <circle r={atom.radius * 0.35} cx={-atom.radius * 0.35} cy={-atom.radius * 0.35} fill="rgba(255,255,255,0.35)" />
              <text y={atom.radius * 0.36} textAnchor="middle" fontSize={atom.radius * 0.95} fontWeight={700} fill={colors.text}>
                {atom.element}
              </text>
            </g>
          );
        })}
        {side.labels.map((label) => (
          <text key={`l${label.x}${label.text}`} x={label.x} y={labelY} textAnchor="middle" fontSize={11} fill="#e5e7eb">
            {label.text}
          </text>
        ))}
      </svg>
      <p className="text-center text-[11px] text-gray-400">Atomlar yo&apos;qolmaydi va yangidan paydo bo&apos;lmaydi — faqat qayta birikadi. Shuning uchun massa saqlanadi.</p>
    </div>
  );
}

/** Kimyoviy reaksiya: tenglama (tekshirilgan), moddalar, turi, atomlar balansi, zarrachalar va masala yechimi. */
export default function ReactionDiagram({ spec, view }: { spec: ReactionSpec; view: ReactionView }) {
  const nameOf = (formula: string) => spec.names[formula] ?? Object.entries(spec.names).find(([k]) => k.replace(/\s+/g, "") === formula)?.[1];
  const { kind, reaction } = view;
  return (
    <VisualFrame title="Kimyoviy reaksiya">
      <div className="space-y-3" data-testid="reaction">
        {view.status === "corrected" && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-200" data-testid="reaction-corrected">
            Yozilgan tenglama tenglashmagan edi (<span className="font-mono">{view.writtenText}</span>). Ilova koeffitsiyentlarni to&apos;g&apos;riladi:
          </div>
        )}
        <Equation text={view.text} testId="reaction-equation" />
        {view.status === "unbalanced" && (
          <p className="text-xs text-amber-300" data-testid="reaction-unbalanced">
            Diqqat: bu tenglamani tenglashtirib bo&apos;lmadi — moddalarni tekshiring.
          </p>
        )}
        <div className="flex flex-wrap gap-1.5" data-testid="reaction-badges">
          {kind.type && <Badge tone="cyan">{`${kind.type} reaksiyasi`}</Badge>}
          {kind.redox && <Badge tone="violet">Oksidlanish-qaytarilish</Badge>}
          {kind.ionic && <Badge tone="gray">Ionli tenglama</Badge>}
          {reaction.reversible && <Badge tone="gray">Qaytar reaksiya ⇄</Badge>}
          {view.status === "balanced" && <Badge tone="gray">Tenglashtirilgan ✓</Badge>}
        </div>

        {/* Telefonda: reagentlar, pastga strelka, mahsulotlar; kengroq ekranda — yonma-yon. */}
        <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">
            {reaction.reactants.map((species) => (
              <SpeciesCard key={species.formula} species={species} name={nameOf(species.formula)} isProduct={false} />
            ))}
          </div>
          <div className="text-center text-lg text-neon-cyan">
            <span className="sm:hidden">{reaction.reversible ? "⇅" : "↓"}</span>
            <span className="hidden sm:inline">{reaction.reversible ? "⇄" : "→"}</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-1">
            {reaction.products.map((species) => (
              <SpeciesCard key={species.formula} species={species} name={nameOf(species.formula)} isProduct />
            ))}
          </div>
        </div>

        {view.particles && <Particles layout={view.particles} />}

        <div>
          <div className="mb-1 text-[11px] uppercase tracking-widest text-gray-400">Atomlar soni</div>
          <div className="flex flex-wrap gap-1.5" data-testid="reaction-balance">
            {view.table.map((row) => {
              const ok = Math.abs(row.left - row.right) < 1e-9;
              return (
                <span key={row.element} className={`rounded-md px-2 py-0.5 text-xs ${ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
                  {row.element}: {formatNumber(row.left)} = {formatNumber(row.right)} {ok ? "✓" : "✗"}
                </span>
              );
            })}
          </div>
        </div>

        {view.stoich && (
          <div className="space-y-2" data-testid="reaction-stoich">
            <div className="text-[11px] uppercase tracking-widest text-gray-400">Masala yechimi</div>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-200">
              {view.stoich.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-400">
                  <tr>
                    <th className="py-1 text-left font-normal">Modda</th>
                    <th className="whitespace-nowrap py-1 pl-2 text-right font-normal">n, mol</th>
                    <th className="whitespace-nowrap py-1 pl-2 text-right font-normal">m, g</th>
                    <th className="whitespace-nowrap py-1 pl-2 text-right font-normal">V, l</th>
                  </tr>
                </thead>
                <tbody>
                  {view.stoich.rows.map((row) => (
                    <tr key={row.formula} className={`border-t border-white/5 ${row.formula === view.stoich!.limiting ? "text-neon-cyan" : "text-gray-200"}`}>
                      <td className="py-1">
                        {prettyFormula(row.formula)}
                        {row.given && <span className="text-gray-500"> (berilgan)</span>}
                        {row.excessMol > 1e-9 && <span className="text-amber-300"> +{formatNumber(row.excessMol)} mol ortiqcha</span>}
                      </td>
                      <td className="py-1 pl-2 text-right">{formatNumber(row.mol)}</td>
                      <td className="py-1 pl-2 text-right">{row.molarMass ? formatNumber(row.mass) : "—"}</td>
                      <td className="py-1 pl-2 text-right">{row.volume !== null ? formatNumber(row.volume) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-500">Gaz hajmi normal sharoitda (22,4 l/mol). Atom massalari DTMdagidek yaxlitlangan (masalan, Cl = 35,5; Cu = 64).</p>
          </div>
        )}
        {view.stoichError && <p className="text-xs text-amber-300">{view.stoichError}</p>}
      </div>
    </VisualFrame>
  );
}
