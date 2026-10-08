# Deployment & configuration guide

How the live deployment is wired and how to redeploy or swap the address —
always with a single-edit configuration.

## 1. Current deployment

| | |
| --- | --- |
| Network | GenLayer Studio Next |
| Chain id | 61997 |
| RPC | `https://studio-next.genlayer.com/api` |
| Contract | `0xed11a862889d98042581B8a7104aFABe4941bF70` |
| Explorer | `https://explorer-studio-next.genlayer.com/address/0xed11a862889d98042581B8a7104aFABe4941bF70` |
| Bytes verified | ✔ byte-identical to `contracts/VerdictLoop.py` |

The full record lives in `deployments/studio-next.json`, the human log in
`STUDIO_NEXT_DEPLOY.md`.

## 2. Where configuration lives

Everything resolves from **`src/lib/config.ts`** — chain id, RPC endpoint,
explorer, the parameters MetaMask is switched with, and the contract address.
The address itself comes from `NEXT_PUBLIC_CONTRACT_ADDRESS` when set,
otherwise from `DEFAULT_CONTRACT_ADDRESS` in the file. Components, hooks and
the wallet layer never hold their own copy.

## 3. Deploy the contract

1. Open `contracts/VerdictLoop.py` and copy the file **exactly as it is**,
   including the two header comment lines (GenVM version pin and SDK dependency).
2. Deploy it on Studio Next in the GenLayer Studio IDE. The constructor takes
   no arguments and grants the deployer no privileges.
3. Save the resulting address — this is the only value the rest of the project
   ever needs.

## 4. Point the console at the deployment

**Option A — environment variable (recommended).** Nothing in the repository
changes; per-environment deployments just set a different value:

```bash
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedAddress
```

**Option B — edit the file.** Update `DEFAULT_CONTRACT_ADDRESS` in
`src/lib/config.ts`.

Either way, record the deployment in `deployments/studio-next.json` so
`scripts/verify_deployment.py` and the deploy log stay in sync. Then:

```bash
npm install
npm run dev     # local console
npm run build   # production build
```

Every reader, writer, explorer link, the network card and the copy chip derive
from that single value — there is no second place to update.

## 5. Verify the deployment

```bash
python3 scripts/verify_deployment.py            # reads deployments/studio-next.json
python3 scripts/verify_deployment.py 0xYourAddress
CONTRACT_ADDRESS=0xYourAddress python3 scripts/verify_deployment.py
```

The script downloads the code at the configured address over the network RPC,
decodes it and compares it with `contracts/VerdictLoop.py`. A mismatch fails
loudly: redeploy, or fix the pinned file — the console must never point at code
the repository cannot reproduce. The current deployment passes this check, and
CI runs it on every push.

## 6. Redeploying to a new address

A redeploy is a fresh registry: markets, predictions, rounds and events do not
migrate (the old deployment keeps its immutable history). The full procedure:

1. Deploy the contract again and copy the new address.
2. Update the address (section 4) and `deployments/studio-next.json`.
3. Recreate any demo markets you still need (the demo pages in `public/fixtures`
   are permanent source pages).
4. Run `python3 scripts/verify_deployment.py` and the pytest suite.
5. Append the new entry to the log in `STUDIO_NEXT_DEPLOY.md`.

## 7. Console environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | live deployment in `src/lib/config.ts` | The deployed contract the console talks to. |
| `NEXT_PUBLIC_GENLAYER_RPC` | `https://studio-next.genlayer.com/api` | Network RPC endpoint override. |
| `NEXT_PUBLIC_GENLAYER_EXPLORER` | `https://explorer-studio-next.genlayer.com` | Explorer used for address/transaction links. |
| `NEXT_PUBLIC_SITE_URL` | `https://verdictloop.vercel.app` | Public URL of the console; fallback for absolute demo-source addresses (the browsing origin wins when it is https). |
| `NEXT_PUBLIC_FIXTURES_BASE` | _unset_ — serving origin | Base URL for the demo source pages when a host cannot serve `public/fixtures` (for example the repository's raw file host). |

Because these are `NEXT_PUBLIC_*` variables they are baked into the browser
bundle at build time — change them, then rebuild.

## 8. Troubleshooting

**Writes fail with "Request is being rate limited".** The public Studio Next
endpoint throttles per connection. The console serializes its reads, backs off
on throttled responses and retries the signature-free parts of the write path
(fee estimation and receipt polling) automatically. If the wallet still reports
a rate limit, wait 15–30 seconds and click the action again — a rejected send
never committed anything on chain, so retrying is safe.

**MetaMask asks for more than one signature for one action.** It should not:
the console deliberately attempts every send exactly once — one click, one
signature. Repeated prompts mean an earlier attempt was rejected or
rate-limited; each new click is a new, intentional signature.

**MetaMask shows a security/"deceptive" banner on the transaction.** That is
MetaMask's automated screening of a contract and domain it has never seen
before — not a finding about this contract. Verify what you are signing
against the pinned record instead: the recipient address must equal the
verified contract in `deployments/studio-next.json` /
`https://explorer-studio-next.genlayer.com/address/…`, and the console only
ever sends `create_market` / `predict` / `resolve` / `expire` calls to it. The
help card inside the commit drawer states the same thing to users.

**Wallet on the wrong network.** The console switches MetaMask to Studio Next
(chain 61997) on connect and re-checks the chain immediately before every
signature — nothing leaves the wallet while it sits on another network, and a
wallet already on 61997 is left alone with zero prompts. If the network is
missing from the wallet, the console offers to add it with the canonical
parameters. When the wallet moves away afterwards, the nav shows a "Wrong
network" button that switches it back in one click.

**Icons or images missing on the deploy host (404s, "module not found" for
assets).** The console is binary-asset-proof by construction: the logo mark,
the hero validator glyphs and the favicon are pure SVG/JSX; the social card is
rendered from JSX at `src/app/opengraph-image.tsx`; and the few PNG/ICO
fallbacks that browsers still want are regenerated from
`scripts/verdictloop_icons.mjs` (pure Node standard library) inside
`next.config.ts` whenever they are missing from the checkout. A pipeline that
drops binary files therefore cannot break the build — at worst it falls back
to the text assets that are always committed. Fonts load via an ordinary
runtime `<link>` so builds never fetch anything from the network.

**A market's "Source page" link opens a 404.** The committed source address is
immutable by design, so check where it points before committing. Demo presets
always fill the fixture pages of the deployment you are currently browsing
(`{origin}/fixtures/…`), so they only break if committed from a different site
than the one you keep using. Markets committed earlier against the project's
initial placeholder domain read as *source unreachable* forever and can be
voided with `expire()` after expiry; the console hides them from the hub via
the `LEGACY_SOURCE_HOSTS` list in `src/lib/config.ts` (display-only filter —
they remain on chain). Set `NEXT_PUBLIC_FIXTURES_BASE` when a deployment
cannot host `public/fixtures` (for example the repository's raw file host
works as a public mirror).

**A just-committed market does not appear in the hub right away.** Reads on a
freshly accepted transaction can lag by a few seconds, and the public endpoint
may throttle bursts. The console runs a dedicated visibility poll after every
commitment (plus trailing refreshes at 4s and 12s) and highlights the new card
in the hub the moment it becomes readable — under heavy throttling it can take
up to a minute. It always arrives; nothing needs to be re-created.
