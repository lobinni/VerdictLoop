"use client";

import { Loader2, LogOut, Wallet } from "lucide-react";
import { useState } from "react";
import { CHAIN_ID, CHAIN_NAME } from "@/lib/config";
import { useWallet } from "./WalletProvider";
import { LogoMark } from "./LogoMark";
import { shortAddress } from "./hooks";

const LINKS = [
  { href: "#how", label: "Protocol" },
  { href: "#hub", label: "Market Hub" },
  { href: "#activity", label: "Activity" },
  { href: "#network", label: "Network" },
];

export function SiteNav() {
  const { address, ready, chainOk, error, connect, disconnect, ensureNetwork } = useWallet();
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);

  const onConnect = async () => {
    setBusy(true);
    try {
      await connect();
    } finally {
      setBusy(false);
    }
  };

  const onSwitch = async () => {
    setSwitching(true);
    try {
      await ensureNetwork();
    } catch {
      /* surfaced through the provider's error state */
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="shell sticky top-3 z-50">
      <div className="mt-3 flex items-center gap-3 border border-[var(--line-soft)] bg-[#fbfcf9e8] px-3.5 py-2.5 backdrop-blur-xl">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="inline-flex overflow-hidden rounded-full">
            <LogoMark size={30} />
          </span>
          <span className="text-[15px] font-extrabold tracking-tight">VerdictLoop</span>
        </a>

        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <span className="chip hidden sm:inline-flex">
            <span className="dot" /> {CHAIN_NAME} · {CHAIN_ID}
          </span>
          {ready && address && !chainOk ? (
            <button
              className="btn btn-outline btn-sm !border-[#c45b3e52] !text-[var(--rust)]"
              onClick={() => void onSwitch()}
              disabled={switching}
              title={`Switch MetaMask to ${CHAIN_NAME} (${CHAIN_ID})`}
            >
              {switching ? (
                <Loader2 size={13.5} className="animate-spin" />
              ) : (
                <span className="inline-block h-2 w-2 rounded-full bg-[var(--rust)]" />
              )}
              Wrong network — switch to {CHAIN_ID}
            </button>
          ) : null}
          {ready && address ? (
            <button className="btn btn-night btn-sm" onClick={disconnect} title="Disconnect wallet">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: chainOk ? "var(--mint)" : "var(--rust)" }}
              />
              {shortAddress(address)}
              <LogOut size={13} strokeWidth={2.6} />
            </button>
          ) : (
            <button className="btn btn-mint btn-sm" onClick={onConnect} disabled={busy}>
              {busy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wallet size={14} strokeWidth={2.6} />
              )}
              Connect MetaMask
            </button>
          )}
        </div>
      </div>
      {error ? (
        <p className="mt-2 border border-[#c45b3e42] bg-[#c45b3e12] px-3.5 py-2 text-[12px] font-bold text-[var(--rust)]">
          {error} — connect MetaMask to {CHAIN_NAME} ({CHAIN_ID}) to take part.
        </p>
      ) : null}
    </header>
  );
}
