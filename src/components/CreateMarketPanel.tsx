"use client";

import { CircleHelp, FileCheck2, Plus, ShieldCheck, Trash2, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DEMO_OUTCOMES,
  DEMO_QUESTION,
  DEMO_RULE,
  demoSources,
} from "@/lib/config";
import { createMarket } from "@/lib/contracts";
import { useWallet } from "./WalletProvider";
import { IDLE_TX, TxNotice, friendlyError, type TxState } from "./TxNotice";

const HOUR = 3600;
const DAY = 24 * HOUR;

const DURATION_CLOSE = [
  { label: "in 1 hour", value: String(1 * HOUR) },
  { label: "in 6 hours", value: String(6 * HOUR) },
  { label: "in 1 day", value: String(1 * DAY) },
  { label: "in 3 days", value: String(3 * DAY) },
];
const DURATION_RESOLVE = [
  { label: "in 2 hours", value: String(2 * HOUR) },
  { label: "in 12 hours", value: String(12 * HOUR) },
  { label: "in 1 day", value: String(1 * DAY) },
  { label: "in 3 days", value: String(3 * DAY) },
  { label: "in 7 days", value: String(7 * DAY) },
];
const DURATION_INTERVAL = [
  { label: "every 30 minutes", value: String(30 * 60) },
  { label: "every 1 hour", value: String(1 * HOUR) },
  { label: "every 6 hours", value: String(6 * HOUR) },
  { label: "every 1 day", value: String(1 * DAY) },
];
const EXPIRY = [
  { label: "after 7 days", value: String(7 * DAY) },
  { label: "after 14 days", value: String(14 * DAY) },
  { label: "after 30 days", value: String(30 * DAY) },
];

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called with the new market id the moment the commitment is ACCEPTED. */
  onCreated: (marketId: string) => void;
};

