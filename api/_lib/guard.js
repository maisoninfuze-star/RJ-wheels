// Small request guards for the public API routes: same-site origin check,
// best-effort per-IP rate limiting (per serverless instance), JSON helpers.
// For stronger protection, add a Vercel Firewall rate-limit rule on /api/*.

const buckets = new Map();

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function clientIp(request) {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
}

// Browsers send Origin on POST; only accept calls from this site (or localhost in dev).
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser clients; the rate limit still applies
  try {
    const o = new URL(origin);
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    return o.host === host || o.hostname === 'localhost' || o.hostname === '127.0.0.1' || allowed.includes(o.origin);
  } catch {
    return false;
  }
}

// Allow `limit` hits per `windowMs` for a key.
export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, reset: now + windowMs };
  if (now > b.reset) { b.n = 0; b.reset = now + windowMs; }
  b.n += 1;
  buckets.set(key, b);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  return b.n <= limit;
}
