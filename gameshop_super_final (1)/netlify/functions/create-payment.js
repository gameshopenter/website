// netlify/functions/create-payment.js
// Maakt een Mollie betaling aan via de REST API

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) return { statusCode: 500, body: 'Missing MOLLIE_API_KEY' };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const items = Array.isArray(payload.items) ? payload.items : [];
  const customer = payload.customer || {};
  if (!items.length) return { statusCode: 400, body: 'Cart is empty' };

  // Server-side totaal in euro’s (string met 2 decimalen)
  const totalCents = items.reduce((sum, it) => {
    const pc = Number(it.priceCents || 0);
    const qty = Number(it.qty || 0);
    return sum + (pc > 0 && qty > 0 ? pc * qty : 0);
  }, 0);
  if (totalCents <= 0) return { statusCode: 400, body: 'Invalid total' };

  const totalStr = (totalCents / 100).toFixed(2); // bv "35.00"
  const base = process.env.URL || 'http://localhost:8888';

  // Payment body volgens Mollie v2
  const body = {
    amount: { currency: 'EUR', value: totalStr },
    description: 'GameShop Enter bestelling',
    // method: 'ideal',            // optioneel: toon specifieke methode, of laat weg voor alle geactiveerde methodes
    redirectUrl: `${base}/thankyou.html`,
    cancelUrl: `${base}/cancel.html`,
    webhookUrl: `${base}/.netlify/functions/webhook`,
    metadata: { items, customer },
    locale: 'nl_NL'
  };

  try {
    const res = await fetch('https://api.mollie.com/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Mollie create error:', res.status, txt);
      return { statusCode: 502, body: 'Failed to create payment' };
    }

    const json = await res.json();
    const checkoutUrl = json?._links?.checkout?.href;

    if (!checkoutUrl) {
      console.error('No checkout link in response:', json);
      return { statusCode: 502, body: 'No checkout URL' };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkoutUrl })
    };
  } catch (err) {
    console.error('Fetch error:', err);
    return { statusCode: 502, body: 'Payment request failed' };
  }
};