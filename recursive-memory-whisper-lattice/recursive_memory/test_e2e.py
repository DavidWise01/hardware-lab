"""End-to-end: local git-backed nodes <-> central server, with tamper test."""
import os, shutil, time, threading, tempfile
import uvicorn, requests
from recursive_memory.local_node import LocalNode
from recursive_memory.core import verify_chain, Entry

# fresh DB
DB="/tmp/rmem/test_central.db"
if os.path.exists(DB): os.remove(DB)
os.environ["RMEM_DB"]=DB
from recursive_memory import central_server
central_server.init_db()

# start server in a thread
cfg=uvicorn.Config(central_server.app, host="127.0.0.1", port=8077, log_level="error")
server=uvicorn.Server(cfg)
t=threading.Thread(target=server.run, daemon=True); t.start()
for _ in range(50):
    try:
        if requests.get("http://127.0.0.1:8077/nodes",timeout=1).ok: break
    except Exception: time.sleep(0.1)
URL="http://127.0.0.1:8077"

print("=== 1. local node appends (git-backed) ===")
repo=tempfile.mkdtemp(prefix="nodeA_")
A=LocalNode("node-A", repo, central_url=URL)
for txt in ["wake","observe","reflect","return"]:
    e=A.append({"text":txt})
    print(f"  appended seq={e.seq} id={e.id[:8]} state={e.state_digest[:8]}")
ok,err=A.verify(); print("  local chain valid:",ok)

import subprocess
log=subprocess.run(["git","log","--oneline"],cwd=repo,capture_output=True,text=True).stdout.strip().splitlines()
print(f"  git commits: {len(log)} (genesis + 4 appends expected)")

print("\n=== 2. push to central ===")
print("  ",A.push())
print("  central head:",requests.get(f"{URL}/head",params={"node_id":"node-A"}).json())
print("  central verify:",requests.get(f"{URL}/verify",params={"node_id":"node-A"}).json())

print("\n=== 3. second node, independent chain ===")
repoB=tempfile.mkdtemp(prefix="nodeB_")
B=LocalNode("node-B", repoB, central_url=URL)
B.append({"text":"node B first"}); B.append({"text":"node B second"})
print("  ",B.push())
print("  nodes on central:",requests.get(f"{URL}/nodes").json())

print("\n=== 4. pull-restore: wipe node-A repo, rebuild from central ===")
shutil.rmtree(repo); repo2=tempfile.mkdtemp(prefix="nodeA_restored_")
A2=LocalNode("node-A", repo2, central_url=URL)
print("  before pull, local entries:",len(A2.entries))
print("  ",A2.pull())
print("  after pull, local entries:",len(A2.entries))
ok,err=A2.verify(); print("  restored chain valid:",ok)

print("\n=== 5. tamper test: server must reject a forged entry ===")
# forge an entry whose payload was changed after id was computed
genuine=A2.entries[1]
forged=Entry.from_dict(genuine.to_dict())
forged.payload={"text":"TAMPERED"}   # id no longer matches content
chain=[A2.entries[0],forged]+A2.entries[2:]
ok,err=verify_chain(chain)
print("  local verify_chain on tampered data:",ok,"->",err)

print("\nALL CHECKS COMPLETE")
server.should_exit=True
