// Admin-only. Returns the archive of completed (DONE) orders from the `receipts` Redis list.
// Populated by orders.js when an order is marked done. Mirrors the KV/auth conventions.
async function kv(cmd){
  const url=process.env.KV_REST_API_URL, tok=process.env.KV_REST_API_TOKEN;
  if(!url||!tok) return { result:null, _noKv:true };
  try{
    const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
    return await r.json();
  }catch(e){ return { result:null, _err:String(e) }; }
}
module.exports = async (req,res)=>{
  const pass=process.env.ADMIN_PASSWORD||'';
  if(!pass || (req.headers['x-admin-pass']||'')!==pass){ res.status(401).json({ ok:false, error:'unauthorized' }); return; }
  if(req.method==='GET'){
    const r=await kv(['LRANGE','receipts',0,4999]);   // newest first (LPUSH)
    const raw=(r && Array.isArray(r.result)) ? r.result : [];
    const receipts=raw.map(s=>{ try{ return JSON.parse(s); }catch(e){ return null; } }).filter(Boolean);
    res.status(200).json({ ok:true, receipts });
    return;
  }
  // POST {action:'clear'} — wipes the receipt archive. Destructive: used to purge test data
  // before going live. The admin UI confirms before calling this.
  if(req.method==='POST'){
    let body=req.body; if(typeof body==='string'){ try{ body=JSON.parse(body); }catch(e){ body={}; } }
    if((body||{}).action!=='clear'){ res.status(400).json({ ok:false, error:'bad request' }); return; }
    await kv(['DEL','receipts']);
    res.status(200).json({ ok:true, receipts:[] });
    return;
  }
  res.status(405).json({ error:'method not allowed' });
};
