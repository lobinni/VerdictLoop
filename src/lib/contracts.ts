import { CONTRACT_ADDRESS, LEGACY_SOURCE_HOSTS } from "./config";
import { type Address, type TxStage, parseJson, readContract, writeAndWait } from "./genlayer";

export type MarketRow = {
  market_id: string;
  creator: string;
  question: string;
  outcomes: string[];
  source_url: string;
  resolution_rule: string;
  created_at: number;
  predictions_close_at: number;
  resolve_at: number;
  expires_at: number;
  confirmations_required: number;
  confirm_interval: number;
  status: string;
  proposed_index: number;
  confirmations: number;
  next_round_at: number;
  last_round_at: number;
  rounds: number;
  last_round: string;
  last_page_hash: string;
  last_detail: string;
  injection_flags: string[];
  final_index: number;
  final_label: string;
  resolved_at: number;
  tally: number[];
};

export type EventRow = { kind: string; [key: string]: unknown };

export type Schedule = {
  market_id: string;
  now: number;
  status: string;
  predictions_close_at: number;
  predictions_open: boolean;
  resolve_at: number;
  next_round_at: number;
  round_open: boolean;
  seconds_until_round: number;
  expires_at: number;
  can_expire: boolean;
  confirmations: number;
  confirmations_required: number;
  confirm_interval: number;
};

export type Prediction = { address: string; outcome: number; at: number; correct?: boolean };

export type Stats = {
  markets: number;
  open: number;
  proposed: number;
  resolved: number;
  void: number;
  predictions: number;
  rounds: number;
};

type OnStage = (stage: TxStage, hash: string) => void;

/**
 * The contract's get_schedule logic, evaluated locally against a market row.
 *
 * Every field it needs is already in the row, so the console derives the
 * schedule instead of spending one RPC call per market per refresh. `now`
 * should be the chain-aligned clock (browser time + the offset sampled from
 * get_schedule), which keeps gating in step with transaction time while the
 * contract itself stays the final authority on what is accepted.
 */
export function deriveSchedule(m: MarketRow, now: number): Schedule {
  const live = m.status === "open" || m.status === "proposed";
  return {
    market_id: m.market_id,
    now,
    status: m.status,
    predictions_close_at: m.predictions_close_at,
    predictions_open: live && now < m.predictions_close_at,
    resolve_at: m.resolve_at,
    next_round_at: m.next_round_at,
    round_open: live && m.next_round_at <= now && now < m.expires_at,
    seconds_until_round: live ? Math.max(0, m.next_round_at - now) : 0,
    expires_at: m.expires_at,
    can_expire: live && now >= m.expires_at,
    confirmations: m.confirmations,
    confirmations_required: m.confirmations_required,
    confirm_interval: m.confirm_interval,
  };
}

/** Hostname of a committed source address ("" when it cannot be parsed). */
export function sourceHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Display filter: markets committed against a known-unreachable placeholder source. */
export function isLegacyMarket(market: MarketRow): boolean {
  const host = sourceHost(market.source_url);
  return host !== "" && LEGACY_SOURCE_HOSTS.includes(host);
}

/** What is accepted right now — read it before paying a fee for a call that would revert. */
export async function getSchedule(marketId: string): Promise<Schedule | null> {
  const raw = await readContract<string>(CONTRACT_ADDRESS, "get_schedule", [marketId]);
  const parsed = parseJson<Schedule & { error?: string }>(raw, {} as Schedule);
  return parsed.market_id ? parsed : null;
}

/**
 * The market registry. THROWS when the endpoint answers with anything that is
 * not a JSON array — a throttled or malformed response must never be mistaken
 * for "the registry is empty", which would blank the whole interface.
 */
export async function listIds(): Promise<string[]> {
  const raw = await readContract<string>(CONTRACT_ADDRESS, "list_ids", []);
  const parsed = parseJson<string[] | null>(raw, null);
  if (!Array.isArray(parsed)) throw new Error("registry read returned no usable list");
  return parsed;
}

export async function getMarket(id: string): Promise<MarketRow | null> {
  const raw = await readContract<string>(CONTRACT_ADDRESS, "get_market", [id]);
  const parsed = parseJson<MarketRow & { error?: string }>(raw, {} as MarketRow);
  return parsed.market_id ? parsed : null;
}

export async function getPredictions(id: string): Promise<Prediction[]> {
  const raw = await readContract<string>(CONTRACT_ADDRESS, "get_predictions", [id]);
  const parsed = parseJson<Prediction[] | { error: string }>(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function getEvents(): Promise<EventRow[]> {
  return parseJson<EventRow[]>(await readContract<string>(CONTRACT_ADDRESS, "get_events", []), []);
}

export async function getStats(): Promise<Stats | null> {
  return parseJson<Stats | null>(
    await readContract<string>(CONTRACT_ADDRESS, "get_stats", []),
    null,
  );
}

export type NewMarket = {
  marketId: string;
  question: string;
  outcomes: string[];
  sourceUrl: string;
  rule: string;
  predictionsCloseIn: string;
  resolveIn: string;
  confirmations: string;
  confirmInterval: string;
  expireIn: string;
};

export async function createMarket(
  account: Address,
  provider: unknown,
  m: NewMarket,
  onStage?: OnStage,
) {
  return writeAndWait(
    account,
    provider,
    CONTRACT_ADDRESS,
    "create_market",
    [
      m.marketId,
      m.question,
      JSON.stringify(m.outcomes),
      m.sourceUrl,
      m.rule,
      m.predictionsCloseIn,
      m.resolveIn,
      m.confirmations,
      m.confirmInterval,
      m.expireIn,
    ],
    onStage,
  );
}

export async function predict(
  account: Address,
  provider: unknown,
  marketId: string,
  outcomeIndex: number,
  onStage?: OnStage,
) {
  return writeAndWait(
    account,
    provider,
    CONTRACT_ADDRESS,
    "predict",
    [marketId, String(outcomeIndex)],
    onStage,
  );
}

export async function runResolutionRound(
  account: Address,
  provider: unknown,
  marketId: string,
  onStage?: OnStage,
) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "resolve", [marketId], onStage);
}

export async function voidMarket(
  account: Address,
  provider: unknown,
  marketId: string,
  onStage?: OnStage,
) {
  return writeAndWait(account, provider, CONTRACT_ADDRESS, "expire", [marketId], onStage);
}
