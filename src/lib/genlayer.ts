import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import type { CalldataEncodable, Hash } from "genlayer-js/types";
import { TransactionStatus } from "genlayer-js/types";
import { EXPLORER_BASE, RPC_URL } from "./config";

export type Address = `0x${string}`;

type EthereumProvider = NonNullable<Parameters<typeof createClient>[0]>["provider"];

/**
 * Studio Next (chain 61997). Built on the SDK's `studioDevnet` definition so the
 * consensus contracts and fee handling match the chain; only the RPC / explorer
 * URLs are overridable through config (see src/lib/config.ts).
 */
export const studioNetwork = {
  ...studioDevnet,
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Studio Explorer", url: EXPLORER_BASE } },
} as typeof studioDevnet;

/**
 * Public RPC endpoints rate-limit by IP. Every read goes through one serialized
 * queue with a minimum spacing, and a rate-limited call backs off and retries
 * instead of surfacing an error to the user.
 */
const MIN_SPACING_MS = 250;
let queue: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimited(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /rate limit|-32429|too many requests/i.test(msg);
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await fn();
      } catch (e) {
        if (attempt >= 4 || !isRateLimited(e)) throw e;
        await sleep(1500 * (attempt + 1));
      }
    }
  }) as Promise<T>;
  queue = run.then(() => sleep(MIN_SPACING_MS)).catch(() => sleep(MIN_SPACING_MS));
  return run;
}

export function getReadClient() {
  return createClient({ chain: studioNetwork });
}

export function getWriteClient(account: Address, provider: EthereumProvider) {
  return createClient({ chain: studioNetwork, account, provider });
}

export async function readContract<T = unknown>(
  address: Address,
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<T> {
  const client = getReadClient();
  return enqueue(() => client.readContract({ address, functionName, args }) as Promise<T>);
}

/**
 * A transaction reaches ACCEPTED first (the leader's result was agreed) and
 * FINALIZED later (the appeal window closed). They are different guarantees, so
 * the caller hears about each stage instead of treating acceptance as completion.
 */
export type TxStage = "accepted" | "finalized";

/**
 * Number of writes currently waiting for acceptance. Background polling pauses
 * while this is non-zero: a signature flow must never lose its RPC budget to a
 * refresh, and a throttled refresh must never blank the UI mid-transaction.
 */
let pendingWrites = 0;
export function hasPendingWrites(): boolean {
  return pendingWrites > 0;
}

/** Retry a side-effect-free RPC call while the endpoint rate-limits it. */
async function withRetries<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= attempts - 1 || !isRateLimited(e)) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
}

/**
 * Sends a write and waits for ACCEPTED. Exactly ONE wallet signature per call.
 *
 * The stages behave differently on purpose:
 *   1. The fee estimate asks the wallet for nothing, so it is retried while
 *      the endpoint rate-limits.
 *   2. The send is attempted exactly ONCE — every writeContract call is a
 *      MetaMask signature prompt, and silently retrying it would show the user
 *      several signature requests for one action. A rate-limited send never
 *      reached the network, so the caller is told to retry explicitly instead.
 *   3. Waiting on a known hash is idempotent and signature-free, so a
 *      rate-limited poll just waits longer — the transaction is untouched.
 */
export async function writeAndWait(
  account: Address,
  provider: unknown,
  address: Address,
  functionName: string,
  args: CalldataEncodable[] = [],
  onStage?: (stage: TxStage, hash: string) => void,
): Promise<string> {
  const client = getWriteClient(account, provider as EthereumProvider);
  pendingWrites += 1;
  let sentHash: Hash;
  try {
    // The studio network enforces the fee system: every tx carries a fee deposit.
    const fees = await withRetries(() => client.estimateTransactionFees({}));

    // One click, one signature — never retried automatically (see note above).
    sentHash = await client.writeContract({
      address,
      functionName,
      args,
      value: BigInt(0),
      fees,
    });

    await withRetries(
      () =>
        client.waitForTransactionReceipt({
          hash: sentHash,
          status: TransactionStatus.ACCEPTED,
          retries: 60,
          interval: 4000,
        }),
      3,
    );
  } finally {
    pendingWrites -= 1;
  }
  onStage?.("accepted", sentHash as string);
  // Finalization is a separate, slower guarantee. The UI keeps showing "accepted"
  // until it lands; a finalization that never arrives is reported rather than assumed.
  void waitForFinalized(sentHash).then((ok) => {
    if (ok) onStage?.("finalized", sentHash);
  });
  return sentHash;
}

/** Poll the transaction until the chain reports FINALIZED. Returns false on timeout. */
export async function waitForFinalized(hash: string, attempts = 70): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      // Through the serialized queue: a finalized-poll must not starve other reads.
      const tx = await rpc<{ status?: string }>("eth_getTransactionByHash", [hash]);
      if (String(tx?.status || "").toUpperCase() === "FINALIZED") return true;
    } catch {
      // transient RPC failure: keep polling
    }
    await sleep(5000);
  }
  return false;
}

export async function getTxStatus(hash: string): Promise<string> {
  const tx = await rpc<{ status?: string }>("eth_getTransactionByHash", [hash]);
  return String(tx?.status || "unknown").toUpperCase();
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  return enqueue(() => rpcOnce<T>(method, params));
}

async function rpcOnce<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || `${method} failed`);
  return body.result as T;
}

/**
 * Studio faucet: tops up the connected wallet with test GEN for transaction fees.
 * Unavailable on networks without the simulator endpoint — callers should treat a
 * failure as "use the public faucet" rather than an error state.
 */
export async function fundWithTestGen(address: Address, gen = 100): Promise<void> {
  // 100 * 1e18 is exactly representable as a JS number; the RPC expects a JSON number.
  await rpc("sim_fundAccount", [address, gen * 1e18]);
}

export async function getNativeBalance(address: Address): Promise<string> {
  const wei = BigInt(await rpc<string>("eth_getBalance", [address, "latest"]));
  return (wei / BigInt(10) ** BigInt(18)).toString();
}

export function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
