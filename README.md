# VerdictLoop

**An outcome nobody is trusted to announce becomes final only after separated
consensus rounds read the same answer on the committed source page.**

---

## Live

| | |
| --- | --- |
| Network | GenLayer Studio Next — chain **61997** |
| Contract | [`0xed11a862889d98042581B8a7104aFABe4941bF70`](https://explorer-studio-next.genlayer.com/address/0xed11a862889d98042581B8a7104aFABe4941bF70) |
| Bytes verified | `scripts/verify_deployment.py` confirms the deployed code is byte-identical to `contracts/VerdictLoop.py` |
| Deploy record | [STUDIO_NEXT_DEPLOY.md](STUDIO_NEXT_DEPLOY.md) — verification notes and the demo transaction log |

Connect MetaMask to Studio Next (chain 61997) to commit markets, predict, run
consensus rounds and void expired markets. Reading the hub needs no wallet at
all. Pointing the console at a different network or address is a single-edit
change — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## The trust problem

A prediction market is only as honest as whoever says how it ended. A single
resolver can be wrong, bribed or simply early; a multisig moves the same problem
to five people; a price-feed oracle cannot read a governance page, a court
docket or a results table at all.

**VerdictLoop makes "what does the source say happened?" a consensus question,
and makes one answer not enough.**

```
create_market(market_id, question, outcomes_json, source_url, resolution_rule,
              predictions_close_in, resolve_in,
              confirmations_required, confirm_interval, expire_in)
      the question, the closed list of outcomes, the ONE page that will carry the result,
      the rule for reading it and every time limit are fixed here. Nothing has a setter.

predict(market_id, outcome_index)   one prediction per address, immutable, refused once
                                    predictions_close_at has passed

resolve(market_id)                  anyone may call it; it takes a market id and nothing else
      refused before the committed opening time, and before a full confirm_interval has
      elapsed since the last accepted round — an early call reverts before the page is fetched
      validators fetch THE COMMITTED PAGE, freeze it under eq_principle.strict_eq and agree on
      one answer: which listed outcome the page states as a final result, or none yet
        not determinable  -> nothing is proposed; an earlier proposal is withdrawn
        outcome k         -> a proposal with 1 confirmation, or +1 if k was already proposed
        a different k     -> the count starts again from 1
        unreachable       -> confirms nothing and overturns nothing
      after confirmations_required agreeing rounds, each a full interval apart: FINAL

expire(market_id)                   anyone, once expires_at has passed without a final result
get_outcome(market_id)              what a consumer reads: {final, outcome_index, outcome_label}
```

### Why it fails the way it does

A final result cannot be undone, so the fail-safe direction is to record
nothing: a malformed model answer, a model error or a consensus failure
**reverts the transaction** — no round is recorded.

| Risk | What stops it |
| --- | --- |
| The resolver announces the wrong result | There is no resolver. `resolve()` takes no outcome, no URL and no rule; all three were fixed at `create_market()`. |
| Resolving before the event | `resolve()` reverts until the committed opening time. Time is the transaction datetime, which GenVM pins so every validator reads the same value. |
| A source page edited to say something for five minutes | One agreeing round is only a proposal. Finality needs `confirmations_required` rounds naming the same outcome, each at least `confirm_interval` seconds after the previous accepted round. A changed reading restarts the count; a vanished result withdraws the proposal. |
| Hammering `resolve()` for quick confirmations | `next_round_at` is stored on chain and moves to *this transaction's time + confirm_interval* after every accepted round. It is elapsed time, not a calendar window, so two calls either side of a clock boundary are one round. |
| A live tally, a lead or a confident forecast read as a result | The verdict logic treats forecasts, polls, partial scores and "expected" as not final, and "not determinable yet" is a normal answer rather than an error. |
| The model returns "1", true, 1.0, a label, or an unlisted index | `strict_index()` accepts only a JSON integer inside the outcome list and `strict_bool()` only JSON true/false. Anything else reverts and no round is recorded. |
| An outage being read as a result, or as a contradiction | An unreachable or empty source confirms nothing and overturns nothing, and still uses up its interval so it cannot be hammered. |
| An administrator voiding or forcing a market | There is none: no owner, no admin, no ownership transfer, no cancel, no force path. The creator has no power once the market exists; the deployer is an ordinary account. |
| A market that can never resolve staying open forever | `expire()` is callable by anyone once the committed expiry has passed, and `create_market()` refuses an expiry that leaves no room for every confirmation round. |
| The page or the creator's own text steering the model | Question, outcome labels, rule and page excerpts are fenced as untrusted data, inner fences are neutralized, and injection phrasing is flagged to the model and stored on the market. |
| Only the top of a long page being read | The whole document is hashed; the model reads a bounded budget from the head plus non-overlapping windows around the market's own words. |
| Consensus quietly degrading | No fallback: if the comparative step cannot run, the transaction reverts. |

## Repository layout

```
contracts/VerdictLoop.py       the intelligent contract (GenLayer Studio, GenVM v0.3)
src/                           the console — Next.js app router
  app/icon.svg                 favicon as text (App Router convention)
  app/opengraph-image.tsx      social card rendered from JSX — no image file
  components/LogoMark.tsx      the mark as pure SVG — zero binary assets in code
  lib/config.ts                ★ the ONLY place the contract address lives
  lib/genlayer.ts              Studio-network client, serialized reads, tx staging
  lib/contracts.ts             typed wrappers over the contract views/writes
  components/                  nav, hero, market hub, creation panel, activity, footer
public/fixtures/               demo source pages (final + still-open)
deployments/studio-next.json   pinned deployment record (chain 61997)
scripts/verdictloop_icons.mjs  regenerates icon PNGs at build time (Node, no deps)
scripts/generate_icons.py      the same generator in Python (stdlib only)
scripts/verify_deployment.py   fails CI if deployed bytes drift from the contract
tests/                         57 tests on a fake GenVM (fake clock, page, model)
docs/DEPLOYMENT.md             deploy + point-the-console-at-it guide
docs/TESTING.md                how to run and extend the suite
STUDIO_NEXT_DEPLOY.md          the live deploy record — every demo transaction
```

## Network

| | |
| --- | --- |
| Network | GenLayer Studio Next |
| Chain id | **61997** |
| Currency | GEN |
| RPC | `https://studio-next.genlayer.com/api` |

Connect MetaMask to chain 61997 to commit markets, predict, run rounds and void
expired markets. Reading the hub needs no wallet at all. After a successful
commitment the console jumps straight to the Market Hub and highlights the new
market while the chain read catches up.

## The console

Next.js + `genlayer-js` + MetaMask. It reads markets, schedules, predictions and
events from chain without a wallet; writes `create_market` / `predict` /
`resolve` / `expire` through MetaMask with the network fee system; disables a
button whose call would revert (`get_schedule` is a free view); and
distinguishes `ACCEPTED` from `FINALIZED` rather than presenting acceptance as
completion.

```bash
npm install
npm run dev       # local console
npm run build     # production build
```

Configuration (single file / single variable): see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Icons are generated by the project
itself, never downloaded and never required in the checkout:

- logo, favicon and hero glyphs are pure SVG/JSX components;
- the social card renders from JSX (`src/app/opengraph-image.tsx`);
- PNG/ICO fallbacks regenerate during every build
  (`scripts/verdictloop_icons.mjs`, Node standard library, ~2s);
- the same generator exists in Python for local art work
  (`python3 scripts/generate_icons.py`).

A deployment pipeline that drops binary assets cannot break this build.

## Tests

```bash
pip install -r requirements-dev.txt
python3 -m pytest -q      # 57 tests
```

The full guide — harness knobs, coverage map, how to add a test — is in
[docs/TESTING.md](docs/TESTING.md). The adversarial half covers malformed model
answers, hurrying and hammering, brief page edits, unreachable sources,
injection on the page and in the creator's own text, long pages, and the
absence of every owner/force/cancel path.

## License

[MIT](LICENSE) © 2026 VerdictLoop contributors
