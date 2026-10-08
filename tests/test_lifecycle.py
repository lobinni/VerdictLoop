"""Lifecycle: creation, prediction, the round loop, expiry, views."""

import json

import genlayer as gl
import pytest
from conftest import (
    ADDR_A,
    ADDR_B,
    FINAL_PAGE,
    OPEN_PAGE,
    advance,
    commit,
    final_answer,
    open_round,
    set_llm,
    set_page,
)


def test_create_commits_everything(chain):
    mid = commit(chain)
    m = json.loads(chain.get_market(mid))
    assert m["market_id"] == mid
    assert m["creator"] == ADDR_A
    assert m["question"].startswith("Did Meridian DAO")
    assert m["outcomes"] == ["Approved", "Defeated"]
    assert m["status"] == "open"
    assert m["resolve_at"] == m["created_at"] + 7200
    assert m["expires_at"] == m["created_at"] + 604800
    assert m["next_round_at"] == m["resolve_at"]
    assert m["tally"] == [0, 0]
    events = json.loads(chain.get_events())
    assert events[-1]["kind"] == "Created"


def test_create_rejects_duplicates_and_caps(chain):
    mid = commit(chain)
    with pytest.raises(Exception, match="already exists"):
        commit(chain)
    assert json.loads(chain.list_ids()) == [mid]


@pytest.mark.parametrize(
    "over, needle",
    [
        ({"market_id": "bad id!"}, "only a-z"),
        ({"question": ""}, "question is required"),
        ({"outcomes_json": '["Only"]'}, "between 2 and 6"),
        ({"outcomes_json": '["A", "a"]'}, "distinct"),
        ({"outcomes_json": "not json"}, "JSON array"),
        ({"source_url": "http://insecure.example"}, "https://"),
        ({"source_url": "https://a.example/../b"}, "must not contain"),
        ({"predictions_close_in": "7200", "resolve_in": "3600"}, "no later than"),
        ({"confirmations_required": "9"}, "between 1 and 5"),
        (
            {"resolve_in": "3600", "confirm_interval": "3600", "confirmations_required": "3", "expire_in": "3600"},
            "at least resolve_in",
        ),
    ],
)
def test_create_validation(chain, over, needle):
    with pytest.raises(Exception, match=needle):
        commit(chain, over)


def test_predict_one_per_address_until_close(chain):
    mid = commit(chain)
    chain.predict(mid, "0")
    gl.message.sender_address = ADDR_B
    chain.predict(mid, "1")
    m = json.loads(chain.get_market(mid))
    assert m["tally"] == [1, 1]
    with pytest.raises(Exception, match="already predicted"):
        chain.predict(mid, "1")
    with pytest.raises(Exception, match="between 0 and 1"):
        gl.message.sender_address = ADDR_B.replace("b", "e")
        chain.predict(mid, "5")
    advance(3601)
    with pytest.raises(Exception, match="predictions are closed"):
        gl.message.sender_address = ADDR_B
        chain.predict(mid, "0")


def test_resolve_refused_before_opening(chain):
    mid = commit(chain)
    with pytest.raises(Exception, match="not accepted yet"):
        chain.resolve(mid)
    assert gl.prompts == []  # an early call reverts before the page is fetched
    advance(7200)
    set_llm(final_answer(0))
    chain.resolve(mid)
    m = json.loads(chain.get_market(mid))
    assert m["rounds"] == 1


def test_two_agreeing_rounds_make_it_final(chain):
    mid = commit(chain)
    set_page(FINAL_PAGE)
    set_llm(final_answer(0))
    open_round(chain, mid)
    chain.resolve(mid)
    m = json.loads(chain.get_market(mid))
    assert m["status"] == "proposed"
    assert m["proposed_index"] == 0
    assert m["confirmations"] == 1

    open_round(chain, mid)
    chain.resolve(mid)
    m = json.loads(chain.get_market(mid))
    assert m["status"] == "resolved"
    assert m["confirmations"] == 2
    out = json.loads(chain.get_outcome(mid))
    assert out == {
        "market_id": mid,
        "status": "resolved",
        "final": True,
        "outcome_index": 0,
        "outcome_label": "Approved",
        "resolved_at": m["resolved_at"],
    }
    events = [e["kind"] for e in json.loads(chain.get_events())]
    assert events[-2:] == ["Round", "Resolved"]


