"use client";

import { CHAIN_ID, CHAIN_NAME, CONTRACT_CONFIGURED, EXPLORER } from "@/lib/config";
import { LogoMark } from "./LogoMark";

export function SiteFooter() {
  return (
    <footer className="shell mb-10 mt-24">
      <div className="flex flex-wrap items-center justify-between gap-6 border-t border-[var(--line-soft)] pt-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex overflow-hidden rounded-full">
            <LogoMark size={34} />
          </span>
          <div>
            <p className="text-[14px] font-extrabold tracking-tight">VerdictLoop</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
              {CHAIN_NAME} · Chain {CHAIN_ID}
            </p>
          </div>
        </div>

        <p className="max-w-[440px] text-[12px] font-semibold leading-relaxed text-[var(--ink-soft)]">
          No owner, no admin, no resolver. The only authority is a source page read the
          same way by enough rounds, far enough apart.
        </p>

        <div className="flex items-center gap-2.5">
          <a href="#hub" className="btn btn-outline btn-sm">Market Hub</a>
          {CONTRACT_CONFIGURED ? (
            <a href={EXPLORER} target="_blank" rel="noreferrer" className="btn btn-night btn-sm">
              Verified contract
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
