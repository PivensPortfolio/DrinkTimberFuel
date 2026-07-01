// Store open/closed flag. GET is public (customer site reads it). POST is admin-only (toggle).
async function kv(cmd){
  const url=process.env.KV_REST_API_URL, tok=process.env.KV_REST_API_TOKEN;
  if(!url||!tok) return { result:null, _noKv:true };
  try{
    const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
    return await r.json();
  }catch(e){ return { result:null, _err:String(e) }; }
}
module.exports = async (req,res)=>{
  if(req.method==='GET'){
    const r=await kv(['GET','store_open']);
    const open = !(r && r.result==='0');   // default OPEN unless explicitly closed
    res.status(200).json({ open });
    return;
  }
  if(req.method==='POST'){
    const pass=process.env.ADMIN_PASSWORD||'';
    if(!pass || (req.headers['x-admin-pass']||'')!==pass){ res.status(401).json({ ok:false, error:'unauthorized' }); return; }
    let body=req.body; if(typeof body==='string'){ try{ body=JSON.parse(body); }catch(e){ body={}; } }
    const open = !!(body && body.open);
    await kv(['SET','store_open', open?'1':'0']);
    res.status(200).json({ ok:true, open });
    return;
  }
  res.status(405).json({ error:'method not allowed' });
};
