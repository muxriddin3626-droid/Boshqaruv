/** ```reaksiya``` bloki uchun hamma hisob bir joyda: tenglama tekshiruvi, to'g'rilash, turi, stexiometriya, zarrachalar. */
import { particleLayout, particleProblem, type ParticleLayout } from "./particles";
import {
  autoBalance,
  balanceTable,
  classify,
  equationText,
  isBalanced,
  parseEquation,
  stoichiometry,
  withCoefficients,
  type BalanceRow,
  type Reaction,
  type ReactionKind,
  type Stoichiometry,
} from "./reaction";

export interface ReactionSpec {
  equation: string;
  /** Moddalarning o'zbekcha nomlari: {"Zn": "rux", "HCl": "xlorid kislota"}. */
  names: Record<string, string>;
  /** Masala sharti: {"Zn": "13 g"} — qolgan moddalar miqdori hisoblanadi. */
  given: Record<string, string>;
}

export interface ReactionView {
  /** AI yozgan (tekshirilgan) tenglama. */
  writtenText: string;
  /** Hisob uchun ishlatiladigan tenglama: yozilgani to'g'ri bo'lsa — o'zi, aks holda to'g'rilangani. */
  reaction: Reaction;
  text: string;
  status: "balanced" | "corrected" | "unbalanced";
  kind: ReactionKind;
  table: BalanceRow[];
  stoich: Stoichiometry | null;
  stoichError: string | null;
  particles: ParticleLayout | null;
}

export function analyzeReaction(spec: ReactionSpec): ReactionView {
  const written = parseEquation(spec.equation);
  let reaction = written;
  let status: ReactionView["status"] = "balanced";
  if (!isBalanced(written)) {
    const coefficients = autoBalance(written);
    if (coefficients) {
      reaction = withCoefficients(written, coefficients);
      status = "corrected";
    } else status = "unbalanced";
  }
  let stoich: Stoichiometry | null = null;
  let stoichError: string | null = null;
  if (Object.keys(spec.given).length) {
    if (status === "unbalanced") stoichError = "Tenglama tenglashmagani uchun masala hisoblanmadi.";
    else {
      try {
        stoich = stoichiometry(reaction, spec.given);
      } catch (err) {
        stoichError = err instanceof Error ? err.message : "Masalani hisoblab bo'lmadi.";
      }
    }
  }
  return {
    writtenText: equationText(written),
    reaction,
    text: equationText(reaction),
    status,
    kind: classify(reaction),
    table: balanceTable(reaction),
    stoich,
    stoichError,
    particles: status !== "unbalanced" && !particleProblem(reaction) ? particleLayout(reaction) : null,
  };
}
