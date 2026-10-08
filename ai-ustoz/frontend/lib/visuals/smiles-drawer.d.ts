// smiles-drawer o'z tur e'lonlarisiz keladi — faqat ishlatiladigan qismi.
declare module "smiles-drawer" {
  interface ParseTree {
    readonly __parseTree: unique symbol;
  }

  class SvgDrawer {
    constructor(options?: Record<string, unknown>);
    draw(tree: ParseTree, target: SVGElement, themeName?: "light" | "dark"): SVGElement;
    getMolecularFormula(): string;
  }

  const SmilesDrawer: {
    SvgDrawer: typeof SvgDrawer;
    parse(smiles: string, onSuccess: (tree: ParseTree) => void, onError: (error: unknown) => void): void;
  };
  export default SmilesDrawer;
}
