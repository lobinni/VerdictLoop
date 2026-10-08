"use client";

import { CheckCircle2, LayoutGrid, Loader2, Plus, Radar, RefreshCw } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { CHAIN_NAME, CONTRACT_CONFIGURED, CONTRACT_ADDRESS } from "@/lib/config";
import { getMarket } from "@/lib/contracts";
import type { MarketRow, Prediction } from "@/lib/contracts";
import { useReveal } from "./hooks";
import { MarketCard } from "./MarketCard";
import { CreateMarketPanel } from "./CreateMarketPanel";

type Props = {
  markets: MarketRow[];
  predictions: Record<string, Prediction[]>;
  /** Chain time minus browser time, in seconds — keeps gating in step. */
  clockOffset: number;
  loading: boolean;
  loadError: string;
  refresh: (force?: boolean) => void;
};

export function MarketHub({
  markets,
  predictions,
  clockOffset,
  loading,
  loadError,
  refresh,
}: Props) {
  // Cards mount only after the first chain read — re-scan the reveal observer
  // whenever the market count changes so every new card actually appears.
  const ref = useReveal<HTMLElement>([markets.length]);
  const [creating, setCreating] = useState(false);
  const [committedId, setCommittedId] = useState<string | null>(null);
  const clearTimer = useRef<number | null>(null);
  const liveCount = markets.filter((m) => m.status === "open" || m.status === "proposed").length;

  /** A market was just committed: close the drawer, jump to the hub and light it up. */
  const handleCreated = useCallback(
    (id: string) => {
      setCreating(false);
      setCommittedId(id);
      void refresh(true);
      // Trailing catches: chain reads right after ACCEPTED can lag behind the tx.
      window.setTimeout(() => void refresh(true), 4000);
      window.setTimeout(() => void refresh(true), 12000);
      requestAnimationFrame(() => {
        document.getElementById("hub")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      // Dedicated visibility poll: the moment the commitment becomes readable,
      // pull the full hub state so the new card renders as early as possible.
      void (async () => {
        for (let i = 0; i < 24; i += 1) {
          try {
            const row = await getMarket(id);
            if (row) break;
          } catch {
            // endpoint is throttling — keep waiting politely
          }
          await new Promise((r) => setTimeout(r, 2500));
        }
        void refresh(true);
      })();
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      clearTimer.current = window.setTimeout(() => setCommittedId(null), 15000);
    },
    [refresh],
  );

  return (
    <section id="hub" ref={ref} className="shell mt-24 md:mt-32 scroll-mt-24">
      <div className="reveal flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="kicker">
            <span className="dot" /> Resolution control · {markets.length} tracked · {liveCount} live
          </p>
          <h2 className="section-title mt-4">
            Market <em>Hub</em>
          </h2>
          <p className="section-sub">
            Back an outcome while predictions are open, run consensus rounds once the
            window opens, and watch repeated agreement seal the final word.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {committedId ? (
            <span className="stage-badge stage-accepted">
              <CheckCircle2 size={12} />
              {committedId} committed — tracking below
            </span>
          ) : null}
          <button className="btn btn-outline btn-sm" onClick={() => refresh(true)} disabled={loading}>
            {loading ? <Loader2 size={13.5} className="animate-spin" /> : <RefreshCw size={13.5} strokeWidth={2.6} />}
            Refresh
          </button>
          <button className="btn btn-mint btn-sm" onClick={() => setCreating(true)}>
            <Plus size={13.5} strokeWidth={2.8} /> Commit a market
          </button>
        </div>
      </div>

      {!CONTRACT_CONFIGURED ? (
        <div className="card reveal mt-10 p-8 md:p-10">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#f0a74b52] bg-[#f5e7ad42] text-[#936800]">
              <Radar size={19} strokeWidth={2.2} />
            </span>
            <div>
              <h3 className="text-[18px] font-extrabold tracking-tight">
                The hub is waiting for its contract address
              </h3>
              <p className="mt-2 max-w-[640px] text-[13.5px] font-medium leading-relaxed text-[var(--ink-soft)]">
                This console reads every market straight from the chain, but it has not
                been pointed at a deployment yet. Deploy the contract to the Studio
                network, then set the address in the single configuration file
                (or the NEXT_PUBLIC_CONTRACT_ADDRESS environment variable) and reload —
                creation, predictions, rounds and expiry switch on immediately. Current
                placeholder: {CONTRACT_ADDRESS}.
              </p>
            </div>
          </div>
        </div>
      ) : loadError ? (
        <div className="card reveal mt-10 p-8">
          <p className="text-[13.5px] font-bold text-[var(--rust)]">{loadError}</p>
          <p className="mt-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)]">
            Reads are retried automatically — the public endpoint occasionally rate-limits.
          </p>
        </div>
      ) : loading && markets.length === 0 ? (
        <div className="card reveal mt-10 flex items-center justify-center gap-3 p-14 text-[13px] font-bold text-[var(--ink-soft)]">
          <Loader2 size={16} className="animate-spin" /> Reading markets from the chain…
        </div>
      ) : markets.length === 0 ? (
        <div className="card reveal mt-10 p-10 text-center">
          <LayoutGrid size={22} className="mx-auto text-[var(--ink-faint)]" />
          <h3 className="mt-3 text-[17px] font-extrabold">No markets yet</h3>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] font-medium leading-relaxed text-[var(--ink-soft)]">
            The first commitment sets everything in motion. Connect MetaMask on
            {" "}{CHAIN_NAME} and pin a question to a single source page.
          </p>
          <button className="btn btn-mint btn-sm mt-5" onClick={() => setCreating(true)}>
            <Plus size={13.5} strokeWidth={2.8} /> Commit the first market
          </button>
        </div>
      ) : (
        <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {markets.map((m, i) => (
            <MarketCard
              key={m.market_id}
              market={m}
              predictions={predictions[m.market_id] ?? []}
              clockOffset={clockOffset}
              onChanged={() => refresh(true)}
              delayMs={(i % 3) * 90}
              highlight={committedId === m.market_id}
            />
          ))}
        </div>
      )}

      <CreateMarketPanel open={creating} onClose={() => setCreating(false)} onCreated={handleCreated} />
    </section>
  );
}
