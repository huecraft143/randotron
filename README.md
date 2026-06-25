# ALEA — True Randomness Engine (React)

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

## The randomness source

- **Primary:** [QRNG API](https://qrngapi.com) — certified quantum entropy.
  Called via `POST https://qrngapi.com/api/random` with `{ bytes, format:"hex" }`
  and an `X-API-Key` header. Response field used: `entropy` (hex string).
- **Fallback:** `crypto.getRandomValues` — used on any error, timeout (4s), or
  CORS block. Triggered automatically; the header pill flips to `LOCAL · CSPRNG`.

All of this lives in `src/qrng.js`. Swapping in a different randomness provider
means editing only that one file.

### ⚠️ Security — read before deploying

`qrngapi.com` requires an API key. **Any `VITE_`-prefixed env var is bundled
into the client and is therefore public.** Shipping the key in the browser
exposes it to anyone.

For production, put the key behind your own backend and proxy the request:

1. Create a server route (e.g. `/api/random`) that holds the key server-side
   and forwards the call to `qrngapi.com`, returning the JSON.
2. Set `VITE_QRNG_PROXY_URL` to that route. When a proxy URL is present,
   `qrng.js` calls it **without** sending the key from the client.

For local dev / demos, calling the API directly with a throwaway key is fine —
just know it's visible, and that browser CORS may block the direct call (in
which case you'll see the `LOCAL` fallback).

## Project structure

```
design_handoff_alea/
├── index.html              # Vite entry; loads Google Fonts
├── package.json
├── vite.config.js
├── .env.example            # copy to .env and add your key
└── src/
    ├── main.jsx            # React root
    ├── App.jsx             # the whole UI (Universe theme)
    ├── qrng.js             # entropy source + fallback + result math
    ├── useStarfield.js     # animated canvas background hook
    └── styles.css          # resets + keyframes only
```

`reference/Alea.prototype.html` is the original HTML prototype this project was
ported from — open it in a browser to compare look & behavior.

## Design tokens (Universe theme)

All applied as CSS custom properties on the root element in `App.jsx` (`THEME`).

- Background gradient: `#04050a` → `#0b1022`
- Accent (cyan): `#7df9ff` · Accent 2 (violet): `#b388ff`
- Text: `#e9f1ff` · Muted: `#8390b5`
- Yes: `#6ef0c0` · No: `#ff6b8b` · Live dot: `#3ce88a`
- Panel: `rgba(12,18,38,0.55)` + `blur(14px)`, border `rgba(125,249,255,0.26)`
- Radius: `7px` · Card shadow: `0 24px 70px rgba(0,0,0,0.5)`
- Fonts: **Space Grotesk** (headings/body), **IBM Plex Mono** (data/labels)

## Notes for the implementer

- This is **high-fidelity**: colors, type, spacing, and motion are final.
  Reproduce them as-is, or map them onto your codebase's design system.
- Styling is inline style objects (no CSS framework) so the port is
  self-contained; move it to your styling solution (CSS Modules, Tailwind,
  styled-components…) as your project prefers.
- The background animation runs on a `<canvas>` via `requestAnimationFrame`
  (`useStarfield.js`) and cleans itself up on unmount.
- `SUSPENSE_MS` in `App.jsx` controls the minimum extraction time (1600ms).
- The original prototype had three themes (Universe / Ocean / Geothermal); the
  shipped site — and this port — use **Universe only**. The other palettes are
  preserved in `reference/Alea.prototype.html` if you ever want to restore them.
```
