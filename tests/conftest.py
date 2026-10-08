"""Pytest bootstrap: a fake GenVM the tests steer.

Knobs:
  gl.clock              the transaction datetime, in unix seconds (see advance())
  gl.page               text the source page returns (str, or an Exception to raise)
  gl.llm_reply          raw model output (str/dict, or an Exception to raise)
  gl.comparative_fails  when True, eq_principle.prompt_comparative raises
  gl.prompts            every prompt sent, for assertions about quoting
  gl.sender             the caller address for the next write
"""

from __future__ import annotations

import sys
import types
from datetime import datetime as _real_dt
from datetime import timezone as _real_tz
from pathlib import Path

import pytest


def _install_fake_genlayer() -> None:
    existing = sys.modules.get("genlayer")
    if existing is not None and getattr(existing, "_fake_genvm", False):
        return

    gl = types.ModuleType("genlayer")
    gl._fake_genvm = True

    class _Public:
        @staticmethod
        def write(fn):
            return fn

        @staticmethod
        def view(fn):
            return fn

    class _EqPrinciple:
        @staticmethod
        def prompt_comparative(leader_fn, principle="", /):
            """`principle` is positional-only in GenVM v0.3; the fake enforces that so a
            keyword call fails in tests exactly as it does on chain."""
            if getattr(gl, "comparative_fails", False):
                raise Exception("comparative consensus unavailable")
            return leader_fn()

        @staticmethod
        def strict_eq(leader_fn):
            return leader_fn()

    def _render(url, mode="text"):
        page = gl.page
        if isinstance(page, Exception):
            raise page
        if mode == "text" and (page is None or str(page).strip() == ""):
            return gl.page_html
        return page

    def _exec_prompt(prompt, response_format=None):
        gl.prompts.append(prompt)
        reply = gl.llm_reply
        if isinstance(reply, Exception):
            raise reply
        return reply

    gl.public = _Public
    gl.eq_principle = _EqPrinciple
    gl.nondet = types.SimpleNamespace(
        web=types.SimpleNamespace(render=_render),
        exec_prompt=_exec_prompt,
    )
    gl.contract = types.SimpleNamespace(Contract=object)

    gl.clock = 1_700_000_000  # a fixed, deterministic "now" for every test
    gl.page = "source page body"
    gl.page_html = ""
    gl.llm_reply = {"determined": False}
    gl.comparative_fails = False
    gl.prompts = []
    gl.message = types.SimpleNamespace(sender_address="0x" + "c0ffee" * 6 + "c0f0")

    sys.modules["genlayer"] = gl


_install_fake_genlayer()

import genlayer as gl  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "contracts"))
import VerdictLoop as contract_module  # noqa: E402

ADDR_A = "0x" + "a" * 40
ADDR_B = "0x" + "b" * 40
ADDR_C = "0x" + "c" * 40
ADDR_D = "0x" + "d" * 40

FINAL_PAGE = (
    "Governance record. Counting for proposal 12 has closed and the outcome is "
    "certified: the proposal is Approved with 68.4% of voting power in favour. "
    "This is the final outcome."
)
OPEN_PAGE = (
    "Live tracker. Voting is still open: the Approved side is currently leading "
    "with 61.2% of the ballots counted so far, and our desk projects approval. "
    "The certified outcome will be posted once counting closes."
)


class _FrozenClock:
    """drop-in for the datetime class the contract captured at import time"""

    @staticmethod
    def now(tz=None):
        return _real_dt.fromtimestamp(gl.clock, tz=_real_tz.utc)


def advance(seconds: int) -> None:
    gl.clock += int(seconds)


def set_page(value) -> None:
    gl.page = value


def set_llm(value) -> None:
    gl.llm_reply = value


def final_answer(index: int) -> dict:
    return {"determined": True, "outcome": index}


@pytest.fixture()
def chain(monkeypatch):
    """A deployed contract on the fake machine, with time/model/page knobs reset."""
    gl.clock = 1_700_000_000
    gl.page = OPEN_PAGE
    gl.page_html = ""
    gl.llm_reply = {"determined": False}
    gl.comparative_fails = False
    gl.prompts = []
    gl.message.sender_address = ADDR_A
    monkeypatch.setattr(contract_module, "datetime", _FrozenClock)
    return contract_module.VerdictLoop()


def commit(c: contract_module.VerdictLoop, over: dict | None = None) -> str:
    """Create a market with sane defaults; every field overridable."""
    args = {
        "market_id": "meridian-dao-12",
        "question": "Did Meridian DAO proposal 12 reach its approval threshold?",
        "outcomes_json": '["Approved", "Defeated"]',
        "source_url": "https://governance.example/proposal-12",
        "resolution_rule": (
            "Resolve only from a final, certified outcome stated after counting "
            "closed. A running tally, a lead or a forecast is not an outcome."
        ),
        "predictions_close_in": "3600",
        "resolve_in": "7200",
        "confirmations_required": "2",
        "confirm_interval": "900",
        "expire_in": "604800",
    }
    if over:
        args.update(over)
    c.create_market(**args)
    return args["market_id"]


def open_round(c: contract_module.VerdictLoop, market_id: str) -> None:
    """Jump time to exactly when the next consensus round is accepted."""
    import json

    schedule = json.loads(c.get_schedule(market_id))
    wait = int(schedule["seconds_until_round"])
    if wait > 0:
        advance(wait)
