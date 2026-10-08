"use client";

import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { txUrl } from "@/lib/config";

export type TxState =
  | { phase: "idle" }
  | { phase: "submitting"; label: string }
  | { phase: "accepted"; label: string; hash: string }
  | { phase: "finalized"; label: string; hash: string }
  | { phase: "error"; message: string };

export const IDLE_TX: TxState = { phase: "idle" };

export function TxNotice({ tx }: { tx: TxState }) {
  if (tx.phase === "idle") return null;

  if (tx.phase === "submitting") {
    return (
      <p className="mt-3 flex items-center gap-2 border border-[var(--line-soft)] bg-[var(--paper)] px-3 py-2.5 text-[12px] font-bold text-[var(--ink-soft)]">
        <Loader2 size={13} className="animate-spin" />
        {tx.label} — waiting for the consensus to accept it…
      </p>
    );
  }

  if (tx.phase === "error") {
    return (
      <p className="mt-3 flex items-start gap-2 border border-[#c45b3e42] bg-[#c45b3e12] px-3 py-2.5 text-[12px] font-bold leading-snug text-[var(--rust)]">
        <CircleAlert size={13} className="mt-0.5 shrink-0" />
        {tx.message}
      </p>
    );
  }

  const final = tx.phase === "finalized";
  return (
    <p
      className={`mt-3 flex items-center gap-2 px-3 py-2.5 text-[12px] font-bold ${
        final
          ? "border border-[#087f7140] bg-[#35d5b41c] text-[var(--mint-deep)]"
          : "border border-[#f0a74b52] bg-[#f5e7ad55] text-[#936800]"
      }`}
    >
      <CheckCircle2 size={13} />
      {tx.label} {final ? "finalized" : "accepted — finalizing in the background"}.
      <a
        href={txUrl(tx.hash)}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:opacity-80"
      >
        View transaction
      </a>
    </p>
  );
}

export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/rate.?limit|too many requests|-32429/i.test(raw)) {
    return (
      "The Studio Next endpoint is rate-limiting this connection. Nothing was committed — " +
      "wait 15–30 seconds and try again."
    );
  }
  if (/not on .*chain|switch networks/i.test(raw)) {
    return raw.length > 220 ? `${raw.slice(0, 217)}…` : raw;
  }
  if (/user rejected|user denied|ACTION_REJECTED/i.test(raw)) {
    return "The request was cancelled in MetaMask — nothing was committed.";
  }
  if (/insufficient funds|not enough|below the minimum/i.test(raw)) {
    return "Not enough GEN for the network fee — top up from the faucet below, then retry.";
  }
  const cleaned = raw.replace(/^.*reverted[^:]*:?\s*/i, "").trim();
  const text = cleaned || raw;
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}
