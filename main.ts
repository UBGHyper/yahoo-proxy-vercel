// Deno Deploy Yahoo Finance CORS proxy
// - Allowed GET endpoints only:
//   - /v7/finance/quote
//   - /v8/finance/chart/:symbol
// - Adds permissive CORS headers
// - NOT an open proxy; only forwards to Yahoo Finance allow-listed paths

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  Vary: "Origin",
};

function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(JSON.stringify(body), { ...init, headers });
}

function withCors(resp: Response) {
  const headers = new Headers(resp.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(resp.body, { status: resp.status, headers });
}

// Use Deno.serve for Deno Deploy when available; otherwise fall back to a fetch event listener.
const denoAny = (globalThis as any).Deno;
if (denoAny && typeof denoAny.serve === "function") {
  denoAny.serve((req: Request) => handleRequest(req));
} else if (typeof addEventListener === "function") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener("fetch", (event: any) => {
    event.respondWith(handleRequest(event.request));
  });
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  // Route allow-list
  // /v7/finance/quote?...
  if (url.pathname === "/v7/finance/quote") {
    const target = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
    target.search = url.search; // forward query params
    return forward(target.href, req);
  }

  // /v8/finance/chart/:symbol
  const chartMatch = url.pathname.match(/^\/v8\/finance\/chart\/([^/]+)$/);
  if (chartMatch) {
    const symbol = chartMatch[1];
    const target = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
    target.search = url.search;
    return forward(target.href, req);
  }

  return json({ error: "Unsupported path", path: url.pathname }, { status: 400 });
}

async function forward(target: string, req: Request): Promise<Response> {
  const upstreamHeaders: HeadersInit = {
    "accept": "application/json, text/plain, */*",
    // Provide a UA to avoid occasional 403s
    "user-agent": "asxcheck-proxy/1.0 (+https://github.com/asxcheck/asxcheck.github.io)",
  };
  try {
    const resp = await fetch(target, {
      method: "GET",
      headers: upstreamHeaders,
      // No body for GET
    });
    // Pass through as-is, but enforce CORS headers
    return withCors(resp);
  } catch (err) {
    return json({ error: "Upstream fetch failed", message: String(err) }, { status: 502 });
  }
}
