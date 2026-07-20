// Shared out-of-stock guard for the order endpoints. The leading underscore keeps Vercel
// from routing this as its own endpoint.
//
// The site hides the order buttons on sold-out drinks, but that is presentation only: a stale
// tab or a hand-rolled POST can still submit one. Both order paths check here before anything
// is recorded — and, for card orders, before any money moves.
async function soldOutNames(kv){
  const r = await kv(['GET','flavors']);
  let cfg = null; try { cfg = r && r.result ? JSON.parse(r.result) : null; } catch(e) { cfg = null; }
  const sd = (cfg && cfg.specialtyDrinks && typeof cfg.specialtyDrinks==='object') ? cfg.specialtyDrinks : {};
  const set = new Set();
  Object.keys(sd).forEach(k=>{
    const d = sd[k];
    if (d && d.soldOut && d.name) set.add(String(d.name).trim().toLowerCase());
  });
  return set;
}

// Cart lines carry the display name, which is what the admin marks sold out.
function firstSoldOut(items, names){
  if (!names || !names.size) return null;
  const list = Array.isArray(items) ? items : [];
  for (let i=0; i<list.length; i++){
    const n = String((list[i] && list[i].name) || '').trim().toLowerCase();
    if (n && names.has(n)) return list[i].name;
  }
  return null;
}

module.exports = { soldOutNames, firstSoldOut };
