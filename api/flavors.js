// Flavors config. GET is public (customer site reads it to build the flavor-pump lists).
// POST is admin-only (x-admin-pass === ADMIN_PASSWORD) and saves the edited config to KV key `flavors`.
// Mirrors the KV helper + admin-auth conventions used by store.js / orders.js / contact.js.
async function kv(cmd){
  const url=process.env.KV_REST_API_URL, tok=process.env.KV_REST_API_TOKEN;
  if(!url||!tok) return { result:null, _noKv:true };
  try{
    const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
    return await r.json();
  }catch(e){ return { result:null, _err:String(e) }; }
}

// DEFAULT seeded from the site's current hardcoded values so the site never breaks
// if KV is empty/unset. Kept in sync with the fallback defaults in index.html.
const DEFAULT_FLAVORS = {
  pumpPrice: 0.25,
  builderFlavors: [
    { name:'Cinnamon',                  sugarFree:false, soldOut:false },
    { name:'Chocolate',                 sugarFree:false, soldOut:false },
    { name:'Caramel',                   sugarFree:false, soldOut:false },
    { name:'Toasted Marshmallow',       sugarFree:false, soldOut:false },
    { name:'Vanilla',                   sugarFree:false, soldOut:false },
    { name:'French Vanilla',            sugarFree:false, soldOut:false },
    { name:'Hazelnut',                  sugarFree:false, soldOut:false },
    { name:'Pumpkin Spice',             sugarFree:false, soldOut:false },
    { name:'Sugar-Free Vanilla',        sugarFree:true,  soldOut:false },
    { name:'Sugar-Free Caramel',        sugarFree:true,  soldOut:false },
    { name:'Sugar-Free Hazelnut',       sugarFree:true,  soldOut:false },
    { name:'Sugar-Free French Vanilla', sugarFree:true,  soldOut:false },
    { name:'Sugar-Free Mocha',          sugarFree:true,  soldOut:false }
  ],
  // Refreshers get their OWN flavor list (fruit/candy), separate from the coffee builder list.
  // Seeded with the current 'Flavor 1/2/3' placeholders so behavior is unchanged until edited.
  refresherFlavors: [
    { name:'Flavor 1', soldOut:false },
    { name:'Flavor 2', soldOut:false },
    { name:'Flavor 3', soldOut:false }
  ],
  // Per-specialty signature flavors — pre-loaded (included in price) as pumps for that drink.
  specialtyFlavors: {
    'Campfire Mocha':                    ['Chocolate','Toasted Marshmallow'],
    'French Hazelnut Café':              ['Hazelnut','French Vanilla'],
    'Toasted Marshmallow Pumpkin Cocoa': ['Chocolate','Toasted Marshmallow','Pumpkin Spice'],
    'Cinnamon Roll Latte':               ['Cinnamon','Vanilla'],
    'Autumn Velvet Latte':               ['Hazelnut','Pumpkin Spice'],
    'Golden Caramel Macchiato':          ['Caramel','Vanilla']
  }
};

function str(v,max){ return String(v==null?'':v).slice(0,max).trim(); }

// Defensive: build a clean, bounded config from arbitrary admin input.
function sanitize(input){
  input = input && typeof input==='object' ? input : {};
  const pp = Number(input.pumpPrice);
  const pumpPrice = (isFinite(pp) && pp>=0 && pp<=100) ? Math.round(pp*100)/100 : DEFAULT_FLAVORS.pumpPrice;

  const seen=new Set();
  const builderFlavors=(Array.isArray(input.builderFlavors)?input.builderFlavors:[])
    .map(f=>{ if(typeof f==='string') f={name:f}; f=f||{}; return { name:str(f.name,60), sugarFree:!!f.sugarFree, soldOut:!!f.soldOut }; })
    .filter(f=>f.name && !seen.has(f.name.toLowerCase()) && seen.add(f.name.toLowerCase()))
    .slice(0,60);

  const rseen=new Set();
  const refresherFlavors=(Array.isArray(input.refresherFlavors)?input.refresherFlavors:[])
    .map(f=>{ if(typeof f==='string') f={name:f}; f=f||{}; return { name:str(f.name,60), soldOut:!!f.soldOut }; })
    .filter(f=>f.name && !rseen.has(f.name.toLowerCase()) && rseen.add(f.name.toLowerCase()))
    .slice(0,40);

  const specialtyFlavors={};
  const sf=(input.specialtyFlavors && typeof input.specialtyFlavors==='object') ? input.specialtyFlavors : {};
  Object.keys(sf).slice(0,40).forEach(k=>{
    const name=str(k,80); if(!name) return;
    const arr=Array.isArray(sf[k])?sf[k]:[];
    const cseen=new Set();
    specialtyFlavors[name]=arr.map(x=>str(x,60)).filter(x=>x && !cseen.has(x.toLowerCase()) && cseen.add(x.toLowerCase())).slice(0,20);
  });

  return { pumpPrice, builderFlavors, refresherFlavors, specialtyFlavors };
}

module.exports = async (req,res)=>{
  if(req.method==='GET'){
    const r=await kv(['GET','flavors']);
    let cfg=null; try{ cfg = r && r.result ? JSON.parse(r.result) : null; }catch(e){ cfg=null; }
    // return the stored config if it looks valid, otherwise the seeded default
    res.status(200).json(cfg && Array.isArray(cfg.builderFlavors) && cfg.builderFlavors.length ? cfg : DEFAULT_FLAVORS);
    return;
  }
  if(req.method==='POST'){
    const pass=process.env.ADMIN_PASSWORD||'';
    if(!pass || (req.headers['x-admin-pass']||'')!==pass){ res.status(401).json({ ok:false, error:'unauthorized' }); return; }
    let body=req.body; if(typeof body==='string'){ try{ body=JSON.parse(body); }catch(e){ body={}; } }
    const cfg=sanitize(body||{});
    if(!cfg.builderFlavors.length){ res.status(400).json({ ok:false, error:'Add at least one builder flavor before saving.' }); return; }
    await kv(['SET','flavors', JSON.stringify(cfg)]);
    res.status(200).json({ ok:true, flavors:cfg });
    return;
  }
  res.status(405).json({ error:'method not allowed' });
};
