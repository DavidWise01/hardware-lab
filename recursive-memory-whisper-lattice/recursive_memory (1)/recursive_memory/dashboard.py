"""Dashboard HTML for the central server. Pure static HTML/JS, talks to the API."""

DASHBOARD_HTML = r"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Recursive Memory — Operator Console</title>
<style>
:root{--bg:#060810;--ink:#e9eef6;--body:#aab6c8;--dim:#647793;--dimmer:#27344a;
--ok:#48f0a6;--bad:#ff5d6e;--cyan:#46e6ff;--gold:#ffd166;--violet:#9b7bff;
--line:rgba(70,230,255,.13);--panel:rgba(12,18,30,.8);
--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--sans:Inter,system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;font-family:var(--sans);color:var(--ink);
background:radial-gradient(120% 60% at 50% -10%,rgba(70,230,255,.06),transparent 50%),
radial-gradient(50% 50% at 88% 8%,rgba(155,123,255,.05),transparent 55%),
linear-gradient(180deg,#070a14,#060810 60%,#04060c);min-height:100vh}
header{border-bottom:1px solid var(--line);background:rgba(6,8,16,.85);backdrop-filter:blur(12px);position:sticky;top:0;z-index:10}
.hbar{max-width:1200px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 22px}
.brand{font-family:var(--mono);font-weight:600;letter-spacing:.1em;font-size:12px;color:var(--cyan);text-transform:uppercase}
.stat{display:flex;gap:18px;font-family:var(--mono);font-size:11px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}
.stat b{color:var(--cyan)}
.wrap{max-width:1200px;margin:0 auto;padding:24px 22px 80px}
.grid{display:grid;grid-template-columns:280px 1fr;gap:18px;align-items:start}
@media(max-width:860px){.grid{grid-template-columns:1fr}}
.card{border:1px solid var(--line);border-radius:12px;background:var(--panel);overflow:hidden}
.card h3{margin:0;padding:12px 15px;font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);background:rgba(70,230,255,.03)}
.card .body{padding:14px 15px}
.nodelist{display:flex;flex-direction:column;gap:7px}
.node{border:1px solid var(--dimmer);border-radius:9px;padding:11px 12px;cursor:pointer;transition:.12s;background:rgba(8,14,24,.5)}
.node:hover{border-color:var(--line)}
.node.active{border-color:var(--cyan);background:rgba(70,230,255,.08);box-shadow:0 0 14px rgba(70,230,255,.18)}
.node .nm{font-family:var(--mono);font-size:13px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:7px}
.node .meta{font-family:var(--mono);font-size:10px;color:var(--dim);margin-top:4px}
.lock{font-size:10px}.lock.signed{color:var(--ok)}.lock.unsigned{color:var(--gold)}
.verifybadge{display:inline-block;font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-left:auto}
.verifybadge.ok{background:rgba(72,240,166,.14);color:var(--ok)}
.verifybadge.bad{background:rgba(255,93,110,.14);color:var(--bad)}
.chainwrap{max-height:560px;overflow:auto}
.entry{border-bottom:1px solid rgba(70,230,255,.06);padding:12px 15px;font-family:var(--mono);font-size:12px}
.entry:last-child{border-bottom:none}
.entry .top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.seq{color:var(--violet);font-weight:600}
.hash{color:var(--cyan)}
.arrow{color:var(--dimmer)}
.ts{color:var(--dim);font-size:10px;margin-left:auto}
.payload{margin-top:7px;color:var(--body);background:rgba(8,14,24,.6);border:1px solid var(--dimmer);border-radius:7px;padding:8px 10px;white-space:pre-wrap;word-break:break-word}
.sig{margin-top:6px;font-size:10px;color:var(--dim)}
.sig b.ok{color:var(--ok)}.sig b.bad{color:var(--bad)}
.empty{padding:40px 15px;text-align:center;color:var(--dim);font-family:var(--mono);font-size:12px}
.btnrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
button{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--cyan);
background:rgba(70,230,255,.06);border:1px solid var(--cyan);border-radius:6px;padding:8px 13px;cursor:pointer;transition:.12s}
button:hover{background:rgba(70,230,255,.16)}
button.ghost{color:var(--dim);border-color:var(--dimmer);background:transparent}
.note{font-size:11px;color:var(--dim);font-family:var(--mono);line-height:1.6;margin-top:10px}
.flowbar{height:6px;border-radius:3px;background:rgba(70,230,255,.1);overflow:hidden;margin-top:8px}
.flowbar i{display:block;height:100%;background:linear-gradient(90deg,var(--violet),var(--cyan),var(--ok))}
</style></head>
<body>
<header><div class="hbar">
  <div class="brand">⛓ Recursive Memory · Operator Console</div>
  <div class="stat">
    <span>entries <b id="s-entries">0</b></span>
    <span>nodes <b id="s-nodes">0</b></span>
    <span>keys pinned <b id="s-keys">0</b></span>
    <span id="s-live" style="color:var(--ok)">● live</span>
  </div>
</div></header>

