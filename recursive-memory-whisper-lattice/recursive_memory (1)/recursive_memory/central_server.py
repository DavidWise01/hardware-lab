"""
recursive_memory/central_server.py

CENTRAL source of truth: FastAPI + SQLite (Postgres-portable), now with
per-node public-key registration and signature verification, plus a built-in
HTML dashboard at "/".

Endpoints (API):
  POST /register_key {node_id, public_key}   -> pin a node's public key (TOFU)
  GET  /head?node_id=
  GET  /entries?node_id=&after_seq=
  POST /push  {node_id, entries[]}           -> verify chain + signatures, store
  GET  /verify?node_id=
  GET  /nodes
  GET  /stats
Dashboard:
  GET  /            -> interactive operator dashboard (static HTML/JS)
"""
from __future__ import annotations
import sqlite3, os, json
from contextlib import closing
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from .core import Entry, verify_chain, GENESIS_PARENT
from .identity import verify as sig_verify

DB_PATH = os.environ.get("RMEM_DB", "central_memory.db")
app = FastAPI(title="Recursive Memory - Central")


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with closing(db()) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS entries(
            id TEXT PRIMARY KEY, parent_id TEXT NOT NULL, node_id TEXT NOT NULL,
            seq INTEGER NOT NULL, ts REAL NOT NULL, payload TEXT NOT NULL,
            state_digest TEXT NOT NULL, signature TEXT NOT NULL DEFAULT '',
            UNIQUE(node_id, seq))""")
        conn.execute("""CREATE TABLE IF NOT EXISTS node_keys(
            node_id TEXT PRIMARY KEY, public_key TEXT NOT NULL,
            registered_ts REAL NOT NULL)""")
        conn.commit()


init_db()


def load_chain(conn, node_id: str) -> list[Entry]:
    rows = conn.execute("SELECT * FROM entries WHERE node_id=? ORDER BY seq ASC",
                        (node_id,)).fetchall()
    return [Entry(id=r["id"], parent_id=r["parent_id"], node_id=r["node_id"],
                  seq=r["seq"], ts=r["ts"], payload=json.loads(r["payload"]),
                  state_digest=r["state_digest"], signature=r["signature"]) for r in rows]


def get_key(conn, node_id: str) -> Optional[str]:
    row = conn.execute("SELECT public_key FROM node_keys WHERE node_id=?",
                       (node_id,)).fetchone()
    return row["public_key"] if row else None


class PushBody(BaseModel):
    node_id: str
    entries: list[dict]


class KeyBody(BaseModel):
    node_id: str
    public_key: str


@app.post("/register_key")
def register_key(body: KeyBody):
    import time
    with closing(db()) as conn:
        existing = get_key(conn, body.node_id)
        if existing and existing != body.public_key:
            # trust-on-first-use: refuse to silently replace a pinned key
            raise HTTPException(409, "node already has a different pinned key")
        if not existing:
            conn.execute("INSERT INTO node_keys(node_id,public_key,registered_ts) VALUES(?,?,?)",
                         (body.node_id, body.public_key, time.time()))
            conn.commit()
    return {"node_id": body.node_id, "pinned": True}


@app.get("/head")
def head(node_id: str):
    with closing(db()) as conn:
        row = conn.execute("SELECT MAX(seq) AS s FROM entries WHERE node_id=?",
                           (node_id,)).fetchone()
    return {"node_id": node_id, "seq": row["s"] if row["s"] is not None else -1}


@app.get("/entries")
def entries(node_id: str, after_seq: int = -1):
    with closing(db()) as conn:
        chain = load_chain(conn, node_id)
    return {"entries": [e.to_dict() for e in chain if e.seq > after_seq]}


@app.post("/push")
def push(body: PushBody):
    incoming = [Entry.from_dict(d) for d in body.entries]
    if any(e.node_id != body.node_id for e in incoming):
        raise HTTPException(400, "node_id mismatch in entries")
    incoming.sort(key=lambda e: e.seq)
    with closing(db()) as conn:
        pub = get_key(conn, body.node_id)
        existing = load_chain(conn, body.node_id)
        existing_seq = existing[-1].seq if existing else -1
        new = [e for e in incoming if e.seq > existing_seq]
        if not new:
            return {"accepted": 0, "head_seq": existing_seq}
        if new[0].seq != existing_seq + 1:
            raise HTTPException(409, f"gap: have head {existing_seq}, got {new[0].seq}")
        # verify integrity + lineage + (if key pinned) signatures
        ok, err = verify_chain(existing + new, public_key=pub)
        if not ok:
            raise HTTPException(422, f"verification failed: {err}")
        for e in new:
            conn.execute("INSERT INTO entries(id,parent_id,node_id,seq,ts,payload,state_digest,signature)"
                         " VALUES(?,?,?,?,?,?,?,?)",
                         (e.id, e.parent_id, e.node_id, e.seq, e.ts,
                          json.dumps(e.payload, sort_keys=True), e.state_digest, e.signature))
        conn.commit()
    return {"accepted": len(new), "head_seq": new[-1].seq, "signed": pub is not None}


@app.get("/verify")
def verify(node_id: str):
    with closing(db()) as conn:
        chain = load_chain(conn, node_id)
        pub = get_key(conn, node_id)
    ok, err = verify_chain(chain, public_key=pub)
    return {"node_id": node_id, "length": len(chain), "valid": ok,
            "signed": pub is not None, "error": err}


@app.get("/nodes")
def nodes():
    with closing(db()) as conn:
        rows = conn.execute("SELECT e.node_id, MAX(e.seq) AS head, COUNT(*) AS n, "
                            "(SELECT public_key FROM node_keys k WHERE k.node_id=e.node_id) AS pubkey "
                            "FROM entries e GROUP BY e.node_id").fetchall()
    return {"nodes": [dict(r) for r in rows]}


@app.get("/stats")
def stats():
    with closing(db()) as conn:
        n_entries = conn.execute("SELECT COUNT(*) c FROM entries").fetchone()["c"]
        n_nodes = conn.execute("SELECT COUNT(DISTINCT node_id) c FROM entries").fetchone()["c"]
        n_keys = conn.execute("SELECT COUNT(*) c FROM node_keys").fetchone()["c"]
    return {"entries": n_entries, "nodes": n_nodes, "keys_pinned": n_keys}


@app.get("/", response_class=HTMLResponse)
def dashboard():
    return DASHBOARD_HTML


# dashboard HTML is defined in dashboard.py to keep this file readable
from .dashboard import DASHBOARD_HTML
