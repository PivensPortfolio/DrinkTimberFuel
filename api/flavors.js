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
  // Per-specialty drinks keyed by a STABLE id so the display name can be renamed in
  // the admin (the id keeps the customer menu card + recipe wired up). `flavors` are
  // pre-loaded (included in price) as pumps for that drink.
  specialtyDrinks: {
    'campfire-mocha':                    { name:'Campfire Mocha',                     flavors:['Chocolate','Toasted Marshmallow'] },
    'french-hazelnut-cafe':              { name:'French Hazelnut Café',               flavors:['Hazelnut','French Vanilla'] },
    'toasted-marshmallow-pumpkin-cocoa': { name:'Toasted Marshmallow Pumpkin Cocoa',  flavors:['Chocolate','Toasted Marshmallow','Pumpkin Spice'] },
    'cinnamon-roll-latte':               { name:'Cinnamon Roll Latte',                flavors:['Cinnamon','Vanilla'] },
    'autumn-velvet-latte':               { name:'Autumn Velvet Latte',                flavors:['Hazelnut','Pumpkin Spice'] },
    'golden-caramel-macchiato':          { name:'Golden Caramel Macchiato',           flavors:['Caramel','Vanilla'] }
  }
};

const slug = s => str(s,80).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'drink';

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

  const cleanFlavors = arr => {
    const cseen=new Set();
    return (Array.isArray(arr)?arr:[]).map(x=>str(x,60)).filter(x=>x && !cseen.has(x.toLowerCase()) && cseen.add(x.toLowerCase())).slice(0,20);
  };
  // specialty drinks are keyed by a stable id; migrate the legacy name-keyed shape if seen.
  let sd = (input.specialtyDrinks && typeof input.specialtyDrinks==='object') ? input.specialtyDrinks : null;
  if(!sd && input.specialtyFlavors && typeof input.specialtyFlavors==='object'){
    sd={}; Object.keys(input.specialtyFlavors).forEach(nm=>{ sd[slug(nm)]={ name:nm, flavors:input.specialtyFlavors[nm] }; });
  }
  sd = sd || {};
  const specialtyDrinks={};
  Object.keys(sd).slice(0,40).forEach(k=>{
    const id=slug(k); if(!id) return;
    const v=sd[k]||{}; const name=str(v.name!=null?v.name:k,80); if(!name) return;
    specialtyDrinks[id]={ name, flavors:cleanFlavors(v.flavors) };
  });

  return { pumpPrice, builderFlavors, refresherFlavors, specialtyDrinks };
}

module.exports = async (req,res)=>{
  if(req.method==='GET'){
    const r=await kv(['GET','flavors']);
    let cfg=null; try{ cfg = r && r.result ? JSON.parse(r.result) : null; }catch(e){ cfg=null; }
    // normalize the stored config on read (also migrates the legacy specialty shape);
    // fall back to the seeded default if nothing valid is stored.
    res.status(200).json(cfg && Array.isArray(cfg.builderFlavors) && cfg.builderFlavors.length ? sanitize(cfg) : DEFAULT_FLAVORS);
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
