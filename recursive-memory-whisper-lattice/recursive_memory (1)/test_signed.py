import os,shutil,time,threading,tempfile,uvicorn,requests
os.environ["RMEM_DB"]="/tmp/rmem/test_signed.db"
if os.path.exists(os.environ["RMEM_DB"]):os.remove(os.environ["RMEM_DB"])
from recursive_memory import central_server
from recursive_memory.local_node import LocalNode
from recursive_memory.core import Entry, verify_chain
from recursive_memory import identity
central_server.init_db()
cfg=uvicorn.Config(central_server.app,host="127.0.0.1",port=8078,log_level="error")
srv=uvicorn.Server(cfg);threading.Thread(target=srv.run,daemon=True).start()
URL="http://127.0.0.1:8078"
for _ in range(50):
    try:
        if requests.get(URL+"/stats",timeout=1).ok:break
    except:time.sleep(0.1)

print("=== signed node ===")
repo=tempfile.mkdtemp()
A=LocalNode("node-signed",repo,central_url=URL)
print("  keypair generated; pub:",A.public_key[:16],"...")
print("  register key:",A.register_key())
for t in ["alpha","beta","gamma"]:A.append({"text":t})
print("  push:",A.push())
v=requests.get(URL+"/verify",params={"node_id":"node-signed"}).json()
print("  central verify:",v)
assert v["valid"] and v["signed"],"signed chain must verify"

print("\n=== signature forgery rejected ===")
# build a valid entry then break its signature, push directly
import json
chain=A.entries
forged=Entry.from_dict(chain[-1].to_dict())
# make a NEW valid-id entry but sign with a different (wrong) key
other_priv,_=identity.generate_keypair()
e=Entry.create(chain[-1],"node-signed",{"text":"forged"},chain[-1].state_digest,
               signer=lambda eid: identity.sign(other_priv,eid))
try:
    r=requests.post(URL+"/push",json={"node_id":"node-signed","entries":[e.to_dict()]})
    print("  push status:",r.status_code,"->",r.json().get("detail","ok"))
    assert r.status_code==422,"forged signature must be rejected"
    print("  ✓ rejected as expected")
except AssertionError as ae:
    print("  FAIL:",ae)

print("\n=== dashboard served ===")
html=requests.get(URL+"/").text
print("  GET / returns HTML:",("Operator Console" in html), "· bytes:",len(html))

print("\n=== local verify with key ===")
ok,err=verify_chain(A.entries,public_key=A.public_key)
print("  local signed verify:",ok,err)

print("\nALL SIGNED CHECKS COMPLETE")
srv.should_exit=True
