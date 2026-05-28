# Recursive Memory — local (git) ↔ central (database)

A defensible, append-only memory store. Each local node keeps a **hash-chained**
log (every state commits to its parent, like git/Merkle logs), git-commits every
append for full local history, and syncs with a **central database** that is the
shared source of truth and re-verifies every chain before storing it.

"Recursive" = `state(n) = f(input, state(n−1))`: each entry carries a
`state_digest` folded from the previous entry's digest plus its own id, so the
chain's head is a function of its entire history. Tamper any past entry and every
id after it changes — the same property that makes git and blockchains
tamper-evident.

## Scope (honest)
- "Memory" = stored state with verifiable lineage. Nothing sentient.
- The hash chain proves **integrity and ordering**, not truth of content.
- Default conflict policy is append-only, no-gap, no-rewrite (last-writer cannot
  silently overwrite history). Multi-writer-per-node merging is out of scope here.

## Files
- `recursive_memory/core.py` — shared Entry model + chain verification (no deps)
- `recursive_memory/local_node.py` — git-backed local node + push/pull client
- `recursive_memory/central_server.py` — FastAPI + SQLite source of truth
- `test_e2e.py` — end-to-end test (append → git → push → multi-node → restore → tamper)

## Run
```bash
pip install -r requirements.txt
# start central
uvicorn recursive_memory.central_server:app --port 8000
# (Postgres in prod: keep the schema, swap sqlite3 for psycopg; the chain logic is DB-agnostic)
```

```python
from recursive_memory.local_node import LocalNode
node = LocalNode("node-A", "./node_a_repo", central_url="http://localhost:8000")
node.append({"text": "first memory"})
node.push()     # send local-only entries up
node.pull()     # restore/catch up from central (verifies before accepting)
node.verify()   # (ok, error) for the local chain
```

## What the test proves
1. appends are git-committed and hash-chained
2. push transfers only new entries; central re-verifies
3. multiple nodes keep independent chains under one central DB
4. a wiped node fully restores from central, chain intact
5. a forged entry is rejected — integrity guarantee holds
