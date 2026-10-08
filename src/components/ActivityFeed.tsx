"use client";

import {
  BadgeCheck,
  CircleSlash,
  FilePlus2,
  Ghost,
  Repeat2,
  TriangleAlert,
  Vote,
} from "lucide-react";
import type { ReactNode } from "react";
import type { EventRow } from "@/lib/contracts";
import { useReveal } from "./hooks";

function iconFor(kind: string): ReactNode {
  const cls = "shrink-0";
  switch (kind) {
    case "Created": return <FilePlus2 size={15} className={cls} />;
    case "Predicted": return <Vote size={15} className={cls} />;
    case "Round": return <Repeat2 size={15} className={cls} />;
    case "Resolved": return <BadgeCheck size={15} className={cls} />;
    case "Undetermined": return <TriangleAlert size={15} className={cls} />;
    case "SourceUnreachable": return <Ghost size={15} className={cls} />;
    case "Voided": return <CircleSlash size={15} className={cls} />;
    default: return <Repeat2 size={15} className={cls} />;
  }
}

function describe(ev: EventRow): string {
  const id = String(ev.id ?? "market");
  switch (ev.kind) {
    case "Created":
      return `${id} committed — ${String(ev.outcomes ?? "?")} outcomes, ${String(ev.confirmations_required)} agreeing round(s) every ${Math.round(Number(ev.confirm_interval ?? 3600) / 60)}min.`;
    case "Predicted":
      return `A prediction was locked on “${id}”, outcome ${String(ev.outcome)}.`;
    case "Round":
      return `Round ${String(ev.round)} on “${id}”: ${String(ev.result ?? "").replace(/_/g, " ")} — ${String(ev.confirmations)}/${String(ev.confirmations_required)} agreeing.`;
    case "Resolved":
      return `“${id}” is final: “${String(ev.label)}” after ${String(ev.confirmations)} agreeing round(s).`;
    case "Undetermined":
      return `Round ${String(ev.round)} on “${id}” read no final result${Number(ev.withdrew ?? -1) >= 0 ? " — the earlier proposal was withdrawn" : ""}.`;
    case "SourceUnreachable":
      return `Round ${String(ev.round)} on “${id}” found the source unreadable — nothing changed.`;
    case "Voided":
      return `“${id}” expired without a final result and was voided.`;
    default:
      return `${ev.kind} on “${id}”.`;
  }
}

export function ActivityFeed({ events }: { events: EventRow[] }) {
  const ref = useReveal<HTMLElement>([events.length]);
  const rows = [...events].reverse().slice(0, 14);

  return (
    <section id="activity" ref={ref} className="shell mt-24 md:mt-32 scroll-mt-24">
      <div className="reveal">
        <p className="kicker">
          <span className="dot" style={{ background: "#f0a74b" }} /> On-chain record
        </p>
        <h2 className="section-title mt-4">
          Activity <em>log</em>
        </h2>
        <p className="section-sub">
          Every commitment, prediction, round and verdict — straight from the contract
          storage, newest first.
        </p>
      </div>

      <div className="card reveal mt-10 overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-[13px] font-semibold text-[var(--ink-soft)]">
            Nothing on the record yet — the first market will write the opening line.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line-soft)]">
            {rows.map((ev, i) => (
              <li
                key={`${String(ev.kind)}-${i}`}
                className="flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-[#35d5b40a] md:px-7"
              >
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center border border-[#087f7133] bg-[#35d5b414] text-[var(--mint-deep)]">
                  {iconFor(String(ev.kind))}
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold leading-relaxed text-[var(--ink)]">
                    {describe(ev)}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-faint)]">
                    {String(ev.kind)}
                    {ev.at ? ` · ${new Date(Number(ev.at) * 1000).toUTCString().slice(5, 22)} UTC` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
