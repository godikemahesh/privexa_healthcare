"""Audit-anchor integration with the AuditAnchor contract on a local EVM development chain.

The chain is integrity evidence only. It never stores clinical data and is never used for authorization.
"""

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import SessionLocal
from ..models import AuditEvent, BlockchainAnchor
from .audit import compute_fingerprint

log = logging.getLogger("privexa.chain")

ABI = [
    {"type": "function", "name": "anchor", "stateMutability": "nonpayable", "inputs": [{"name": "fingerprint", "type": "bytes32"}], "outputs": []},
    {
        "type": "function",
        "name": "isAnchored",
        "stateMutability": "view",
        "inputs": [{"name": "fingerprint", "type": "bytes32"}],
        "outputs": [{"name": "anchored", "type": "bool"}, {"name": "blockNumber", "type": "uint256"}, {"name": "timestamp", "type": "uint256"}],
    },
    {"type": "function", "name": "owner", "stateMutability": "view", "inputs": [], "outputs": [{"name": "", "type": "address"}]},
]


class ChainUnavailable(Exception):
    pass


def _address() -> str:
    s = get_settings()
    if s.anchor_contract_address:
        return s.anchor_contract_address
    p = Path(s.anchor_deployment_file)
    if p.exists():
        return json.loads(p.read_text())["address"]
    raise ChainUnavailable("Audit-anchor contract is not deployed. Run the contract deployment script.")


class AnchorClient:
    def __init__(self):
        from web3 import Web3

        s = get_settings()
        self.w3 = Web3(Web3.HTTPProvider(s.chain_rpc_url, request_kwargs={"timeout": 5}))
        try:
            self.chain_id = self.w3.eth.chain_id
        except Exception as e:  # noqa: BLE001
            raise ChainUnavailable("The demonstration blockchain is not reachable") from e
        self.address = Web3.to_checksum_address(_address())
        if self.w3.eth.get_code(self.address) in (b"", b"\x00"):
            raise ChainUnavailable("No contract found at the configured address. The chain may have been restarted; redeploy the contract.")
        self.contract = self.w3.eth.contract(address=self.address, abi=ABI)
        self.private_key = s.anchor_private_key

    def anchor(self, fingerprint: str) -> tuple[str, int]:
        fp = bytes.fromhex(fingerprint.removeprefix("0x"))
        if self.private_key:
            acct = self.w3.eth.account.from_key(self.private_key)
            tx = self.contract.functions.anchor(fp).build_transaction({"from": acct.address, "nonce": self.w3.eth.get_transaction_count(acct.address, "pending"), "chainId": self.chain_id})
            signed = acct.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        else:
            sender = self.w3.eth.accounts[0]
            tx_hash = self.contract.functions.anchor(fp).transact({"from": sender})
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
        if receipt["status"] != 1:
            raise RuntimeError("Anchor transaction reverted")
        return receipt["transactionHash"].to_0x_hex(), receipt["blockNumber"]

    def lookup(self, fingerprint: str) -> tuple[bool, int, int]:
        fp = bytes.fromhex(fingerprint.removeprefix("0x"))
        anchored, block, ts = self.contract.functions.isAnchored(fp).call()
        return bool(anchored), int(block), int(ts)


_client: AnchorClient | None = None
_client_lock = threading.Lock()


def get_client() -> AnchorClient:
    """Creating a client costs seconds (provider setup, contract checks), so one is cached and reused."""
    global _client
    with _client_lock:
        if _client is None:
            _client = AnchorClient()
        return _client


def reset_client() -> None:
    global _client
    with _client_lock:
        _client = None


def anchor_event(event_id: str) -> None:
    """Submit the event fingerprint and record the actual transaction outcome."""
    db = SessionLocal()
    try:
        a = db.query(BlockchainAnchor).filter_by(audit_event_id=event_id).one_or_none()
        if not a or a.status == "anchored":
            return
        try:
            client = get_client()
            already, block, _ = client.lookup(a.fingerprint)
            if already:
                a.status, a.block_number, a.error = "anchored", block, None
            else:
                tx_hash, block = client.anchor(a.fingerprint)
                a.status, a.tx_hash, a.block_number, a.error = "anchored", tx_hash, block, None
            a.chain_id, a.contract_address = client.chain_id, client.address
        except ChainUnavailable as e:
            reset_client()
            a.status, a.error = "failed", str(e)[:300]
        except Exception as e:  # noqa: BLE001
            reset_client()
            log.warning("anchor failed for %s: %s", event_id, type(e).__name__)
            a.status, a.error = "failed", f"Anchor transaction failed ({type(e).__name__})"
        db.commit()
    finally:
        db.close()


def process_pending(limit: int = 25) -> int:
    """Anchor pending audit events, oldest first. Returns how many were processed."""
    db = SessionLocal()
    try:
        ids = [a.audit_event_id for a in db.query(BlockchainAnchor).filter_by(status="pending").order_by(BlockchainAnchor.created_at).limit(limit)]
    finally:
        db.close()
    for event_id in ids:
        anchor_event(event_id)
    return len(ids)


class AnchorWorker:
    """Single background thread that anchors pending events. One writer avoids nonce races."""

    def __init__(self, interval: float = 0.75):
        self.interval = interval
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, name="anchor-worker", daemon=True)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._thread.join(timeout=5)

    def _loop(self) -> None:
        # Warm up: importing web3 and connecting can take many seconds on a cold start (notably on Windows
        # with real-time scanning). Doing it here keeps the first anchor fast without delaying API startup.
        try:
            get_client()
            log.info("anchor worker ready")
        except Exception as e:  # noqa: BLE001
            reset_client()
            log.warning("demo chain not available yet (%s); pending anchors will be retried", type(e).__name__)
        while not self._stop.is_set():
            try:
                process_pending()
            except Exception:  # noqa: BLE001
                log.exception("anchor worker iteration failed")
            self._stop.wait(self.interval)


def verify(db: Session, ev: AuditEvent) -> dict:
    a = ev.anchor
    recomputed = compute_fingerprint(ev)
    base = {
        "audit_event_id": ev.id,
        "stored_fingerprint": a.fingerprint if a else ev.fingerprint,
        "recomputed_fingerprint": recomputed,
        "on_chain": False,
        "tx_hash": a.tx_hash if a else None,
        "block_number": a.block_number if a else None,
        "chain_id": a.chain_id if a else None,
        "contract_address": a.contract_address if a else None,
    }
    if not a or a.status != "anchored":
        status = a.status if a else "not anchored"
        return {**base, "status": "not_anchored", "message": f"This event cannot be verified yet: its anchor is {status}."}

    def finish(status: str, message: str, on_chain: bool) -> dict:
        a.last_verification = status
        a.verified_at = datetime.now(timezone.utc)
        db.commit()
        return {**base, "status": status, "message": message, "on_chain": on_chain}

    try:
        client = get_client()
        on_chain, block, _ = client.lookup(a.fingerprint)
    except ChainUnavailable as e:
        reset_client()
        return finish("error", f"Verification could not be completed: {e}", False)
    except Exception as e:  # noqa: BLE001
        reset_client()
        return finish("error", f"Verification could not be completed ({type(e).__name__})", False)
    if not on_chain:
        return finish("error", "The anchored fingerprint was not found on the current chain. The demo chain may have been reset.", False)
    if recomputed != a.fingerprint:
        return finish("mismatch", "Integrity check failed: the stored audit record no longer matches the fingerprint anchored on-chain.", True)
    return finish("verified", f"Integrity verified: the record matches the fingerprint anchored in block {block}.", True)
