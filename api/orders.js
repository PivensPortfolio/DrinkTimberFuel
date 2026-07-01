// Admin-only. GET lists active orders; POST {action:'done'|'cancel', id} dismisses one.
async function kv(cmd){
  const url=process.env.KV_REST_API_URL, tok=process.env.KV_REST_API_TOKEN;
  if(!url||!tok) return { result:null, _noKv:true };
  try{
    const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
    return await r.json();
  }catch(e){ return { result:null, _err:String(e) }; }
}
function readOrders(r){ try{ return r && r.result ? JSON.parse(r.result) : []; }catch(e){ return []; } }

module.exports = async (req,res)=>{
  const pass=process.env.ADMIN_PASSWORD||'';
  if(!pass || (req.headers['x-admin-pass']||'')!==pass){ res.status(401).json({ ok:false, error:'unauthorized' }); return; }

  if(req.method==='GET'){
    const orders = readOrders(await kv(['GET','orders']));
    res.status(200).json({ ok:true, orders });
    return;
  }
  if(req.method==='POST'){
    let body=req.body; if(typeof body==='string'){ try{ body=JSON.parse(body); }catch(e){ body={}; } }
    const { action, id } = body||{};
    if(!id || (action!=='done' && action!=='cancel')){ res.status(400).json({ ok:false, error:'bad request' }); return; }
    let orders = readOrders(await kv(['GET','orders']));
    orders = orders.filter(o=>o.id!==id);   // done + cancel both dismiss from the active queue
    await kv(['SET','orders', JSON.stringify(orders)]);
    res.status(200).json({ ok:true, orders });
    return;
  }
  res.status(405).json({ error:'method not allowed' });
};
