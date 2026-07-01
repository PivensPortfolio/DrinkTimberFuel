// Places a CASH order (pay on delivery / at pickup) — no card charge.
// Only accepts orders while the store is open. Writes to the same KV order queue.
async function kv(cmd){
  const url=process.env.KV_REST_API_URL, tok=process.env.KV_REST_API_TOKEN;
  if(!url||!tok) return { result:null, _noKv:true };
  try{
    const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
    return await r.json();
  }catch(e){ return { result:null, _err:String(e) }; }
}
function getIp(req){ return (req.headers['x-forwarded-for']||'').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown'; }
async function rateLimit(ip, prefix, limit, windowSec){
  const key='rl:'+prefix+':'+ip;
  const c=await kv(['INCR', key]);
  const n=(c && typeof c.result==='number') ? c.result : 1;
  if(n===1){ await kv(['EXPIRE', key, windowSec]); }
  return n<=limit;
}
module.exports = async (req,res)=>{
  if(req.method!=='POST'){ res.status(405).json({ ok:false, error:'method not allowed' }); return; }

  const s=await kv(['GET','store_open']);
  if(s && s.result==='0'){ res.status(403).json({ ok:false, error:'Online ordering is currently closed.' }); return; }

  let body=req.body; if(typeof body==='string'){ try{ body=JSON.parse(body); }catch(e){ body={}; } }
  body=body||{};
  // bot defenses: too-fast submit + per-IP rate limit
  const startedAt=Number(body.startedAt||0);
  if(!startedAt || (Date.now()-startedAt) < 2000){ res.status(200).json({ ok:true, id:'noop' }); return; }
  if(!(await rateLimit(getIp(req), 'order', 10, 3600))){
    res.status(429).json({ ok:false, error:'Too many orders from your connection. Please try again shortly.' }); return;
  }
  const order=(body && body.order) || {};
  if(!order.name || !order.phone || !Array.isArray(order.items) || !order.items.length){
    res.status(400).json({ ok:false, error:'Missing order details.' }); return;
  }
  const rec={
    id: 'c' + Date.now() + Math.random().toString(16).slice(2,6),
    ts: Date.now(), status:'new', paymentMethod:'cash', paid:false,
    name: String(order.name).slice(0,80),
    phone: String(order.phone).slice(0,40),
    mode: order.mode==='delivery' ? 'delivery' : 'pickup',
    address: order.address ? String(order.address).slice(0,200) : '',
    items: order.items.slice(0,40),
    subtotal: order.subtotal||null, delivery: order.delivery||0, tip: order.tip||0, total: order.total||null
  };
  try{
    const g=await kv(['GET','orders']);
    let arr=[]; try{ arr = g && g.result ? JSON.parse(g.result) : []; }catch(e){ arr=[]; }
    arr.unshift(rec); arr=arr.slice(0,100);
    await kv(['SET','orders', JSON.stringify(arr)]);
  }catch(e){ res.status(500).json({ ok:false, error:'Could not save your order.' }); return; }
  res.status(200).json({ ok:true, id:rec.id });
};
