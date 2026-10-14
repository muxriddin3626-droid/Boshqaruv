"use client";

import { Component, type ReactNode } from "react";

/** Chizma ramkasi: sarlavha, chizma, izoh. */
export function VisualFrame({ title, caption, children }: { title: string; caption?: ReactNode; children: ReactNode }) {
  return (
    <figure className="not-prose my-3 overflow-hidden rounded-xl border border-neon-cyan/20 bg-black/30" data-testid="visual">
      <figcaption className="border-b border-white/5 px-3 py-1.5 text-[11px] uppercase tracking-widest text-neon-cyan">{title}</figcaption>
      <div className="p-3">{children}</div>
      {caption && <div className="border-t border-white/5 px-3 py-2 text-xs text-gray-300">{caption}</div>}
    </figure>
  );
}

export function VisualPlaceholder() {
  return (
    <div className="not-prose my-3 animate-pulse rounded-xl border border-dashed border-neon-cyan/30 px-3 py-6 text-center text-xs text-gray-400">
      Chizma chizilmoqda...
    </div>
  );
}

export function VisualError({ message, source }: { message: string; source: string }) {
  return (
    <div className="not-prose my-3 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
      Chizmani chizib bo&apos;lmadi: {message}
      <pre className="mt-1 whitespace-pre-wrap text-[10px] text-gray-500">{source}</pre>
    </div>
  );
}

/** Bitta chizmadagi kutilmagan xato butun javobni buzmasin. */
export class VisualBoundary extends Component<{ source: string; children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : "noma'lum xato" };
  }

  render() {
    if (this.state.error) return <VisualError message={this.state.error} source={this.props.source} />;
    return this.props.children;
  }
}
