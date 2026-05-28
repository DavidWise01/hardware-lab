"""
recursive_memory/core.py

Shared data model for the recursive memory system.

A "memory" is an append-only chain of entries. Each entry's id is the SHA-256
of (parent_id + node_id + timestamp + payload). Because each entry commits to
its parent's id, the chain is tamper-evident: changing any past entry changes
every id after it (the same property git and Merkle logs rely on).

This file has NO external dependencies and is imported by both the local node
and the central server, so the hashing is guaranteed identical on both sides.

Honest scope:
  - "memory" here means stored state with verifiable lineage. Nothing more.
  - the hash chain proves integrity + ordering, NOT truth of the content.
"""
from __future__ import annotations
import hashlib
import json
import time
from dataclasses import dataclass, asdict, field
from typing import Optional

GENESIS_PARENT = "0" * 64  # the root has no real parent


def canonical(payload: dict) -> str:
    """Deterministic JSON so the same payload always hashes the same."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def compute_id(parent_id: str, node_id: str, ts: float, payload: dict) -> str:
    h = hashlib.sha256()
    h.update(parent_id.encode())
    h.update(node_id.encode())
    h.update(repr(ts).encode())
    h.update(canonical(payload).encode())
    return h.hexdigest()


@dataclass
class Entry:
    id: str
    parent_id: str
    node_id: str          # which local node created this (provenance)
    seq: int              # position in this node's local chain
    ts: float             # creation time (epoch seconds)
    payload: dict         # the actual memory content
    # recursive state: a compressed digest carried forward from the parent,
    # so each entry's "state" is a function of input + prior state.
    state_digest: str = ""
    signature: str = ""   # Ed25519 signature of `id` by the node's private key

    @staticmethod
    def create(parent: Optional["Entry"], node_id: str, payload: dict,
               prev_state_digest: str = "", signer=None) -> "Entry":
        parent_id = parent.id if parent else GENESIS_PARENT
        seq = (parent.seq + 1) if parent else 0
        ts = time.time()
        eid = compute_id(parent_id, node_id, ts, payload)
        # recursive fold: new state digest depends on prior digest + this id
        sd = hashlib.sha256((prev_state_digest + eid).encode()).hexdigest()
        sig = signer(eid) if signer else ""
        return Entry(id=eid, parent_id=parent_id, node_id=node_id, seq=seq,
                     ts=ts, payload=payload, state_digest=sd, signature=sig)

    def verify_id(self) -> bool:
        """Recompute the id from the stored fields; must match."""
        return self.id == compute_id(self.parent_id, self.node_id, self.ts, self.payload)

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "Entry":
        return Entry(**d)


def verify_chain(entries: list[Entry], public_key: Optional[str] = None) -> tuple[bool, Optional[str]]:
    """
    Validate an ordered list of entries:
      - each entry's id recomputes correctly (content integrity)
      - each entry's parent_id matches the previous entry's id (lineage)
      - the recursive state digest folds correctly
      - (optional) each entry's signature verifies against public_key (authenticity)
    Returns (ok, error_message).
    """
    prev_id = GENESIS_PARENT
    prev_state = ""
    if public_key:
        from .identity import verify as sig_verify
    for i, e in enumerate(entries):
        if not e.verify_id():
            return False, f"entry {i} ({e.id[:8]}): id does not match content"
        if e.parent_id != prev_id:
            return False, f"entry {i} ({e.id[:8]}): broken lineage, parent mismatch"
        expected_state = hashlib.sha256((prev_state + e.id).encode()).hexdigest()
        if e.state_digest != expected_state:
            return False, f"entry {i} ({e.id[:8]}): recursive state digest mismatch"
        if public_key:
            if not e.signature or not sig_verify(public_key, e.id, e.signature):
                return False, f"entry {i} ({e.id[:8]}): signature invalid for node key"
        prev_id = e.id
        prev_state = e.state_digest
    return True, None
