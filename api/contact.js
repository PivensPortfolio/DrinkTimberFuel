// Contact form. POST (public) submits a message; GET (admin) lists; POST {action:'dismiss'} (admin) removes one.
async function kv(cmd){
  const url=process.env.KV_REST_API_URL, tok=process.env.KV_REST_API_TOKEN;
  if(!url||!tok) return { result:null, _noKv:true };
  try{
    const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
    return await r.json();
  }catch(e){ return { result:null, _err:String(e) }; }
}
function admin(req){ const p=process.env.ADMIN_PASSWORD||''; return !!p && (req.headers['x-admin-pass']||'')===p; }
function readMsgs(r){ try{ return r && r.result ? JSON.parse(r.result) : []; }catch(e){ return []; } }

module.exports = async (req,res)=>{
  if(req.method==='GET'){
    if(!admin(req)){ res.status(401).json({ ok:false, error:'unauthorized' }); return; }
    res.status(200).json({ ok:true, messages: readMsgs(await kv(['GET','messages'])) });
    return;
  }
  if(req.method==='POST'){
    let body=req.body; if(typeof body==='string'){ try{ body=JSON.parse(body); }catch(e){ body={}; } }
    body=body||{};

    if(body.action==='dismiss'){
      if(!admin(req)){ res.status(401).json({ ok:false, error:'unauthorized' }); return; }
      let msgs=readMsgs(await kv(['GET','messages'])).filter(m=>m.id!==body.id);
      await kv(['SET','messages', JSON.stringify(msgs)]);
      res.status(200).json({ ok:true, messages:msgs });
      return;
    }

    // public submit
    if(body.company){ res.status(200).json({ ok:true }); return; } // honeypot filled → silently drop
    const name=String(body.name||'').trim(), email=String(body.email||'').trim(), message=String(body.message||'').trim();
    if(!name || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
      res.status(400).json({ ok:false, error:'Please fill in all fields with a valid email.' }); return;
    }
    const rec={ id:'m'+Date.now()+Math.random().toString(16).slice(2,6), ts:Date.now(), name:name.slice(0,80), email:email.slice(0,120), message:message.slice(0,2000) };
    try{
      let msgs=readMsgs(await kv(['GET','messages']));
      msgs.unshift(rec); msgs=msgs.slice(0,100);
      await kv(['SET','messages', JSON.stringify(msgs)]);
    }catch(e){ res.status(500).json({ ok:false, error:'Could not send your message. Please try again.' }); return; }
    res.status(200).json({ ok:true });
    return;
  }
  res.status(405).json({ error:'method not allowed' });
};
