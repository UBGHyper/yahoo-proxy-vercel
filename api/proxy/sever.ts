export default async function handler(req, res) {
  const origin = req.headers.origin || '*';
  const url = new URL(req.url || '/', `https://${req.headers.host}`);
  const after = url.pathname.replace(/^\/api\/proxy\/?/, '');
  const target = `https://query1.finance.yahoo.com/${after}${url.search}`;

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
    return res.status(204).end();
  }

  const upstream = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const buf = Buffer.from(await upstream.arrayBuffer());

  // Copy headers and add CORS
  upstream.headers.forEach((v, k) => res.setHeader(k, v));
  res.removeHeader('set-cookie');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');

  return res.status(upstream.status).send(buf);
}
