# Randotron — True Randomness Engine

**Live:** https://randotron.mattiapalano11.workers.dev

A decision helper that lets people choose by drawing on **genuine quantum
randomness** — "the only true randomness, the randomness of the universe."
The user picks a decision type and the app pulls live quantum entropy to
produce the answer, with a short suspense animation and a reveal.

This is a runnable **React + Vite** project (not a static HTML export).

## Quick start

```bash
npm install
cp .env.example .env      # then paste your QRNG API key into .env (optional)
npm run dev               # opens http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

> The app works **without** an API key: if the quantum source is unreachable
> or no key is set, it automatically falls back to the browser's
> cryptographically-secure RNG (`crypto.getRandomValues`). The status pill in
> the header shows which source produced each result.

## What it does

A single screen, four decision modes selected from a row of buttons:

- **Yes / No** — a 50/50 verdict from one quantum byte (≥128 → YES).
- **Pick one** — picks one option from a newline-separated list.
- **Number** — an integer drawn uniformly from a [min, max] range.
- **Odds** — maps entropy to a 0–100% probability with a verdict.

Flow per decision: user input → **extraction** animation (spinning rings +
streaming hex) with a minimum suspense time → **reveal** of the result, the raw
entropy bytes used, and the source (`LIVE` or `LOCAL`).

## Architecture

The frontend calls a **Cloudflare Worker proxy** (`proxy/`) which holds the
QRNG API key server-side and forwards requests to `qrngapi.com`. This avoids
exposing the key in the browser bundle.

- **Proxy Worker:** https://randotron-qrng-proxy.mattiapalano11.workers.dev
- **Frontend:** https://randotron.mattiapalano11.workers.dev

## The randomness source

- **Primary:** [QRNG API](https://qrngapi.com) — certified quantum entropy.
  Called via `POST https://qrngapi.com/api/random` with `{ bytes, format:"hex" }`
  and an `X-API-Key` header. Response field used: `data` (hex string).
- **Fallback:** `crypto.getRandomValues` — used on any error, timeout (4s), or
  unreachable proxy. Triggered automatically; the header pill flips to `LOCAL · CSPRNG`.

All of this lives in `src/qrng.js`. Swapping in a different randomness provider
means editing only that one file.

## CI/CD

Push to `main` → GitHub Actions deploys the Worker proxy → Cloudflare rebuilds
the frontend automatically.

Required GitHub secrets: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `VITE_QRNG_PROXY_URL`.

## Project structure

```
randotron/
├── index.html              # Vite entry; loads Google Fonts
├── package.json
├── vite.config.js
├── .env.example            # copy to .env and add your key (local dev only)
├── proxy/
│   ├── index.js            # Cloudflare Worker proxy for qrngapi.com
│   └── wrangler.toml       # Worker config
└── src/
    ├── main.jsx            # React root
    ├── App.jsx             # the whole UI (Universe theme)
    ├── qrng.js             # entropy source + fallback + result math
    ├── useStarfield.js     # animated canvas background hook
    └── styles.css          # resets + keyframes only
```

## Design tokens (Universe theme)

All applied as CSS custom properties on the root element in `App.jsx` (`THEME`).

- Background gradient: `#04050a` → `#0b1022`
- Accent (cyan): `#7df9ff` · Accent 2 (violet): `#b388ff`
- Text: `#e9f1ff` · Muted: `#8390b5`
- Yes: `#6ef0c0` · No: `#ff6b8b` · Live dot: `#3ce88a`
- Panel: `rgba(12,18,38,0.55)` + `blur(14px)`, border `rgba(125,249,255,0.26)`
- Radius: `7px` · Card shadow: `0 24px 70px rgba(0,0,0,0.5)`
- Fonts: **Space Grotesk** (headings/body), **IBM Plex Mono** (data/labels)
