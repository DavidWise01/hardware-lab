"""
recursive_memory/central_server.py

The CENTRAL source of truth. A small FastAPI service backed by SQLite
(swap the connection string for Postgres in production -- schema is portable).

It accepts pushed entries from local nodes, RE-VERIFIES the hash chain before
storing (never trust the client), and serves entries back for pull/restore.

Endpoints:
  GET  /head?node_id=...               -> highest seq stored for that node
  GET  /entries?node_id=...&after_seq= -> entries after a given seq
  POST /push  {node_id, entries[]}     -> append verified entries
  GET  /verify?node_id=...             -> re-verify a node's stored chain
  GET  /nodes                          -> list known nodes + their heads

Run:
    uvicorn recursive_memory.central_server:app --port 8000
"""
from __future__ import annotations
import sqlite3
import os
from contextlib import closing
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .core import Entry, verify_chain, GENESIS_PARENT

DB_PATH = os.environ.get("RMEM_DB", "central_memory.db")
app = FastAPI(title="Recursive Memory — Central")


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with closing(db()) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS entries (
                id           TEXT PRIMARY KEY,
                parent_id    TEXT NOT NULL,
                node_id      TEXT NOT NULL,
                seq          INTEGER NOT NULL,
                ts           REAL NOT NULL,
                payload      TEXT NOT NULL,      -- JSON string
                state_digest TEXT NOT NULL,
                UNIQUE(node_id, seq)
            )""")
        conn.commit()


init_db()


def load_chain(conn, node_id: str) -> list[Entry]:
    import json
    rows = conn.execute(
        "SELECT * FROM entries WHERE node_id=? ORDER BY seq ASC", (node_id,)
    ).fetchall()
    return [Entry(id=r["id"], parent_id=r["parent_id"], node_id=r["node_id"],
                  seq=r["seq"], ts=r["ts"], payload=json.loads(r["payload"]),
                  state_digest=r["state_digest"]) for r in rows]


class PushBody(BaseModel):
    node_id: str
    entries: list[dict]


@app.get("/head")
def head(node_id: str):
    with closing(db()) as conn:
        row = conn.execute(
            "SELECT MAX(seq) AS s FROM entries WHERE node_id=?", (node_id,)
        ).fetchone()
    return {"node_id": node_id, "seq": row["s"] if row["s"] is not None else -1}


@app.get("/entries")
def entries(node_id: str, after_seq: int = -1):
    with closing(db()) as conn:
        chain = load_chain(conn, node_id)
    return {"entries": [e.to_dict() for e in chain if e.seq > after_seq]}


@app.post("/push")
def push(body: PushBody):
    import json
    incoming = [Entry.from_dict(d) for d in body.entries]
    if any(e.node_id != body.node_id for e in incoming):
        raise HTTPException(400, "node_id mismatch in entries")
    incoming.sort(key=lambda e: e.seq)

    with closing(db()) as conn:
        existing = load_chain(conn, body.node_id)
        existing_seq = existing[-1].seq if existing else -1

        # only accept entries that extend the stored chain (no gaps, no rewrite)
        new = [e for e in incoming if e.seq > existing_seq]
        if not new:
            return {"accepted": 0, "head_seq": existing_seq}
        if new[0].seq != existing_seq + 1:
            raise HTTPException(409, f"gap: have head {existing_seq}, got {new[0].seq}")

        # re-verify the FULL chain (existing + new) before committing anything
        ok, err = verify_chain(existing + new)
        if not ok:
            raise HTTPException(422, f"chain verification failed: {err}")

        for e in new:
            conn.execute(
                "INSERT INTO entries(id,parent_id,node_id,seq,ts,payload,state_digest)"
                " VALUES(?,?,?,?,?,?,?)",
                (e.id, e.parent_id, e.node_id, e.seq, e.ts,
                 json.dumps(e.payload, sort_keys=True), e.state_digest))
        conn.commit()
    return {"accepted": len(new), "head_seq": new[-1].seq}


@app.get("/verify")
def verify(node_id: str):
    with closing(db()) as conn:
        chain = load_chain(conn, node_id)
    ok, err = verify_chain(chain)
    return {"node_id": node_id, "length": len(chain), "valid": ok, "error": err}


@app.get("/nodes")
def nodes():
    with closing(db()) as conn:
        rows = conn.execute(
            "SELECT node_id, MAX(seq) AS head, COUNT(*) AS n "
            "FROM entries GROUP BY node_id").fetchall()
    return {"nodes": [dict(r) for r in rows]}
