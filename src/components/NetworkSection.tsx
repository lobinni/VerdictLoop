"use client";

import { Check, Copy, Droplets, ExternalLink, Plug } from "lucide-react";
import { useState } from "react";
import {
  CHAIN_ID,
  CHAIN_NAME,
  CONTRACT_ADDRESS,
  CONTRACT_CONFIGURED,
  EXPLORER,
  NATIVE_SYMBOL,
  RPC_URL,
} from "@/lib/config";
import { fundWithTestGen } from "@/lib/genlayer";
import { useWallet } from "./WalletProvider";
import { useReveal, shortAddress } from "./hooks";

export function NetworkSection() {
  const ref = useReveal<HTMLElement>();
  const { address, ready } = useWallet();
  const [copied, setCopied] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState("");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const topUp = async () => {
    if (!address) return;
    setFaucetMsg("Requesting…");
    try {
      await fundWithTestGen(address);
      setFaucetMsg(`Test ${NATIVE_SYMBOL} on the way — it lands in a few seconds.`);
    } catch {
      setFaucetMsg(
        "The built-in faucet is unavailable on this network — use the public Studio faucet instead.",
      );
    }
  };

  const rows: Array<[string, string]> = [
    ["Network", CHAIN_NAME],
    ["Chain id", String(CHAIN_ID)],
    ["Native token", NATIVE_SYMBOL],
    ["RPC endpoint", RPC_URL],
  ];

  return (
    <section id="network" ref={ref} className="shell mt-24 md:mt-32 scroll-mt-24">
      <div className="night-panel reveal p-8 md:p-14" style={{ minHeight: 0 }}>
        <div className="relative z-[3] grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div>
            <p className="kicker on-dark">
              <Plug size={14} strokeWidth={2.6} /> One network, one address
            </p>
            <h2 className="mt-4 text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
              Everything lives on
              <br />
              <em className="not-italic text-[var(--mint)]">chain {CHAIN_ID}.</em>
            </h2>
            <p className="mt-4 max-w-[460px] text-[14px] font-medium leading-relaxed text-[#f8fcf9ad]">
              Connect MetaMask to {CHAIN_NAME} and every action below is a real
              transaction: commitments, predictions, rounds and voids. Reads are public
              and wallet-free.
            </p>

            <div className="mt-6 border border-[#f8fcf91f] bg-[#f8fcf908] p-4">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-[#f8fcf98a]">
                Contract address
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <span className="break-all text-[13px] font-extrabold tracking-wide text-[var(--night-ink)]">
                  {CONTRACT_CONFIGURED ? CONTRACT_ADDRESS : "not configured — set your deployment address"}
                </span>
                {CONTRACT_CONFIGURED ? (
                  <>
                    <button className="btn btn-ghost-dark !px-2.5 !py-1.5" onClick={() => void copy()} aria-label="Copy address">
                      {copied ? <Check size={13} className="text-[var(--mint)]" /> : <Copy size={13} />}
                    </button>
                    <a
                      href={EXPLORER}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost-dark !px-2.5 !py-1.5"
                      aria-label="Open in explorer"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="border border-[#f8fcf91f] bg-[#07110e80] p-6 backdrop-blur">
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-[#f8fcf98a]">
              Network facts
            </p>
            <dl className="mt-4 space-y-3">
              {rows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-[#f8fcf912] pb-3 last:border-0 last:pb-0">
                  <dt className="text-[12px] font-bold text-[#f8fcf98a]">{k}</dt>
                  <dd className="text-right text-[12px] font-extrabold text-[var(--night-ink)]">{v}</dd>
                </div>
              ))}
            </dl>
            {ready && address ? (
              <button className="btn btn-mint btn-sm mt-5 w-full" onClick={() => void topUp()}>
                <Droplets size={13.5} strokeWidth={2.6} /> Top up {shortAddress(address)}
              </button>
            ) : (
              <p className="mt-5 text-center text-[11.5px] font-semibold text-[#f8fcf98a]">
                Connect MetaMask to request test {NATIVE_SYMBOL}.
              </p>
            )}
            {faucetMsg ? (
              <p className="mt-2.5 text-center text-[11.5px] font-bold text-[var(--mint)]">{faucetMsg}</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
