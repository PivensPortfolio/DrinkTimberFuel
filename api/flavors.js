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
  // Specialty drinks (hot / cold / refresher) keyed by a STABLE id so the display name
  // can be renamed. Each has section+group (organization + flavor pool), name, desc,
  // image, and `flavors` (pre-loaded/included pumps). The matching menu card in
  // index.html carries the same data-spec-id, so admin edits overlay it live.
  specialtyDrinks: {
    // HOT — Mochas
    'campfire-mocha':                    { section:'hot', group:'Mochas', name:'Campfire Mocha',                    desc:"Deep chocolate and sweet marshmallow: a fire-roasted s'more in a mug.", image:'assets/campfire-mocha.png', flavors:['Chocolate','Toasted Marshmallow'] },
    'french-hazelnut-cafe':              { section:'hot', group:'Mochas', name:'French Hazelnut Café',              desc:"A clean, sweet aromatic baseline that lets bold, nutty accents take center stage.", image:'assets/french-hazelnut.png', flavors:['Hazelnut','French Vanilla'] },
    'toasted-marshmallow-pumpkin-cocoa': { section:'hot', group:'Mochas', name:'Toasted Marshmallow Pumpkin Cocoa', desc:"Caffeine-free luxury cocoa with toasted marshmallow and warm campfire spice.", image:'assets/hot-coffee.png', flavors:['Chocolate','Toasted Marshmallow','Pumpkin Spice'] },
    // HOT — Lattes
    'cinnamon-roll-latte':               { section:'hot', group:'Lattes', name:'Cinnamon Roll Latte',               desc:"A warm cinnamon roll fresh from the oven, with a sweet vanilla icing finish.", image:'assets/cinnamon-roll-latte.png', flavors:['Cinnamon','Vanilla'] },
    'autumn-velvet-latte':               { section:'hot', group:'Lattes', name:'Autumn Velvet Latte',               desc:"Toasted nuttiness balanced with bright, aromatic seasonal harvest spice.", image:'assets/hot-coffee.png', flavors:['Hazelnut','Pumpkin Spice'] },
    'golden-caramel-macchiato':          { section:'hot', group:'Lattes', name:'Golden Caramel Macchiato',          desc:"Custard-like vanilla milk and strong espresso, crowned with buttery caramel.", image:'assets/caramel-macchiato.png', flavors:['Caramel','Vanilla'] },
    // COLD — Iced Mochas & Lattes
    'iced-mocha':                        { section:'cold', group:'Iced Mochas & Lattes', name:'Iced Mocha', desc:"Espresso, chocolate & milk over ice. Rich, sweet, indulgent.", image:'assets/cold-brew.png', flavors:[] },
    'iced-latte':                        { section:'cold', group:'Iced Mochas & Lattes', name:'Iced Latte', desc:"Smooth espresso & milk over ice. Mellow and easy-drinking.", image:'assets/cold-brew.png', flavors:[] },
    // COLD — Iced Black & Bold
    'iced-coffee':                       { section:'cold', group:'Iced Black & Bold', name:'Iced Coffee',    desc:"Brewed hot, flash-chilled over ice. Bright, crisp, clean.", image:'assets/iced-coffee.png', flavors:[] },
    'cold-brew':                         { section:'cold', group:'Iced Black & Bold', name:'Cold Brew',      desc:"Steeped cold 18+ hours. Rich, smooth, far less acidic.", image:'assets/iced-coffee.png', flavors:[] },
    'iced-americano':                    { section:'cold', group:'Iced Black & Bold', name:'Iced Americano', desc:"Bold espresso over ice and cold water. Smooth and full-bodied.", image:'assets/iced-coffee.png', flavors:[] },
    'iced-espresso':                     { section:'cold', group:'Iced Black & Bold', name:'Iced Espresso',  desc:"A chilled shot of intense Northwoods roast over ice.", image:'assets/iced-coffee.png', flavors:[] },
    // REFRESHERS
    'spicy-mango':                       { section:'refresher', group:'Refreshers', name:'Spicy Mango',             desc:"", image:'assets/Feature_EnerygyDrink_Desktop.png', flavors:[] },
    'georgia-peach':                     { section:'refresher', group:'Refreshers', name:'Georgia Peach',           desc:"", image:'assets/peach-lg.png', flavors:[] },
    'green-apple-jolly':                 { section:'refresher', group:'Refreshers', name:'Green Apple Jolly',       desc:"", image:'assets/apple-lg.png', flavors:[] },
    'watermelon-jolly':                  { section:'refresher', group:'Refreshers', name:'Watermelon Jolly',        desc:"", image:'assets/watermelon-lg.png', flavors:[] },
    'blue-raspberry-lemonade':           { section:'refresher', group:'Refreshers', name:'Blue Raspberry Lemonade', desc:"", image:'assets/blue-lg.png', flavors:[] }
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
  const DEF_SD = DEFAULT_FLAVORS.specialtyDrinks;
  let sd = (input.specialtyDrinks && typeof input.specialtyDrinks==='object') ? input.specialtyDrinks : null;
  if(!sd && input.specialtyFlavors && typeof input.specialtyFlavors==='object'){
    sd={}; Object.keys(input.specialtyFlavors).forEach(nm=>{ sd[slug(nm)]={ name:nm, flavors:input.specialtyFlavors[nm] }; });
  }
  sd = sd || {};
  const specialtyDrinks={};
  Object.keys(sd).slice(0,60).forEach(k=>{
    const id=slug(k); if(!id) return;
    const v=sd[k]||{}, def=DEF_SD[id]||{};
    const name=str(v.name!=null?v.name:(def.name!=null?def.name:k),80); if(!name) return;
    // keep hosted image URLs / asset paths only — never store a giant inline data URL
    let image=str(v.image!=null?v.image:(def.image||''),500); if(/^data:/i.test(image)) image=def.image||'';
    specialtyDrinks[id]={
      section: str(v.section||def.section||'hot',20),
      group:   str(v.group!=null?v.group:(def.group||''),40),
      name,
      desc:    str(v.desc!=null?v.desc:(def.desc||''),300),
      image,
      flavors: cleanFlavors(v.flavors!=null?v.flavors:def.flavors)
    };
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
