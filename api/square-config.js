// Returns the PUBLIC Square config the browser needs to render the card form.
// Application ID + environment are public; the Access Token stays server-side (env var).
// We look up the Location ID from Square so it never has to be hunted down by hand.
module.exports = async (req, res) => {
  const env = (process.env.SQUARE_ENV || 'sandbox').toLowerCase();
  const appId = process.env.SQUARE_APP_ID || 'sandbox-sq0idb-l-lVEo2wIEZ4mG4WSfVwiA';
  const token = process.env.SQUARE_ACCESS_TOKEN || '';
  if (!token) { res.status(200).json({ configured: false }); return; }
  const base = env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
  try {
    const r = await fetch(base + '/v2/locations', {
      headers: {
        'Square-Version': '2024-12-18',
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });
    const data = await r.json();
    const locs = data.locations || [];
    const loc = locs.find(l => l.status === 'ACTIVE') || locs[0];
    if (!loc) { res.status(200).json({ configured: false, error: 'no location' }); return; }
    res.status(200).json({ configured: true, environment: env, applicationId: appId, locationId: loc.id });
  } catch (e) {
    res.status(200).json({ configured: false, error: String(e) });
  }
};
