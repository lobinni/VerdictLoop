"use client";

import {
  AlarmClock,
  BadgeCheck,
  CalendarClock,
  CircleSlash,
  ExternalLink,
  Hourglass,
  Play,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CHAIN_ID, CHAIN_NAME } from "@/lib/config";
import type { MarketRow, Prediction } from "@/lib/contracts";
import { deriveSchedule, predict, runResolutionRound, voidMarket } from "@/lib/contracts";
import { useWallet } from "./WalletProvider";
import { formatCountdown, formatUtc, roundLabel, shortAddress, statusLabel, useNow } from "./hooks";
import { IDLE_TX, TxNotice, friendlyError, type TxState } from "./TxNotice";

type Props = {
  market: MarketRow;
  predictions: Prediction[];
  /** Chain time minus browser time, in seconds. */
  clockOffset: number;
  onChanged: () => void;
  delayMs: number;
  /** Set briefly right after this market's commitment is accepted. */
  highlight?: boolean;
};

export function MarketCard({
  market,
  predictions,
  clockOffset,
  onChanged,
  delayMs,
  highlight = false,
}: Props) {
  const { address, provider, ready, ensureNetwork } = useWallet();
  const localNow = useNow();
  // Chain-aligned clock: the schedule is recomputed every tick, so windows
  // open and close on screen exactly when the contract starts accepting them.
  const now = localNow + clockOffset;
  const schedule = useMemo(() => deriveSchedule(market, now), [market, now]);
  const [tx, setTx] = useState<TxState>(IDLE_TX);
  const [action, setAction] = useState<string | null>(null);

  // Where does the committed source actually live — and is it a demo fixture
  // pointing at a different site (e.g. committed from another deployment)?
  const source = useMemo(() => {
    try {
      return { url: new URL(market.source_url), ok: true };
    } catch {
      return { url: null, ok: false };
    }
  }, [market.source_url]);
  const fixtureMismatch = Boolean(
    source.ok &&
      source.url &&
      source.url.pathname.startsWith("/fixtures/") &&
      typeof window !== "undefined" &&
      source.url.host !== window.location.host,
  );

  const total = market.tally.reduce((a, b) => a + b, 0);
  const mine = address
    ? predictions.find((p) => p.address.toLowerCase() === address.toLowerCase())
    : undefined;
  const final = market.status === "resolved";
  const live = market.status === "open" || market.status === "proposed";
  const canPredict = Boolean(ready && live && schedule.predictions_open && !mine);
  const canResolve = Boolean(ready && live && schedule.round_open);
  const canVoid = Boolean(ready && live && schedule.can_expire);
  const waitSeconds = schedule.seconds_until_round;

  async function run(kind: "predict" | "resolve" | "void", outcomeIndex?: number) {
    if (!address || !provider) return;
    setAction(kind);
    setTx({ phase: "submitting", label: labelFor(kind) });
    try {
      // No signature leaves the wallet until it sits on chain 61997.
      await ensureNetwork();
      const stageHandler = (stage: "accepted" | "finalized", hash: string) => {
        setTx({ phase: stage, label: labelFor(kind), hash });
        if (stage === "accepted") onChanged();
      };
      if (kind === "predict") {
        await predict(address, provider, market.market_id, outcomeIndex ?? 0, stageHandler);
      } else if (kind === "resolve") {
        await runResolutionRound(address, provider, market.market_id, stageHandler);
      } else {
        await voidMarket(address, provider, market.market_id, stageHandler);
      }
    } catch (e) {
      setTx({ phase: "error", message: friendlyError(e) });
    } finally {
      setAction(null);
    }
  }

  function labelFor(kind: string) {
    if (kind === "predict") return "Prediction locked in";
    if (kind === "resolve") return "Consensus round complete";
    return "Market voided";
  }

  return (
    <article
      className={`card reveal flex flex-col p-6 md:p-7 ${highlight ? "is-new" : ""}`}
      style={{ ["--reveal-delay" as string]: `${delayMs}ms` }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className={`chip is-${market.status}`}>{statusLabel(market.status)}</span>
          {highlight ? (
            <span className="stage-badge stage-finalized">just committed</span>
          ) : null}
        </span>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
          {market.market_id}
        </span>
      </div>

      <h3 className="mt-4 text-[17px] font-extrabold leading-snug tracking-tight">
        {market.question}
      </h3>
      <a
        href={market.source_url}
        target="_blank"
        rel="noreferrer"
        className="mt-1.5 inline-flex w-fit items-center gap-1.5 text-[12px] font-bold text-[var(--mint-deep)] hover:underline underline-offset-2"
      >
        Source page
        {source.ok && source.url ? (
          <span className="font-semibold text-[var(--ink-faint)]">· {source.url.host}</span>
        ) : null}
        <ExternalLink size={11.5} strokeWidth={2.6} />
      </a>
      {fixtureMismatch ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-semibold leading-snug text-[var(--rust)]">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          This market's demo source lives on another domain ({source.url?.host}) — rounds
          will read it as unreachable and the market will expire on schedule. New demo
          markets point at this site automatically.
        </p>
      ) : null}

      {/* outcome board */}
      <div className="mt-5 space-y-2.5">
        {market.outcomes.map((label, i) => {
          const count = market.tally[i] ?? 0;
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          const picked = mine?.outcome === i;
          const won = final && market.final_index === i;
          return (
            <div
              key={label}
              className={`border px-3.5 py-3 transition-colors ${
                won
                  ? "border-[var(--mint)] bg-[#35d5b41c]"
                  : picked
                    ? "border-[#087f7152] bg-[#35d5b40f]"
                    : "border-[var(--line-soft)] bg-[var(--paper)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] font-extrabold">
                  {label}
                  {won ? <BadgeCheck size={14} className="text-[var(--mint-deep)]" /> : null}
                  {picked && !final ? (
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--mint-deep)]">
                      your pick
                    </span>
                  ) : null}
                </span>
                <span className="text-[11.5px] font-extrabold text-[var(--ink-soft)]">
                  {count} · {share}%
                </span>
              </div>
              <div className="tally-track mt-2.5">
                <div className="tally-fill" style={{ width: `${Math.max(share, count > 0 ? 6 : 0)}%` }} />
              </div>
              {canPredict ? (
                <button
                  className="btn btn-outline btn-sm mt-3 w-full"
                  disabled={action !== null}
                  onClick={() => void run("predict", i)}
                >
                  {action === "predict" ? <span className="spinner" /> : null}
                  Back {label}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {mine && !final ? (
        <p className="mt-3 text-[12px] font-bold text-[var(--ink-soft)]">
          You backed “{market.outcomes[mine.outcome]}”. Predictions are immutable — the
          source page decides.
        </p>
      ) : null}
      {mine && final ? (
        <p
          className={`mt-3 text-[12px] font-extrabold ${
            mine.outcome === market.final_index ? "text-[var(--mint-deep)]" : "text-[var(--rust)]"
          }`}
        >
          {mine.outcome === market.final_index
            ? `Correct — the final outcome is “${market.final_label}”.`
            : `Missed — the final outcome is “${market.final_label}”.`}
        </p>
      ) : null}

      {/* consensus state */}
      <div className="mt-5 border border-[var(--line-soft)] bg-[var(--paper)] px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-[var(--ink-soft)]">
            Consensus
          </span>
          <span className="text-[11.5px] font-extrabold text-[var(--ink)]">
            {final
              ? `sealed after ${market.confirmations} agreeing round${market.confirmations === 1 ? "" : "s"}`
              : `${market.confirmations} / ${market.confirmations_required} agreeing rounds`}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          {Array.from({ length: market.confirmations_required }).map((_, i) => (
            <span
              key={i}
              className="h-2 flex-1"
              style={{
                background:
                  i < market.confirmations
                    ? "linear-gradient(90deg, var(--mint-deep), var(--mint))"
                    : "#0b12100f",
              }}
            />
          ))}
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-semibold leading-snug text-[var(--ink-soft)]">
          <Hourglass size={11.5} className="shrink-0" />
          {final
            ? `Final: “${market.final_label}” at ${formatUtc(market.resolved_at)}.`
            : market.status === "void"
              ? "Expired without a final result — every prediction is off."
              : `Round ${market.rounds}: ${roundLabel(market.last_round)}. ${market.last_detail || ""}`}
        </p>
      </div>

      {/* schedule */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px] font-bold text-[var(--ink-soft)]">
        <span className="flex items-center gap-1.5">
          <CalendarClock size={12} className="shrink-0 text-[var(--mint-deep)]" />
          {schedule.round_open
            ? "Round window open"
            : final || market.status === "void"
              ? `Closed ${formatUtc(market.expires_at)}`
              : `Next round in ${formatCountdown(waitSeconds)}`}
        </span>
        <span className="flex items-center gap-1.5">
          <AlarmClock size={12} className="shrink-0 text-[var(--amber)]" />
          {schedule.predictions_open
            ? `Predictions close ${formatUtc(market.predictions_close_at)}`
            : "Predictions closed"}
        </span>
      </div>

      {/* actions */}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--line-soft)] pt-4">
        <button
          className="btn btn-night btn-sm"
          disabled={!canResolve || action !== null}
          onClick={() => void run("resolve")}
          title={
            !ready
              ? `Connect MetaMask on ${CHAIN_NAME} (${CHAIN_ID})`
              : !schedule.round_open
                ? "A round is not accepted yet"
                : "Run one consensus round on the committed source"
          }
        >
          {action === "resolve" ? <span className="spinner" /> : <Play size={13} strokeWidth={2.8} />}
          Run a round
        </button>
        <button
          className="btn btn-outline btn-sm"
          disabled={!canVoid || action !== null}
          onClick={() => void run("void")}
          title={
            !ready
              ? `Connect MetaMask on ${CHAIN_NAME} (${CHAIN_ID})`
              : !schedule.can_expire
                ? "Available once the committed expiry passes"
                : "Void a market that never reached finality"
          }
        >
          {action === "void" ? <span className="spinner" /> : <CircleSlash size={13} strokeWidth={2.6} />}
          Void
        </button>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink-faint)]">
          <Users size={12} /> {total} prediction{total === 1 ? "" : "s"}
          {market.creator ? <> · by {shortAddress(market.creator)}</> : null}
        </span>
      </div>

      {!ready && live ? (
        <p className="mt-3 text-[11.5px] font-semibold text-[var(--ink-faint)]">
          Connect MetaMask on {CHAIN_NAME} ({CHAIN_ID}) to predict, run rounds or void.
        </p>
      ) : null}

      <TxNotice tx={tx} />
    </article>
  );
}
