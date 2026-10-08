#!/usr/bin/env python3
"""Fail the build if the deployed bytes stop matching contracts/VerdictLoop.py.

Reads the contract code currently deployed at the configured address from the
network RPC (gen_getContractCode returns it base64-encoded) and compares it,
normalizing line endings and trailing whitespace, with the local source file.

Usage:
    python3 scripts/verify_deployment.py [address]

The address defaults to the CONTRACT_ADDRESS environment variable, then to
deployments/studio-next.json. GENLAYER_RPC overrides the default endpoint.
Exits non-zero on any mismatch or fetch failure.
"""

import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_FILE = ROOT / "contracts" / "VerdictLoop.py"
DEPLOY_FILE = ROOT / "deployments" / "studio-next.json"
DEFAULT_RPC = "https://studio-next.genlayer.com/api"


def configured_address() -> str:
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1].strip()
    if os.environ.get("CONTRACT_ADDRESS"):
        return os.environ["CONTRACT_ADDRESS"].strip()
    if DEPLOY_FILE.exists():
        data = json.loads(DEPLOY_FILE.read_text())
        address = str(data.get("address", "")).strip()
        if address:
            return address
    raise SystemExit("no contract address configured (arg, env or deployments/studio-next.json)")


def normalize(text: str) -> str:
    return "\n".join(line.rstrip() for line in str(text).replace("\r\n", "\n").split("\n")).strip()


def decode_payload(raw: str) -> str:
    """gen_getContractCode answers with base64-encoded source."""
    try:
        decoded = base64.b64decode(raw, validate=True).decode("utf-8")
        if decoded.lstrip().startswith("#"):
            return decoded
    except Exception:
        pass
    return raw


def rpc_call(method: str, params: list) -> object:
    rpc = os.environ.get("GENLAYER_RPC", DEFAULT_RPC)
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(
        rpc,
        data=body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (verify_deployment; +https://studio.genlayer.com)",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        payload = json.loads(res.read().decode())
    if payload.get("error"):
        raise SystemExit(f"{method} failed: {payload['error']}")
    return payload.get("result")


def main() -> None:
    address = configured_address()
    local = normalize(CONTRACT_FILE.read_text())
    deployed = rpc_call("gen_getContractCode", [address])
    if not isinstance(deployed, str) or not deployed.strip():
        raise SystemExit(f"no code deployed at {address}")
    if normalize(decode_payload(deployed)) == local:
        print(f"OK: deployed code at {address} matches {CONTRACT_FILE.name}")
        return
    raise SystemExit(
        f"MISMATCH: deployed code at {address} differs from contracts/VerdictLoop.py — "
        "redeploy or update the pinned file before shipping"
    )


if __name__ == "__main__":
    main()
