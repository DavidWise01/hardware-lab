"""
recursive_memory/local_node.py

A LOCAL recursive-memory node.

Responsibilities:
  - append new memory entries to a local hash chain (core.Entry)
  - persist the chain to disk as JSON, one file the git repo tracks
  - auto-commit every append to git  -> full history + integrity for free
  - push/pull with the central server over HTTP

Why git AND a hash chain (they are not redundant):
  - the hash chain gives application-level, tamper-evident lineage that the
    central DB also understands and can verify independently;
  - git gives you local history, diffs, blame, branches, and offline-first
    durability on the node itself.

Usage:
    node = LocalNode("node-A", "/path/to/repo", central_url="http://localhost:8000")
    node.append({"text": "first memory"})
    node.push()      # send local-only entries up to central
    node.pull()      # fetch entries this node is missing
"""
from __future__ import annotations
import json
import os
import subprocess
from typing import Optional

import requests

from .core import Entry, verify_chain, GENESIS_PARENT

LOG_FILE = "memory_log.json"


class LocalNode:
    def __init__(self, node_id: str, repo_dir: str, central_url: Optional[str] = None):
        self.node_id = node_id
        self.repo_dir = os.path.abspath(repo_dir)
        self.central_url = central_url.rstrip("/") if central_url else None
        self.log_path = os.path.join(self.repo_dir, LOG_FILE)
        self.entries: list[Entry] = []
        os.makedirs(self.repo_dir, exist_ok=True)
        self._git("init", "-q")
        self._configure_git()
        self._load()

    # ---------- git plumbing ----------
    def _git(self, *args: str) -> str:
        res = subprocess.run(["git", *args], cwd=self.repo_dir,
                             capture_output=True, text=True)
        return res.stdout.strip()

    def _configure_git(self):
        # local identity so commits succeed in a clean environment
        if not self._git("config", "user.email"):
            self._git("config", "user.email", f"{self.node_id}@recursive-memory.local")
        if not self._git("config", "user.name"):
            self._git("config", "user.name", f"node-{self.node_id}")

    def _commit(self, msg: str):
        self._git("add", LOG_FILE)
        # commit only if there is something staged
        status = self._git("status", "--porcelain")
        if status:
            self._git("commit", "-q", "-m", msg)

    # ---------- persistence ----------
    def _load(self):
        if os.path.exists(self.log_path):
            with open(self.log_path) as f:
                data = json.load(f)
            self.entries = [Entry.from_dict(d) for d in data]
        else:
            self.entries = []
            self._save(commit_msg="genesis: empty log")

    def _save(self, commit_msg: str):
        with open(self.log_path, "w") as f:
            json.dump([e.to_dict() for e in self.entries], f, indent=2)
        self._commit(commit_msg)

    # ---------- the recursive append ----------
    def append(self, payload: dict) -> Entry:
        parent = self.entries[-1] if self.entries else None
        prev_state = parent.state_digest if parent else ""
        entry = Entry.create(parent, self.node_id, payload, prev_state)
        self.entries.append(entry)
        self._save(commit_msg=f"append {entry.id[:8]} seq={entry.seq}")
        return entry

    def verify(self) -> tuple[bool, Optional[str]]:
        return verify_chain(self.entries)

    def head(self) -> Optional[Entry]:
        return self.entries[-1] if self.entries else None

    # ---------- sync with central ----------
    def push(self) -> dict:
        """Send entries the central server does not yet have."""
        if not self.central_url:
            raise RuntimeError("no central_url configured")
        # ask central what HEAD it has for this node
        r = requests.get(f"{self.central_url}/head", params={"node_id": self.node_id}, timeout=10)
        r.raise_for_status()
        remote_seq = r.json().get("seq", -1)
        to_send = [e.to_dict() for e in self.entries if e.seq > remote_seq]
        if not to_send:
            return {"pushed": 0, "remote_seq": remote_seq}
        resp = requests.post(f"{self.central_url}/push",
                             json={"node_id": self.node_id, "entries": to_send}, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def pull(self) -> dict:
        """Fetch entries for THIS node that exist on central but not locally
        (e.g. after restoring an empty repo). Verifies before accepting."""
        if not self.central_url:
            raise RuntimeError("no central_url configured")
        local_seq = self.head().seq if self.head() else -1
        r = requests.get(f"{self.central_url}/entries",
                         params={"node_id": self.node_id, "after_seq": local_seq}, timeout=15)
        r.raise_for_status()
        incoming = [Entry.from_dict(d) for d in r.json().get("entries", [])]
        if not incoming:
            return {"pulled": 0}
        candidate = self.entries + incoming
        ok, err = verify_chain(candidate)
        if not ok:
            return {"pulled": 0, "rejected": True, "error": err}
        self.entries = candidate
        self._save(commit_msg=f"pull {len(incoming)} entries from central")
        return {"pulled": len(incoming)}
