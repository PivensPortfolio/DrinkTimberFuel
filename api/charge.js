// Charges a card using the one-time token (nonce) the Web Payments SDK produced in the browser.
// The secret Access Token never leaves the server. Sandbox by default (test cards only).
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'method not allowed' }); return; }
  const env = (process.env.SQUARE_ENV || 'sandbox').toLowerCase();
  const token = process.env.SQUARE_ACCESS_TOKEN || '';
  if (!token) { res.status(500).json({ ok: false, error: 'Payments not configured yet.' }); return; }
  const base = env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const { sourceId, amountCents, idempotencyKey, locationId, note } = body;

  const cents = Math.round(Number(amountCents));
  if (!sourceId || !idempotencyKey || !locationId || !cents || cents < 1) {
    res.status(400).json({ ok: false, error: 'Missing or invalid payment details.' });
    return;
  }

  try {
    const r = await fetch(base + '/v2/payments', {
      method: 'POST',
      headers: {
        'Square-Version': '2024-12-18',
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source_id: sourceId,
        idempotency_key: String(idempotencyKey).slice(0, 45),
        amount_money: { amount: cents, currency: 'USD' },
        location_id: locationId,
        note: note ? String(note).slice(0, 500) : undefined
      })
    });
    const data = await r.json();
    if (!r.ok) {
      const detail = (data.errors && data.errors[0] && (data.errors[0].detail || data.errors[0].code)) || 'Payment failed.';
      res.status(400).json({ ok: false, error: detail });
      return;
    }
    res.status(200).json({ ok: true, paymentId: data.payment && data.payment.id, status: data.payment && data.payment.status });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Could not reach the payment service.' });
  }
};
