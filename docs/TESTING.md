# Testing guide

The contract ships with a pytest suite that runs the full resolution loop on a
fake GenVM — no network, no wallet, deterministic time. 57 tests, ~0.1 seconds.

## 1. Setup

```bash
pip install -r requirements-dev.txt
```

Python 3.10+ is enough; the suite imports no third-party packages besides pytest.

## 2. Run

```bash
python3 -m pytest -q
```

Expected output: `57 passed`.

Useful variations:

```bash
python3 -m pytest -q tests/test_lifecycle.py     # happy-path loop only
python3 -m pytest -q tests/test_adversarial.py   # the half that matters
python3 -m pytest -q -k "malformed"              # one behaviour across cases
python3 -m pytest -x                             # stop at first failure
```

## 3. How the harness works

`tests/conftest.py` replaces the `genlayer` module with a fake before the
contract is imported, then hands each test a deployed instance with steerable
knobs:

| Knob | What it controls |
| --- | --- |
| `gl.clock` | The transaction datetime, in unix seconds. `advance(seconds)` moves time; the resolve window, the interval between rounds and expiry all read it. |
| `gl.page` / `gl.page_html` | What the source page returns — a string, or an `Exception` to simulate an outage. |
| `gl.llm_reply` | Raw model output — a dict, a string, or an `Exception`. |
| `gl.comparative_fails` | When `True`, the comparative consensus step raises. |
| `gl.prompts` | Every prompt sent, for asserting that untrusted data is fenced. |
| `gl.message.sender_address` | The caller of the next write. |

Helpers: `commit(chain, **overrides)` creates a market with sane defaults, and
`open_round(chain, market_id)` jumps time to exactly when the next round is
accepted. `FINAL_PAGE` states a certified outcome; `OPEN_PAGE` shows a leading
side and a forecast without any final result.

## 4. What is covered

**`tests/test_lifecycle.py`** — the loop as intended:

- creation commits question, outcomes, source, rule and every time limit, and
  rejects duplicates and invalid inputs;
- one immutable prediction per address until predictions close;
- `resolve()` refused before the opening time (before anything is fetched);
- two agreeing rounds, an interval apart, seal the final outcome; consumers read
  it through `get_outcome`;
- undetermined pages propose nothing, changed readings restart the count,
  vanished results withdraw the proposal, and unreachable pages do neither;
- expiry voids what never resolved; schedule, stats, predictions and events all
  read back consistently; the event log is capped; `get_admin` stays empty.

**`tests/test_adversarial.py`** — the half that matters:

- **Nothing malformed becomes a result.** Eighteen malformed model answers —
  quoted booleans and indexes, `true` as an index, floats, out-of-range and
  negative indexes, labels, missing keys, non-objects, prose — each revert and
  leave the market untouched. So do a model error one round from final and a
  consensus failure.
- **It cannot be hurried.** Four different callers inside the interval all
  revert without fetching; two calls straddling a clock boundary are one round;
  a caller hammering every second cannot finalize a four-round market early.
- **A brief edit resolves nothing.** A flipped page restarts the count, a
  reverted page withdraws the proposal, and an unreachable page alone never
  resolves a market no matter how often it is called.
- **It cannot be injected.** Injection phrasing on the page and in the creator's
  own question is fenced, flagged to the model and stored on the market; forged
  fences inside the data are neutralized.
- **Long pages.** A result buried after thousands of filler characters is still
  found; the digest stays bounded and deterministic while the whole document is
  hashed.

## 5. Adding a test

Write the behaviour against the knobs, not against a network:

```python
def test_something(chain):
    mid = commit(chain)
    set_llm(final_answer(0))
    open_round(chain, mid)
    chain.resolve(mid)
    ...
```

CI (`.github/workflows/ci.yml`) runs the same command on every push and pull
request, so a red suite blocks a merge just like a red build does.
