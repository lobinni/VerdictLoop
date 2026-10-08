"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CONTRACT_CONFIGURED } from "@/lib/config";
import { hasPendingWrites } from "@/lib/genlayer";
import {
  getEvents,
  getMarket,
  getPredictions,
  getSchedule,
  getStats,
  isLegacyMarket,
  listIds,
  type EventRow,
  type MarketRow,
  type Prediction,
  type Stats,
} from "@/lib/contracts";
import { ActivityFeed } from "./ActivityFeed";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { MarketHub } from "./MarketHub";
import { NetworkSection } from "./NetworkSection";
import { SiteFooter } from "./SiteFooter";
import { SiteNav } from "./SiteNav";

const POLL_MS = 30_000;

/**
 * The console shell and the single owner of chain state.
 *
 * Three rules keep the interface stable on a public, rate-limited endpoint:
 *
 *   1. A failed read NEVER erases known data. The registry read throws rather
 *      than returning an empty list, and a per-market read that fails keeps
 *      the row already on screen. Markets only disappear when a successful
 *      registry read says they are gone.
 *   2. refresh(true) always performs a FRESH read. A plain refresh may join an
 *      in-flight one, but a write-triggered refresh must never be answered by
 *      a read that started before the transaction landed.
 *   3. Background polling pauses while a signature is in flight, so a write
 *      never competes with the poller for the endpoint's rate budget.
 */
export function VerdictLoopApp() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction[]>>({});
  const [clockOffset, setClockOffset] = useState(0);
  const [loading, setLoading] = useState(CONTRACT_CONFIGURED);
  const [loadError, setLoadError] = useState("");

  // Mirrors of the latest state, readable inside the read routine without
  // making it depend on (and restart with) every render.
  const marketsRef = useRef<MarketRow[]>([]);
  const predictionsRef = useRef<Record<string, Prediction[]>>({});
  const statsRef = useRef<Stats | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const queued = useRef<Promise<void> | null>(null);

  const runRead = useCallback(async () => {
    try {
      const ids = await listIds(); // throws on an unusable response
      const known = new Map(marketsRef.current.map((m) => [m.market_id, m]));

      const rows: MarketRow[] = [];
      for (const id of ids) {
        try {
          const row = await getMarket(id);
          // A transient miss keeps whatever the hub already shows.
          rows.push(row ?? known.get(id) ?? null!);
        } catch {
          const fallback = known.get(id);
          if (fallback) rows.push(fallback);
        }
      }
      const resolvedRows = rows.filter(Boolean);
      resolvedRows.sort((a, b) => b.created_at - a.created_at);

      // Display filter: markets pinned to a source that can never be read.
      const visible = resolvedRows.filter((row) => !isLegacyMarket(row));

      // One schedule read per refresh (not per market) purely to align the
      // clock with transaction time; every card derives its own schedule.
      if (visible[0]) {
        try {
          const probe = await getSchedule(visible[0].market_id);
          if (probe?.now) setClockOffset(probe.now - Math.floor(Date.now() / 1000));
        } catch {
          // keep the previous offset
        }
      }

      const nextPredictions: Record<string, Prediction[]> = {};
      for (const row of visible) {
        try {
          nextPredictions[row.market_id] = await getPredictions(row.market_id);
        } catch {
          nextPredictions[row.market_id] = predictionsRef.current[row.market_id] ?? [];
        }
      }

      let chainStats: Stats | null = statsRef.current;
      try {
        chainStats = (await getStats()) ?? chainStats;
      } catch {
        // keep the previous stats
      }

      // Counts shown to the user must match what the hub actually lists.
      let displayStats: Stats | null = null;
      if (chainStats) {
        const counts = { open: 0, proposed: 0, resolved: 0, void: 0 };
        let predictionCount = 0;
        for (const row of visible) {
          const status = row.status as keyof typeof counts;
          if (status in counts) counts[status] += 1;
          predictionCount += row.tally.reduce((a, b) => a + b, 0);
        }
        displayStats = {
          ...chainStats,
          markets: visible.length,
          ...counts,
          predictions: predictionCount,
        };
      }

      marketsRef.current = visible;
      predictionsRef.current = nextPredictions;
      statsRef.current = chainStats;
      setMarkets(visible);
      setPredictions(nextPredictions);
      setStats(displayStats);
      setLoadError("");

      try {
        setEvents(await getEvents());
      } catch {
        // the log is informational: keep the previous entries
      }
    } catch (e) {
      // Reads failed as a whole — report it, but leave the interface intact.
      setLoadError(
        e instanceof Error && /rate limit|too many requests|-32429/i.test(e.message)
          ? "The endpoint is rate-limiting reads — showing the last known state."
          : "Could not reach the contract — showing the last known state.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * @param force fetch fresh data even if a read is already running (used
   *              after every write, where stale data is wrong by definition).
   */
  const refresh = useCallback(
    (force = false): Promise<void> => {
      if (!CONTRACT_CONFIGURED) return Promise.resolve();
      if (!force && typeof document !== "undefined" && document.hidden) {
        return Promise.resolve();
      }

      const start = (): Promise<void> => {
        const p = runRead().finally(() => {
          if (inFlight.current === p) inFlight.current = null;
        });
        inFlight.current = p;
        return p;
      };

      if (!inFlight.current) return start();
      if (!force) return inFlight.current;
      if (queued.current) return queued.current;

      const chained = inFlight.current
        .catch(() => undefined)
        .then(() => {
          queued.current = null;
          return start();
        });
      queued.current = chained;
      return chained;
    },
    [runRead],
  );

  useEffect(() => {
    void refresh(true);
    const id = setInterval(() => {
      // Never poll on top of a signature flow or in a hidden tab.
      if (hasPendingWrites()) return;
      void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden && !hasPendingWrites()) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return (
    <div className="pb-6">
      <SiteNav />
      <main>
        <Hero stats={stats} />
        <HowItWorks />
        <MarketHub
          markets={markets}
          predictions={predictions}
          clockOffset={clockOffset}
          loading={loading}
          loadError={loadError}
          refresh={refresh}
        />
        <ActivityFeed events={events} />
        <NetworkSection />
      </main>
      <SiteFooter />
    </div>
  );
}
