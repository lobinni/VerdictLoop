"use client";

import { FileLock2, Landmark, Repeat2, ScanSearch } from "lucide-react";
import { useReveal } from "./hooks";

const STEPS = [
  {
    icon: FileLock2,
    step: "Step 01",
    title: "Everything is committed up front",
    body: "The question, the closed list of outcomes, the single page that will carry the result and the reading rule are fixed at creation. Nothing has a setter — a resolver cannot be chosen later because there is no resolver at all.",
  },
  {
    icon: ScanSearch,
    step: "Step 02",
    title: "Validators read one frozen page",
    body: "Each round, validators fetch the committed page and freeze it before judging. Forecasts, running tallies and confident leads are read as “not final yet” — only a result stated as fact counts.",
  },
  {
    icon: Repeat2,
    step: "Step 03",
    title: "One agreement is only a proposal",
    body: "Finality needs several agreeing rounds, each a full interval apart. A page edited to say something for five minutes resolves nothing: a changed reading restarts the count, a vanished result withdraws the proposal.",
  },
  {
    icon: Landmark,
    step: "Step 04",
    title: "Fail-safe, with no one in charge",
    body: "A malformed answer, a model error or a consensus failure voids the round instead of recording it. There is no owner, no admin key and no force button — anyone can run a round, and a dead market expires on schedule.",
  },
];

export function HowItWorks() {
  const ref = useReveal<HTMLElement>();
  return (
    <section id="how" ref={ref} className="shell mt-24 md:mt-32">
      <div className="reveal">
        <p className="kicker">
          <span className="dot" /> The protocol
        </p>
        <h2 className="section-title mt-4">
          Resolution <em>as a loop,</em>
          <br />
          not a verdict.
        </h2>
        <p className="section-sub">
          A single announcer can be wrong, bribed or simply early. VerdictLoop removes the
          announcer: the same question is put to the validators again and again until
          their answers stop moving.
        </p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {STEPS.map((s, i) => (
          <article key={s.step} className="card hoverable reveal p-7 md:p-9" style={{ ["--reveal-delay" as string]: `${i * 90}ms` }}>
            <div className="flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center border border-[#087f7133] bg-[#35d5b414] text-[var(--mint-deep)]">
                <s.icon size={19} strokeWidth={2.2} />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                {s.step}
              </span>
            </div>
            <h3 className="mt-6 text-[19px] font-extrabold tracking-tight">{s.title}</h3>
            <p className="mt-3 text-[13.5px] font-medium leading-relaxed text-[var(--ink-soft)]">
              {s.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
