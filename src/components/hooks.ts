"use client";

import { useEffect, useRef, useState } from "react";

/** Seconds-precision clock that ticks while the page is visible. */
export function useNow(stepMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), stepMs);
    return () => clearInterval(id);
  }, [stepMs]);
  return now;
}

/**
 * Adds the `in` class when elements scroll into view (staggered by
 * --reveal-delay). Re-scans whenever `deps` change: content that renders AFTER
 * the first mount — market cards arriving from the chain, new activity rows —
 * must be observed too, otherwise reveal-gated elements stay invisible forever.
 */
export function useReveal<T extends HTMLElement>(deps: readonly unknown[] = []) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    el.querySelectorAll(".reveal:not(.in)").forEach((n) => io.observe(n));
    if (el.classList.contains("reveal") && !el.classList.contains("in")) io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

export function shortAddress(value: string | null | undefined, left = 6, right = 4): string {
  if (!value) return "";
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatUtc(epochSeconds: number): string {
  if (!epochSeconds) return "—";
  const d = new Date(epochSeconds * 1000);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "open": return "Open";
    case "proposed": return "Verifying";
    case "resolved": return "Final";
    case "void": return "Void";
    default: return status;
  }
}

export function roundLabel(round: string): string {
  switch (round) {
    case "none": return "No round yet";
    case "source_unreachable": return "Source unreachable";
    case "undetermined": return "Not stated yet";
    case "proposed": return "Outcome proposed";
    case "confirmed": return "Outcome confirmed";
    case "contradicted": return "Reading changed";
    case "resolved": return "Sealed";
    default: return round;
  }
}
