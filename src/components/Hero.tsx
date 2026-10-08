"use client";

import { ArrowDown, ShieldCheck, Timer, Vote } from "lucide-react";
import { CHAIN_ID, CHAIN_NAME, CONTRACT_CONFIGURED, EXPLORER } from "@/lib/config";
import type { Stats } from "@/lib/contracts";
import { useNow } from "./hooks";
import { ValidatorGlyph } from "./ValidatorGlyph";

type NodeSpec = {
  top: string;
  left?: string;
  right?: string;
  glyph: 0 | 1 | 2 | 3;
  name: string;
  tag: string;
  delay: number;
  size: number;
  withTag?: boolean;
};

/* Each floating node is a pure-SVG validator dial — no image assets involved. */
const NODES: NodeSpec[] = [
  { top: "9%", left: "6%", glyph: 0, name: "MintSentinel", tag: "round sealed", delay: 0, size: 62, withTag: true },
  { top: "4%", right: "8%", glyph: 1, name: "QuorumApe", tag: "reading source", delay: 0.7, size: 46 },
  { top: "38%", right: "3%", glyph: 2, name: "OwlArbiter", tag: "agrees: outcome 0", delay: 1.4, size: 70, withTag: true },
  { top: "56%", left: "12%", glyph: 3, name: "CircuitJudge", tag: "idle", delay: 2.1, size: 52 },
  { top: "76%", right: "22%", glyph: 0, name: "SecondWatch", tag: "", delay: 1.1, size: 40 },
];

export function Hero({ stats }: { stats: Stats | null }) {
  const now = useNow(30000);
  const hourUtc = new Date(now * 1000).getUTCHours();

  return (
    <section id="top" className="shell">
      <div className="night-panel mt-[22px] min-h-[660px]">
        {/* drifting connector paths behind the nodes */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1200 660"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ zIndex: 1 }}
        >
          <path className="drift-path" d="M60,120 C300,60 420,240 640,190 S980,120 1160,210" />
          <path className="drift-path" d="M120,520 C360,420 520,560 760,470 S1000,420 1150,500" style={{ animationDuration: "34s" }} />
          <path className="drift-path" d="M640,60 C700,220 560,320 660,470 S820,600 760,650" style={{ animationDuration: "42s" }} />
        </svg>
        <div className="orbit-ring" style={{ width: 430, height: 430, top: "8%", right: "-4%" }} aria-hidden="true" />
        <div className="orbit-ring" style={{ width: 240, height: 240, bottom: "12%", left: "-3%", animationDuration: "60s", animationDirection: "reverse" }} aria-hidden="true" />

        {/* floating validator nodes */}
        {NODES.map((n, i) => (
          <div
            key={i}
            className="node hidden md:flex"
            style={{
              top: n.top,
              left: n.left,
              right: n.right,
              animationDelay: `${n.delay}s`,
              ["--node-size" as string]: `${n.size}px`,
            }}
          >
            <span className="node-core" style={{ width: n.size, height: n.size }}>
              <ValidatorGlyph variant={n.glyph} />
            </span>
            {n.withTag ? (
              <span className="node-tag">
                <strong>{n.name}</strong>
                <small>{n.tag}</small>
              </span>
            ) : null}
          </div>
        ))}

        {/* centre content */}
        <div className="relative z-[3] flex min-h-[560px] flex-col items-center justify-center px-6 py-24 text-center">
          <p className="kicker on-dark">
            <ShieldCheck size={14} strokeWidth={2.6} />
            {CHAIN_NAME} · Chain {CHAIN_ID}
          </p>
          <h1 className="headline mt-6">
            Nobody announces
            <br />
            <em>the outcome.</em>
          </h1>
          <p className="mt-6 max-w-[560px] text-[15.5px] font-medium leading-relaxed text-[#f8fcf9ad]">
            VerdictLoop settles prediction markets by making the result a consensus
            question. Independent validator rounds read the one committed source page,
            and only repeated agreement turns an outcome into the final word.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="#hub" className="btn btn-mint">
              <Vote size={15} strokeWidth={2.6} /> Open the Market Hub
            </a>
            <a href="#how" className="btn btn-ghost-dark">
              How rounds work <ArrowDown size={15} strokeWidth={2.6} />
            </a>
          </div>

          <div className="mt-11 flex flex-wrap items-center justify-center gap-2.5">
            <span className="pill-stat">
              <span className="dot" />
              {CONTRACT_CONFIGURED && stats ? stats.markets : "—"} markets live
            </span>
            <span className="pill-stat">
              <span className="dot" style={{ background: "#f0a74b" }} />
              {CONTRACT_CONFIGURED && stats ? stats.rounds : "—"} rounds sealed
            </span>
            <span className="pill-stat">
              <span className="dot" style={{ background: "#8ad8ff" }} />
              {CONTRACT_CONFIGURED && stats ? stats.predictions : "—"} predictions locked
            </span>
          </div>
        </div>

        {/* status strip */}
        <div className="strip relative z-[3]">
          <span>
            <Timer size={13} strokeWidth={2.6} /> Consensus window · {hourUtc}h UTC
          </span>
          <span>One source of truth</span>
          <span>No admin · No resolver</span>
          <span>
            <span className="dot" />
            <a
              href={EXPLORER}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-[var(--mint)]"
            >
              Live network · verified contract
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