def test_undetermined_is_normal_and_withdraws_proposals(chain):
    mid = commit(chain)
    open_round(chain, mid)  # page still OPEN_PAGE, model says undetermined
    chain.resolve(mid)
    m = json.loads(chain.get_market(mid))
    assert m["status"] == "open"
    assert m["last_round"] == "undetermined"

    set_llm(final_answer(1))
    open_round(chain, mid)
    chain.resolve(mid)
    assert json.loads(chain.get_market(mid))["proposed_index"] == 1

    set_llm({"determined": False})
    open_round(chain, mid)
    chain.resolve(mid)
    m = json.loads(chain.get_market(mid))
    assert m["proposed_index"] == -1
    assert m["confirmations"] == 0
    assert "withdrawn" in m["last_detail"]


def test_a_different_reading_restarts_the_count(chain):
    mid = commit(chain)
    set_llm(final_answer(0))
    open_round(chain, mid)
    chain.resolve(mid)
    set_llm(final_answer(1))
    open_round(chain, mid)
    chain.resolve(mid)
    m = json.loads(chain.get_market(mid))
    assert m["last_round"] == "contradicted"
    assert m["proposed_index"] == 1
    assert m["confirmations"] == 1


def test_unreachable_source_is_neutral(chain):
    mid = commit(chain)
    set_llm(final_answer(0))
    open_round(chain, mid)
    chain.resolve(mid)
    assert json.loads(chain.get_market(mid))["proposed_index"] == 0

    set_page(Exception("connection reset"))
    open_round(chain, mid)
    chain.resolve(mid)
    m = json.loads(chain.get_market(mid))
    assert m["last_round"] == "source_unreachable"
    assert m["proposed_index"] == 0  # an outage overturns nothing
    assert m["confirmations"] == 1

    set_page(FINAL_PAGE)
    open_round(chain, mid)
    chain.resolve(mid)
    m = json.loads(chain.get_market(mid))
    assert m["status"] == "resolved"  # and it still consumed its interval, not the round


def test_expiry_voids_and_blocks_resolution(chain):
    mid = commit(chain)
    with pytest.raises(Exception, match="not reached its expiry"):
        chain.expire(mid)
    advance(604800)
    with pytest.raises(Exception, match="call expire"):
        chain.resolve(mid)
    chain.expire(mid)
    m = json.loads(chain.get_market(mid))
    assert m["status"] == "void"
    with pytest.raises(Exception, match="already closed"):
        chain.expire(mid)
    with pytest.raises(Exception, match="already closed"):
        chain.resolve(mid)


def test_schedule_reports_what_is_accepted(chain):
    mid = commit(chain)
    s = json.loads(chain.get_schedule(mid))
    assert s["predictions_open"] is True
    assert s["round_open"] is False
    assert s["seconds_until_round"] == 7200
    advance(7200)
    s = json.loads(chain.get_schedule(mid))
    assert s["predictions_open"] is False
    assert s["round_open"] is True
    assert s["seconds_until_round"] == 0


def test_predictions_are_scored_once_final(chain):
    mid = commit(chain)
    chain.predict(mid, "0")
    gl.message.sender_address = ADDR_B
    chain.predict(mid, "1")
    set_llm(final_answer(0))
    for _ in range(2):
        open_round(chain, mid)
        chain.resolve(mid)
    rows = json.loads(chain.get_predictions(mid))
    by_addr = {r["address"]: r for r in rows}
    assert by_addr[ADDR_A]["correct"] is True
    assert by_addr[ADDR_B]["correct"] is False


def test_stats_aggregate_and_admin_is_empty(chain):
    commit(chain, {"market_id": "m-one"})
    commit(chain, {"market_id": "m-two", "predictions_close_in": "7200", "resolve_in": "7200"})
    chain.predict("m-one", "0")
    stats = json.loads(chain.get_stats())
    assert stats["markets"] == 2
    assert stats["open"] == 2
    assert stats["predictions"] == 1
    assert chain.get_admin() == ""
    assert json.loads(chain.get_market("nope"))["error"] == "unknown market_id"


def test_event_log_is_capped(chain):
    mid = commit(chain)
    bulky = [{"kind": "Filler", "i": i} for i in range(205)]
    chain.events_json = json.dumps(bulky)
    chain.predict(mid, "0")
    events = json.loads(chain.get_events())
    assert len(events) == 200
    assert events[-1]["kind"] == "Predicted"


def test_never_steered_and_never_owned(chain):
    """resolve() takes a market id and nothing else; there is no power path at all."""
    import inspect

    params = list(inspect.signature(chain.resolve).parameters)
    assert params == ["market_id"]
    for forbidden in (
        "force_resolve", "cancel_market", "set_outcome", "set_source",
        "transfer_ownership", "owner", "admin", "pause", "upgrade",
    ):
        assert not hasattr(chain, forbidden), forbidden
