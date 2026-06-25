// qrng.js — quantum randomness source with graceful fallback.
//
// Primary source: QRNG API (https://qrngapi.com) — certified quantum entropy.
// Fallback: the browser's own cryptographically-secure RNG (crypto.getRandomValues),
// used automatically whenever the API is unreachable or blocked by CORS.

const API_KEY = import.meta.env.VITE_QRNG_API_KEY || '';
const PROXY_URL = import.meta.env.VITE_QRNG_PROXY_URL || '';
const DIRECT_URL = 'https://qrngapi.com/api/random';

// How many random bytes each decision mode consumes.
export function bytesNeeded(mode) {
  if (mode === 'number') return 4;
  if (mode === 'binary') return 1;
  return 2; // list, odds
}

// Combine a byte array into a single non-negative integer (big-endian).
export function bytesToInt(bytes) {
  return bytes.reduce((acc, b) => acc * 256 + (((b % 256) + 256) % 256), 0);
}

function fallbackBytes(n) {
  const a = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
  return { bytes: [...a], live: false };
}

// Fetch `n` quantum-random bytes. Returns { bytes: number[], live: boolean }.
// `live` is false when the fallback CSPRNG was used.
export async function fetchBytes(n) {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 4000);

    const url = PROXY_URL || DIRECT_URL;
    const headers = { 'Content-Type': 'application/json' };
    // When calling the public API directly we must send the key from the client.
    // When using a proxy, the proxy injects the key server-side (preferred).
    if (!PROXY_URL && API_KEY) headers['X-API-Key'] = API_KEY;

    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ bytes: n, format: 'hex' }),
      signal: ctrl.signal
    });
    clearTimeout(to);

    const j = await r.json();
    const hex = j && (j.entropy || j.data);
    if (typeof hex !== 'string' || hex.length < n * 2) return fallbackBytes(n);

    const bytes = [];
    for (let i = 0; i < n; i++) bytes.push(parseInt(hex.substr(i * 2, 2), 16));
    if (bytes.some((b) => !Number.isFinite(b))) return fallbackBytes(n);

    return { bytes, live: true };
  } catch (e) {
    return fallbackBytes(n);
  }
}

// Turn raw bytes into a concrete decision for the given mode.
export function computeResult(mode, bytes, { numMin, numMax, options } = {}) {
  const v = bytesToInt(bytes);
  if (mode === 'binary') {
    return { type: 'binary', yes: (((bytes[0] % 256) + 256) % 256) >= 128, bytes };
  }
  if (mode === 'number') {
    const a = Math.round(+numMin), b = Math.round(+numMax);
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return { type: 'number', num: lo + (v % (hi - lo + 1)), lo, hi, bytes };
  }
  if (mode === 'list') {
    return { type: 'list', idx: v % options.length, opts: options, bytes };
  }
  // odds
  const pct = Math.round((v / 65535) * 1000) / 10;
  return { type: 'odds', pct, bytes };
}

export function bytesToHex(bytes) {
  return (bytes || []).map((b) => ('0' + b.toString(16)).slice(-2).toUpperCase()).join(' ');
}
