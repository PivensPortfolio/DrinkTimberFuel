// Store open/closed flag. GET is public (customer site reads it). POST is admin-only (toggle).
async function kv(cmd){
  const url=process.env.KV_REST_API_URL, tok=process.env.KV_REST_API_TOKEN;
  if(!url||!tok) return { result:null, _noKv:true };
  try{
    const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
    return await r.json();
  }catch(e){ return { result:null, _err:String(e) }; }
}
async function readDeliveryMinutes(){
  const dm=await kv(['GET','delivery_minutes']);
  const n=dm && dm.result!=null ? parseInt(dm.result,10) : NaN;
  return (isFinite(n) && n>0) ? n : 30;   // default 30 minutes until set in admin
}
// hours of operation — two windows shown in the hero, editable from the admin
const DEFAULT_HOURS=[
  { label:'Morning Fuel', value:'6:00–7:45 AM' },
  { label:'Midday Fuel',  value:'11:00 AM–12:15 PM' }
];
async function readHours(){
  const r=await kv(['GET','hours']);
  try{ const h=r && r.result ? JSON.parse(r.result) : null; if(Array.isArray(h) && h.length) return h; }catch(e){}
  return DEFAULT_HOURS;
}
function sanitizeHours(input){
  if(!Array.isArray(input)) return null;
  const out=input.slice(0,2).map(h=>({
    label: String((h&&h.label)||'').slice(0,40).trim(),
    value: String((h&&h.value)||'').slice(0,40).trim()
  })).filter(h=>h.label || h.value);
  return out.length ? out : null;
}
module.exports = async (req,res)=>{
  if(req.method==='GET'){
    const r=await kv(['GET','store_open']);
    const open = !(r && r.result==='0');   // default OPEN unless explicitly closed
    const deliveryMinutes = await readDeliveryMinutes();
    const hours = await readHours();
    res.status(200).json({ open, deliveryMinutes, hours });
    return;
  }
  if(req.method==='POST'){
    const pass=process.env.ADMIN_PASSWORD||'';
    if(!pass || (req.headers['x-admin-pass']||'')!==pass){ res.status(401).json({ ok:false, error:'unauthorized' }); return; }
    let body=req.body; if(typeof body==='string'){ try{ body=JSON.parse(body); }catch(e){ body={}; } }
    body=body||{};
    // partial updates: toggle open and/or set the delivery ETA (5–60 min, 5-min steps)
    if(typeof body.open!=='undefined'){ await kv(['SET','store_open', body.open?'1':'0']); }
    if(typeof body.deliveryMinutes!=='undefined'){
      let dm=parseInt(body.deliveryMinutes,10); if(!isFinite(dm)) dm=30;
      dm=Math.max(5, Math.min(60, Math.round(dm/5)*5));
      await kv(['SET','delivery_minutes', String(dm)]);
    }
    if(typeof body.hours!=='undefined'){
      const h=sanitizeHours(body.hours);
      if(h) await kv(['SET','hours', JSON.stringify(h)]);
    }
    const or=await kv(['GET','store_open']); const open=!(or && or.result==='0');
    const deliveryMinutes=await readDeliveryMinutes();
    const hours=await readHours();
    res.status(200).json({ ok:true, open, deliveryMinutes, hours });
    return;
  }
  res.status(405).json({ error:'method not allowed' });
};