export function CreateMarketPanel({ open, onClose, onCreated }: Props) {
  const { address, provider, ready, connect, ensureNetwork } = useWallet();
  const [marketId, setMarketId] = useState("");
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState<string[]>(["", ""]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [rule, setRule] = useState("");
  const [closeIn, setCloseIn] = useState(DURATION_CLOSE[0].value);
  const [resolveIn, setResolveIn] = useState(DURATION_RESOLVE[0].value);
  const [interval, setInterval_] = useState(DURATION_INTERVAL[1].value);
  const [required, setRequired] = useState("2");
  const [expireIn, setExpireIn] = useState(EXPIRY[0].value);
  const [tx, setTx] = useState<TxState>(IDLE_TX);

  useEffect(() => {
    if (open) setTx(IDLE_TX);
  }, [open]);

  const problems = useMemo(() => {
    const issues: string[] = [];
    const cleanOutcomes = outcomes.map((o) => o.trim()).filter(Boolean);
    if (!/^[a-zA-Z0-9\-_.\/]{1,64}$/.test(marketId.trim()))
      issues.push("Market id needs 1–64 characters: letters, digits, dashes, underscores, dots or slashes.");
    if (question.trim().length < 8) issues.push("The question is too short.");
    if (cleanOutcomes.length < 2) issues.push("List at least two outcomes.");
    if (new Set(cleanOutcomes.map((o) => o.toLowerCase())).size !== cleanOutcomes.length)
      issues.push("Outcome labels must be distinct.");
    if (!/^https:\/\/[^\s<>"']+$/.test(sourceUrl.trim()))
      issues.push("The source must be a single https:// address with no spaces.");
    if (rule.trim().length < 12) issues.push("Describe how the page should be read.");
    if (Number(closeIn) > Number(resolveIn))
      issues.push("Predictions must close no later than resolution opens.");
    if (Number(expireIn) < Number(resolveIn) + Number(required) * Number(interval))
      issues.push("Expiry must leave room for every confirmation round.");
    return issues;
  }, [marketId, question, outcomes, sourceUrl, rule, closeIn, resolveIn, interval, required, expireIn]);

  const valid = problems.length === 0;

  const fillDemo = (kind: "final" | "open") => {
    const sources = demoSources(); // this deployment's own fixture pages
    setMarketId(`meridian-dao-12-${kind}${Math.floor(Math.random() * 900 + 100)}`);
    setQuestion(DEMO_QUESTION);
    setOutcomes(DEMO_OUTCOMES.split("\n"));
    setSourceUrl(kind === "final" ? sources.final : sources.open);
    setRule(DEMO_RULE);
  };

  const resetForm = () => {
    setMarketId("");
    setQuestion("");
    setOutcomes(["", ""]);
    setSourceUrl("");
    setRule("");
    setCloseIn(DURATION_CLOSE[0].value);
    setResolveIn(DURATION_RESOLVE[0].value);
    setInterval_(DURATION_INTERVAL[1].value);
    setRequired("2");
    setExpireIn(EXPIRY[0].value);
    setTx(IDLE_TX);
  };

  const submit = async () => {
    if (!valid) return;
    if (!ready || !address || !provider) {
      await connect();
      return;
    }
    setTx({ phase: "submitting", label: "Market committed" });
    try {
      // No signature leaves the wallet until it sits on chain 61997.
      await ensureNetwork();
      await createMarket(
        address,
        provider,
        {
          marketId: marketId.trim(),
          question: question.trim(),
          outcomes: outcomes.map((o) => o.trim()).filter(Boolean),
          sourceUrl: sourceUrl.trim(),
          rule: rule.trim(),
          predictionsCloseIn: closeIn,
          resolveIn,
          confirmations: required,
          confirmInterval: interval,
          expireIn,
        },
        (stage, hash) => {
          setTx({ phase: stage, label: "Market committed", hash });
          if (stage === "accepted") {
            // The hub takes it from here: close, scroll to the grid and light
            // the new card up as the read catches the commitment.
            onCreated(marketId.trim());
            resetForm();
          }
        },
      );
    } catch (e) {
      setTx({ phase: "error", message: friendlyError(e) });
    }
  };

  if (!open) return null;

  const busy = tx.phase === "submitting";

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-end bg-[#07110e66] backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-[520px] overflow-y-auto border-l border-[var(--line-soft)] bg-[var(--paper)] p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kicker">
              <span className="dot" /> New market
            </p>
            <h3 className="mt-2 text-[24px] font-extrabold tracking-tight">Commit a question</h3>
            <p className="mt-1.5 text-[12.5px] font-semibold leading-relaxed text-[var(--ink-soft)]">
              Every field below is frozen on chain the moment the market is accepted.
              Nothing can be edited afterwards — not by you, not by anyone.
            </p>
          </div>
          <button className="btn btn-outline btn-sm !px-2.5" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="mt-5 border border-[var(--line-soft)] bg-[var(--paper-2)] px-3.5 py-3">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
            Demo preset — tap to auto-fill
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button type="button" className="demo-preset" onClick={() => fillDemo("final")}>
              <FileCheck2 size={16} className="shrink-0 text-[var(--mint-deep)]" />
              <span>
                <strong>Certified result</strong>
                <small>source page already final</small>
              </span>
            </button>
            <button type="button" className="demo-preset" onClick={() => fillDemo("open")}>
              <TrendingUp size={16} className="shrink-0 text-[var(--amber)]" />
              <span>
                <strong>Live tally</strong>
                <small>leading, not decided yet</small>
              </span>
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <div className="field">
            <label>Market id</label>
            <input value={marketId} onChange={(e) => setMarketId(e.target.value)} placeholder="meridian-dao-12" maxLength={64} />
            <p className="hint">A permanent identifier — letters, digits and - _ / . only.</p>
          </div>

          <div className="field">
            <label>Question</label>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={300} placeholder="Did Meridian DAO proposal 12 reach its approval threshold?" />
          </div>

          <div className="field">
            <label>Outcomes (2–6, closed list)</label>
            <div className="space-y-2">
              {outcomes.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={o}
                    maxLength={80}
                    placeholder={`Outcome ${i + 1}`}
                    onChange={(e) =>
                      setOutcomes((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))
                    }
                  />
                  <button
                    className="btn btn-outline !px-2.5"
                    aria-label="Remove outcome"
                    disabled={outcomes.length <= 2}
                    onClick={() => setOutcomes((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn btn-outline btn-sm mt-2"
              disabled={outcomes.length >= 6}
              onClick={() => setOutcomes((prev) => [...prev, ""])}
            >
              <Plus size={13} /> Add outcome
            </button>
          </div>

          <div className="field">
            <label>The one source page</label>
            <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
            <p className="hint">
              The single page validators will read every round — it must stay publicly
              reachable for the market's whole life. The demo presets point at the
              fixture pages served by this very deployment.
            </p>
          </div>

          <div className="field">
            <label>Reading rule</label>
            <textarea value={rule} onChange={(e) => setRule(e.target.value)} rows={3} maxLength={400} placeholder="Resolve only from a final, certified outcome stated after counting closed…" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label>Predictions close</label>
              <select value={closeIn} onChange={(e) => setCloseIn(e.target.value)}>
                {DURATION_CLOSE.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Resolution opens</label>
              <select value={resolveIn} onChange={(e) => setResolveIn(e.target.value)}>
                {DURATION_RESOLVE.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Agreeing rounds</label>
              <select value={required} onChange={(e) => setRequired(e.target.value)}>
                {["1", "2", "3", "4", "5"].map((n) => (
                  <option key={n} value={n}>{n} round{n === "1" ? "" : "s"}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Round interval</label>
              <select value={interval} onChange={(e) => setInterval_(e.target.value)}>
                {DURATION_INTERVAL.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="field col-span-2">
              <label>Expiry</label>
              <select value={expireIn} onChange={(e) => setExpireIn(e.target.value)}>
                {EXPIRY.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {problems.length > 0 ? (
          <div className="mt-5 border border-[var(--line-soft)] bg-[var(--paper-2)] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
              <CircleHelp size={12} /> Before this can be committed
            </p>
            <ul className="mt-1.5 list-disc pl-4 text-[12px] font-semibold leading-relaxed text-[var(--ink-soft)]">
              {problems.slice(0, 3).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <button className="btn btn-mint mt-6 w-full" disabled={!valid || busy} onClick={() => void submit()}>
          {busy ? <span className="spinner" /> : null}
          {ready ? "Commit market on chain" : "Connect MetaMask to commit"}
        </button>
        <p className="mt-2.5 text-center text-[11px] font-semibold text-[var(--ink-faint)]">
          Exactly one signature per commit — the console never asks you to sign twice.
        </p>

        <div className="mt-3 flex items-start gap-2 border border-[#087f7133] bg-[#35d5b40d] px-3 py-2.5">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--mint-deep)]" />
          <p className="text-[11px] font-semibold leading-relaxed text-[var(--ink-soft)]">
            MetaMask may show a security banner for a contract it has never seen before.
            That is its automated screening, not a verdict: this console only calls
            commit/predict/round/void on the pinned contract shown in the network
            panel — compare the address with the explorer record before confirming.
          </p>
        </div>

        <TxNotice tx={tx} />
        <p className="mt-3 text-[11px] font-semibold leading-relaxed text-[var(--ink-faint)]">
          The moment the commitment is accepted you are taken back to the Market Hub,
          where the new market is highlighted and tracked.
        </p>
      </div>
    </div>
  );
}
