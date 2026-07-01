// Uploads a drink image to Vercel Blob and returns its public URL. Admin-only.
// The browser resizes/compresses the image and sends it as base64 JSON; we store the
// bytes in Blob (public) so the flavors config only ever holds a short hosted URL.
// Requires a Vercel Blob store + BLOB_READ_WRITE_TOKEN env var. Degrades with a clear
// error if that isn't configured yet.
const { put } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok:false, error:'method not allowed' }); return; }
  const pass = process.env.ADMIN_PASSWORD || '';
  if (!pass || (req.headers['x-admin-pass'] || '') !== pass) { res.status(401).json({ ok:false, error:'unauthorized' }); return; }
  if (!process.env.BLOB_READ_WRITE_TOKEN) { res.status(500).json({ ok:false, error:'Image uploads are not configured yet (missing Blob token).' }); return; }

  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const dataBase64 = String(body.dataBase64 || '');
  const contentType = String(body.contentType || 'image/jpeg');
  if (!dataBase64) { res.status(400).json({ ok:false, error:'No image data.' }); return; }
  if (!/^image\//.test(contentType)) { res.status(400).json({ ok:false, error:'Only image files are allowed.' }); return; }

  let buffer;
  try { buffer = Buffer.from(dataBase64, 'base64'); } catch (e) { res.status(400).json({ ok:false, error:'Bad image data.' }); return; }
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) { res.status(413).json({ ok:false, error:'Image must be under 5 MB.' }); return; }

  const ext = (contentType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
  const safe = String(body.filename || 'drink').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'drink';
  try {
    const blob = await put(`drinks/${Date.now()}-${safe}.${ext}`, buffer, { access:'public', contentType, addRandomSuffix:true });
    res.status(200).json({ ok:true, url: blob.url });
  } catch (e) {
    res.status(500).json({ ok:false, error:'Upload failed. Please try again.' });
  }
};