<div class="wrap"><div class="grid">
  <div class="card">
    <h3>Nodes</h3>
    <div class="body">
      <div class="nodelist" id="nodelist"><div class="empty">loading…</div></div>
      <div class="btnrow"><button class="ghost" id="refresh">↻ refresh</button></div>
      <div class="note">Click a node to inspect its chain. The lock shows whether its entries are cryptographically signed (🔒 signed) or only hash-chained (🔓 unsigned). "Verify" re-checks integrity, lineage, recursive digest, and signatures on the server.</div>
    </div>
  </div>

  <div class="card">
    <h3 id="chain-title">Chain — select a node</h3>
    <div class="body" style="padding:0">
      <div id="chainmeta" style="padding:13px 15px;border-bottom:1px solid var(--line);display:none">
        <div class="btnrow" style="margin:0">
          <button id="verify">✓ verify chain</button>
          <span class="verifybadge" id="vbadge" style="display:none"></span>
        </div>
        <div class="flowbar"><i id="flow" style="width:0%"></i></div>
        <div class="note" id="chaindesc"></div>
      </div>
      <div class="chainwrap" id="chain"><div class="empty">no node selected</div></div>
    </div>
  </div>
</div></div>

<script>
const $=id=>document.getElementById(id);
let activeNode=null, nodesCache=[];

async function jget(u){const r=await fetch(u);if(!r.ok)throw new Error(r.status);return r.json();}

async function loadStats(){
  try{const s=await jget('/stats');
    $('s-entries').textContent=s.entries;$('s-nodes').textContent=s.nodes;$('s-keys').textContent=s.keys_pinned;
    $('s-live').style.color='var(--ok)';$('s-live').textContent='● live';
  }catch(e){$('s-live').style.color='var(--bad)';$('s-live').textContent='● offline';}
}

async function loadNodes(){
  try{
    const data=await jget('/nodes');nodesCache=data.nodes;
    const el=$('nodelist');
    if(!data.nodes.length){el.innerHTML='<div class="empty">no nodes yet — push some entries</div>';return;}
    el.innerHTML='';
    data.nodes.forEach(n=>{
      const signed=!!n.pubkey;
      const d=document.createElement('div');
      d.className='node'+(activeNode===n.node_id?' active':'');
      d.innerHTML=`<div class="nm"><span class="lock ${signed?'signed':'unsigned'}">${signed?'🔒':'🔓'}</span>${n.node_id}</div>
        <div class="meta">head seq ${n.head} · ${n.n} entries · ${signed?'signed':'unsigned'}</div>`;
      d.onclick=()=>selectNode(n.node_id);
      el.appendChild(d);
    });
  }catch(e){$('nodelist').innerHTML='<div class="empty" style="color:var(--bad)">cannot reach server</div>';}
}

async function selectNode(id){
  activeNode=id;loadNodes();
  $('chain-title').textContent='Chain — '+id;
  $('chainmeta').style.display='block';
  $('vbadge').style.display='none';
  const node=nodesCache.find(n=>n.node_id===id);
  const signed=node&&node.pubkey;
  $('chaindesc').innerHTML=signed
    ? 'Signed node. Each entry is Ed25519-signed; the server can prove <b>who</b> wrote it. Public key pinned (trust-on-first-use).'
    : 'Unsigned node — hash-chained only. Integrity and order are verifiable, authorship is not. Register a key to upgrade.';
  const data=await jget('/entries?node_id='+encodeURIComponent(id)+'&after_seq=-1');
  renderChain(data.entries,signed);
}

function shorten(h){return h?h.slice(0,10):'—';}
function renderChain(entries,signed){
  const el=$('chain');
  if(!entries.length){el.innerHTML='<div class="empty">empty chain</div>';return;}
  el.innerHTML='';
  entries.forEach(e=>{
    const d=document.createElement('div');d.className='entry';
    const payloadStr=JSON.stringify(e.payload,null,1);
    d.innerHTML=`<div class="top">
        <span class="seq">#${e.seq}</span>
        <span class="hash">${shorten(e.id)}</span>
        <span class="arrow">◂ parent</span>
        <span class="hash">${shorten(e.parent_id)}</span>
        <span class="ts">${new Date(e.ts*1000).toLocaleString()}</span>
      </div>
      <div class="payload">${escapeHtml(payloadStr)}</div>
      <div class="sig">state ${shorten(e.state_digest)} · ${signed?('sig '+(e.signature?'<b class="ok">present</b>':'<b class="bad">missing</b>')):'<span style="color:var(--gold)">unsigned</span>'}</div>`;
    el.appendChild(d);
  });
}
function escapeHtml(s){return s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

$('verify').onclick=async()=>{
  if(!activeNode)return;
  const flow=$('flow');flow.style.width='30%';
  const r=await jget('/verify?node_id='+encodeURIComponent(activeNode));
  flow.style.width='100%';setTimeout(()=>flow.style.width='0%',600);
  const b=$('vbadge');b.style.display='inline-block';
  if(r.valid){b.className='verifybadge ok';b.textContent='✓ valid · '+r.length+' entries'+(r.signed?' · signed':'');}
  else{b.className='verifybadge bad';b.textContent='✗ '+(r.error||'invalid');}
};
$('refresh').onclick=()=>{loadStats();loadNodes();if(activeNode)selectNode(activeNode);};

loadStats();loadNodes();
setInterval(()=>{loadStats();loadNodes();},4000);
</script>
</body></html>
"""
