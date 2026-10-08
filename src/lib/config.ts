/**
 * Central network + contract configuration for the VerdictLoop console.
 *
 * ── How to point the console at a new deployment ───────────────────────────
 * The contract address lives in exactly ONE place. Either:
 *
 *   1. Set the environment variable NEXT_PUBLIC_CONTRACT_ADDRESS (preferred —
 *      nothing in the repository changes), or
 *   2. Edit DEFAULT_CONTRACT_ADDRESS below.
 *
 * Every component, reader, writer, explorer link and wallet switch derives
 * from this file, so a redeploy is a single edit plus a page reload.
 *
 * Current deployment: GenLayer Studio Next (chain 61997), verified
 * byte-identical to contracts/VerdictLoop.py — see deployments/studio-next.json
 * and STUDIO_NEXT_DEPLOY.md.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Network facts — GenLayer Studio Next, the only network this project runs on. */
export const CHAIN_ID = 61997;
export const CHAIN_NAME = "GenLayer Studio Next";
export const RPC_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio-next.genlayer.com/api";
export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_GENLAYER_EXPLORER ||
  "https://explorer-studio-next.genlayer.com";
export const NATIVE_SYMBOL = "GEN";

/** The live VerdictLoop deployment, verified on Studio Next. */
export const DEFAULT_CONTRACT_ADDRESS =
  "0xed11a862889d98042581B8a7104aFABe4941bF70";

/** Resolved contract address — env override first, then the default above. */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  DEFAULT_CONTRACT_ADDRESS) as `0x${string}`;

/** True while the console still points at the placeholder address. */
export const CONTRACT_CONFIGURED =
  CONTRACT_ADDRESS.toLowerCase() !==
  "0x0000000000000000000000000000000000000000";

export const EXPLORER = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;
export const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;

/**
 * Markets committed against the project's original placeholder domain can
 * never resolve — the fixture pages referenced there do not exist. The
 * console filters them out of the hub so the interface only shows resolvable
 * markets. The filter is display-only: those markets stay on chain forever,
 * still appear in the event log, and can be voided via expire() by anyone
 * once their committed expiry passes. Remove an entry to show them again.
 */
export const LEGACY_SOURCE_HOSTS: readonly string[] = ["verdictloop.app"];

/**
 * Where this console is served from. The demo source pages are plain files in
 * public/fixtures, so a deployed console doubles as the tamper-evident source
 * of truth for its demo markets. Default: the production Vercel deployment.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://verdictloop.vercel.app"
).replace(/\/$/, "");

/**
 * Demo source pages live in this console's own public/fixtures folder, so the
 * canonical address is whatever origin is serving the console right now —
 * not a hardcoded domain. demoSources() prefers the browsing origin (works on
 * production domains, preview hosts and tunnel URLs alike), then the
 * NEXT_PUBLIC_FIXTURES_BASE override, then SITE_URL as a last resort. The
 * contract requires https://, so an http:// origin (plain local dev) falls
 * back to SITE_URL.
 */
export const DEMO_FINAL_PATH = "/fixtures/ruling-final.html";
export const DEMO_OPEN_PATH = "/fixtures/ruling-open.html";

export function demoSources(): { final: string; open: string } {
  const base =
    process.env.NEXT_PUBLIC_FIXTURES_BASE ||
    (typeof window !== "undefined" && window.location.protocol === "https:"
      ? window.location.origin
      : SITE_URL);
  return { final: `${base}${DEMO_FINAL_PATH}`, open: `${base}${DEMO_OPEN_PATH}` };
}

export const DEMO_QUESTION =
  "Did Meridian DAO proposal 12 reach its approval threshold?";
export const DEMO_OUTCOMES = "Approved\nDefeated";
export const DEMO_RULE =
  "Resolve only from a final, certified outcome stated after votes stopped being counted. A running tally, a lead or a forecast is not an outcome.";
