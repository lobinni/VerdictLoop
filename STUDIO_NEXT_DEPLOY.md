# Studio Next deployment record

Everything about the live deployment of `contracts/VerdictLoop.py` on the
GenLayer Studio Next network.

| | |
| --- | --- |
| Network | GenLayer Studio Next |
| Chain id | 61997 |
| RPC | `https://studio-next.genlayer.com/api` |
| Explorer | `https://explorer-studio-next.genlayer.com` |
| Contract address | [`0xed11a862889d98042581B8a7104aFABe4941bF70`](https://explorer-studio-next.genlayer.com/address/0xed11a862889d98042581B8a7104aFABe4941bF70) |
| Canonical code | `contracts/VerdictLoop.py` |
| Bytes verified | ✔ `python3 scripts/verify_deployment.py` — deployed code is byte-identical to the repository file |

> The console reads its address from exactly one place: `src/lib/config.ts`
> (or the `NEXT_PUBLIC_CONTRACT_ADDRESS` environment variable). A redeploy
> touches that value and `deployments/studio-next.json` — nothing else in the
> codebase carries it.

---

## 1. Verification status

Checked against the live network after deployment:

- `gen_getContractCode` at the address returns source that is byte-identical
  (after line-ending normalization) to `contracts/VerdictLoop.py` — the script
  in `scripts/verify_deployment.py` reproduces this check and fails CI on drift.
- View calls answer with the exact shapes the console consumes:
  `list_ids` → `[]`, `get_admin` → `""` (no owner, as designed),
  `get_stats` → an all-zero registry.

## 2. Redeploying

1. Open the **GenLayer Studio** IDE connected to Studio Next (chain 61997).
2. Create a new intelligent contract file and paste the full contents of
   `contracts/VerdictLoop.py` (keep the two header comment lines — the first
   pins the GenVM version, the second declares the SDK dependency).
3. Deploy with an ordinary account. The constructor takes no arguments and
   grants the deployer **no** privileges: there is no owner, admin or upgrade path.
4. Update:
   - `deployments/studio-next.json` → `address`
   - `src/lib/config.ts` → `DEFAULT_CONTRACT_ADDRESS`, **or** set
     `NEXT_PUBLIC_CONTRACT_ADDRESS` at build time (preferred — the repository
     then never changes).
5. Run `python3 scripts/verify_deployment.py` and refresh the demo log below.

## 3. Demo plan (run against the deployed contract)

The demo uses two source pages committed to this repository's `public/fixtures`
folder, so every edit is a public commit:

- `ruling-final.html` — a certified outcome stated as a fact that already happened.
- `ruling-open.html` — voting still open with a leading side, a percentage and a
  confident forecast. It looks like an answer and is not one; validators read it
  as *not determinable yet*.

The console's demo presets fill the source field with **this deployment's own
origin** (`{origin}/fixtures/ruling-*.html`), so the pages stay reachable from
whatever domain serves the console — validators can always fetch them. If a
deployment cannot host `public/fixtures`, set `NEXT_PUBLIC_FIXTURES_BASE` to a
public mirror (for example the repository's raw file host).

> Legacy note: markets committed before this change point at the project's
> initial placeholder domain, which serves no fixtures (the site URL is now
> `https://verdictloop.vercel.app`). They permanently read as
> *source unreachable* (by protocol design — an unreachable page confirms
> nothing and overturns nothing) and can be voided with `expire()` once their
> committed expiry passes. The console omits them from the hub display via the
> `LEGACY_SOURCE_HOSTS` filter in `src/lib/config.ts` — they remain on chain
> permanently. Fresh demo markets committed from the console point at the
> serving deployment.

Suggested timings for a live demo: predictions close in 1 hour, resolution opens
in 2 hours, 2 agreeing rounds every 30 minutes, expiry after 7 days.

### Transaction log

Keep this table honest — every transaction of the demo, including the refused
ones, belongs here.

| # | Action | Market | Result | Transaction |
| --- | --- | --- | --- | --- |
| 1 | `create_market` (open page) | `meridian-dao-12-open` | accepted | _pending_ |
| 2 | `resolve` before opening time | `meridian-dao-12-open` | **refused** — round not accepted yet | _pending_ |
| 3 | `predict` outcome 0 | `meridian-dao-12-open` | accepted | _pending_ |
| 4 | round 1 on undecided page | `meridian-dao-12-open` | accepted — undetermined, nothing proposed | _pending_ |
| 5 | `create_market` (final page) | `meridian-dao-12-final` | accepted | _pending_ |
| 6 | round 1 (validators agree: outcome 0) | `meridian-dao-12-final` | accepted — proposed, 1/2 | _pending_ |
| 7 | round 2 inside the interval | `meridian-dao-12-final` | **refused** — too early, no fetch | _pending_ |
| 8 | round 2 after the interval | `meridian-dao-12-final` | accepted — **final: Approved** | _pending_ |
| 9 | `expire` a live market | `meridian-dao-12-final` | **refused** — already closed | _pending_ |

## 4. What a redeploy changes — and what it does not

A redeploy produces a **new address and an empty registry**: markets, predictions,
rounds and events do not migrate. That is by design — the commit log on an old
deployment is immutable history. After redeploying:

1. Update the two places listed at the top (console config + `deployments/`).
2. Re-run `scripts/verify_deployment.py`.
3. Recreate any demo markets you still need.
