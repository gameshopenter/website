// netlify/functions/webhook.js
// Mollie webhook: leest payment-id en haalt status op via REST API

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) return { statusCode: 500, body: 'Missing MOLLIE_API_KEY' };

  // Mollie post body als "id=tr_xxx"
  const paymentId = (event.body || '').toString().replace('id=', '').trim();
  if (!paymentId) return { statusCode: 400, body: 'Missing payment id' };

  try {
    const res = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('Mollie get error:', res.status, txt);
      return { statusCode: 502, body: 'Failed to get payment' };
    }

    const payment = await res.json();
    console.log('Payment status:', payment.id, payment.status, payment.metadata);
    // TODO: bij payment.status === 'paid' → order opslaan / mail sturen

    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    console.error('Webhook fetch error:', e);
    return { statusCode: 500, body: 'error' };
  }
};