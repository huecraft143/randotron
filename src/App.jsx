import { useEffect, useRef, useState } from 'react';
import { useStarfield } from './useStarfield.js';
import { bytesNeeded, fetchBytes, computeResult, bytesToHex } from './qrng.js';

// ---- Universe theme palette (the only theme; exposed as CSS custom properties) ----
const THEME = {
  '--bg0': '#04050a', '--bg1': '#0b1022',
  '--panel': 'rgba(12,18,38,0.55)', '--panel-brd': 'rgba(125,249,255,0.26)', '--panel-blur': 'blur(14px)',
  '--accent': '#7df9ff', '--accent2': '#b388ff', '--on-accent': '#04050a',
  '--text': '#e9f1ff', '--muted': '#8390b5', '--dim': 'rgba(125,249,255,0.09)',
  '--radius': '7px',
  '--btn-bg': 'linear-gradient(180deg, rgba(125,249,255,0.18), rgba(125,249,255,0.05))',
  '--btn-text': '#dffaff', '--btn-brd': 'rgba(125,249,255,0.5)', '--btn-shadow': '0 0 26px rgba(125,249,255,0.32)',
  '--card-shadow': '0 24px 70px rgba(0,0,0,0.5)',
  '--yes': '#6ef0c0', '--no': '#ff6b8b'
};

const FONT_HEAD = "'Space Grotesk', sans-serif";
const FONT_DATA = "'Space Mono', monospace";

const COPY = {
  title: 'Ask The Universe',
  sub: "You are lost in your head and can't make a decision?\nJust ask the damn Universe.",
  verb: 'Roll',
  caption: 'rolling...',
  sourceName: 'QRNG API'
};

const MODE_HINTS = {
  binary: 'What are you deciding? (the question is optional)',
  odds: 'Phrase it as a yes/no question — get a probability.',
  list: 'List your options, one per line. At least two.',
  number: 'Pick a range. An integer is drawn from within it.'
};

const SUSPENSE_MS = 1600;

export default function App() {
  const canvasRef = useStarfield();
  const streamRef = useRef(null);
  const streamTimer = useRef(null);

  const [mode, setMode] = useState('binary');
  const [phase, setPhase] = useState('idle'); // idle | extracting | result
  const [question, setQuestion] = useState('');
  const [listText, setListText] = useState('Pizza\nSushi\nTacos\nRamen');
  const [numMin, setNumMin] = useState('1');
  const [numMax, setNumMax] = useState('100');
  const [result, setResult] = useState(null);
  const [source, setSource] = useState('idle'); // idle | live | fallback
  const [typed, setTyped] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    const full = COPY.title;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) { clearInterval(iv); setTypingDone(true); }
    }, 75);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => () => { if (streamTimer.current) clearInterval(streamTimer.current); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setInfoOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const options = () => listText.split('\n').map((s) => s.trim()).filter(Boolean);

  const canDecide = () => {
    if (mode === 'list') return options().length >= 2;
    if (mode === 'number') {
      const a = +numMin, b = +numMax;
      return Number.isFinite(a) && Number.isFinite(b) && b > a;
    }
    return true;
  };

  const startStream = () => {
    streamTimer.current = setInterval(() => {
      const el = streamRef.current;
      if (!el) return;
      el.textContent = Array.from({ length: 12 }, () =>
        ('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2).toUpperCase()
      ).join(' ');
    }, 70);
  };
  const stopStream = () => { if (streamTimer.current) { clearInterval(streamTimer.current); streamTimer.current = null; } };

  const changeMode = (m) => { setMode(m); setPhase('idle'); setResult(null); };

  const roll = async () => {
    if (!canDecide() || phase === 'extracting') return;
    const n = bytesNeeded(mode);
    setPhase('extracting');
    startStream();
    const start = performance.now();
    const { bytes, live } = await fetchBytes(n);
    const wait = Math.max(0, SUSPENSE_MS - (performance.now() - start));
    await new Promise((r) => setTimeout(r, wait));
    stopStream();
    setResult(computeResult(mode, bytes, { numMin, numMax, options: options() }));
    setSource(live ? 'live' : 'fallback');
    setPhase('result');
  };

  const reset = () => { setPhase('idle'); setResult(null); };

  // ---- derived view state ----
  const disabled = !canDecide() || phase === 'extracting';
  const srcDotColor = source === 'live' ? '#3ce88a' : source === 'fallback' ? THEME['--accent2'] : THEME['--muted'];
  const sourceLine = source === 'live' ? `LIVE · ${COPY.sourceName}` : source === 'fallback' ? 'LOCAL · CSPRNG' : `AWAITING · ${COPY.sourceName}`;
  const sourceTag = source === 'live' ? `LIVE · ${COPY.sourceName}` : 'LOCAL CSPRNG';

  let resultLabel = '', resultBig = '', resultSub = '', bigColor = 'var(--accent)';
  let oddsVerdict = '', oddsColor = 'var(--accent)';
  if (result) {
    if (result.type === 'binary') {
      resultLabel = 'The answer'; resultBig = result.yes ? 'YES' : 'NO';
      bigColor = result.yes ? 'var(--yes)' : 'var(--no)';
      resultSub = question ? `\u201C${question}\u201D` : '';
    } else if (result.type === 'number') {
      resultLabel = 'The number'; resultBig = String(result.num);
      resultSub = `drawn between ${result.lo} and ${result.hi}`;
    } else if (result.type === 'list') {
      resultLabel = 'It chose'; resultBig = result.opts[result.idx];
      resultSub = `from ${result.opts.length} options`;
    } else if (result.type === 'odds') {
      oddsColor = result.pct >= 50 ? 'var(--yes)' : 'var(--no)';
      oddsVerdict = result.pct >= 75 ? 'Strongly leans YES'
        : result.pct >= 55 ? 'Leans YES'
        : result.pct >= 45 ? 'A true coin-flip'
        : result.pct >= 25 ? 'Leans NO' : 'Strongly leans NO';
    }
  }

  // ---- shared styles ----
  const root = { ...THEME, minHeight: '100vh', position: 'relative', overflowX: 'hidden', background: 'linear-gradient(160deg, var(--bg0), var(--bg1))', color: 'var(--text)', fontFamily: FONT_HEAD };
  const modeBtn = (active) => ({
    flex: '1 1 auto', minWidth: 88, padding: '11px 8px', borderRadius: 'var(--radius)',
    border: '1px solid var(--panel-brd)', background: active ? 'var(--dim)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--muted)', borderColor: active ? 'var(--accent)' : 'var(--panel-brd)',
    fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer'
  });
  const inputStyle = { width: '100%', padding: '15px 16px', background: 'var(--dim)', border: '1px solid var(--panel-brd)', borderRadius: 'var(--radius)', color: 'var(--text)', fontFamily: FONT_HEAD, fontSize: 15, outline: 'none' };
  const labelCap = { display: 'block', fontFamily: FONT_DATA, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 };

  return (
    <div style={root}>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />

      {/* Header — 3 floating pills */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: 'transparent', overflow: 'visible', pointerEvents: 'none' }}>
        {/* logo pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 999, background: 'var(--panel)', backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)', border: '1px solid var(--panel-brd)', pointerEvents: 'auto' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ opacity: 0.8, flexShrink: 0 }}>
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="8.5" cy="8.5" r="1.4" fill="var(--accent)" stroke="none" />
            <circle cx="15.5" cy="8.5" r="1.4" fill="var(--accent)" stroke="none" />
            <circle cx="8.5" cy="15.5" r="1.4" fill="var(--accent)" stroke="none" />
            <circle cx="15.5" cy="15.5" r="1.4" fill="var(--accent)" stroke="none" />
            <circle cx="12" cy="12" r="1.4" fill="var(--accent)" stroke="none" />
          </svg>
          <span style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, letterSpacing: '0.18em', color: 'var(--text)' }}>RANDOTRON</span>
        </div>

        {/* infinity pill — clickable */}
        <div
          role="button" tabIndex={0}
          onClick={() => setInfoOpen(true)}
          onKeyDown={(e) => e.key === 'Enter' && setInfoOpen(true)}
          style={{ width: 90, height: 90, borderRadius: 999, background: 'var(--panel)', backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)', border: '1px solid var(--panel-brd)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, cursor: 'pointer', pointerEvents: 'auto', position: 'relative', animation: 'pulseRing 2.8s ease-in-out infinite', outline: 'none' }}
        >
          <span style={{ fontSize: 62, lineHeight: 0, animation: 'infcolor 4s ease-in-out infinite', userSelect: 'none' }}>∞</span>
          <span style={{ position: 'absolute', bottom: -18, left: '50%', transform: 'translateX(-50%)', fontFamily: FONT_DATA, fontSize: 8, letterSpacing: '0.2em', color: 'var(--accent)', whiteSpace: 'nowrap', animation: 'pulsefade 2.2s ease-in-out infinite' }}>[ INFO ]</span>
        </div>

        {/* status pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px', borderRadius: 999, background: 'var(--panel)', backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)', border: '1px solid var(--panel-brd)', fontFamily: FONT_DATA, fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', pointerEvents: 'auto' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: srcDotColor, boxShadow: `0 0 8px ${srcDotColor}`, transition: 'background .3s', flexShrink: 0 }} />
          <span>{sourceLine}</span>
        </div>
      </header>

      {/* Main card */}
      <main style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '130px 28px 72px' }}>
        <section style={{ width: '100%', maxWidth: 640, background: 'var(--panel)', backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)', border: '1px solid var(--panel-brd)', borderRadius: 14, boxShadow: 'var(--card-shadow)', padding: '52px 48px 44px' }}>
          <h1 style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 36, lineHeight: 1.02, color: 'var(--text)', margin: '0 0 10px' }}>
            {typed}{!typingDone && <span style={{ animation: 'blink .7s step-end infinite', color: 'var(--accent)' }}>|</span>}
          </h1>
          <p style={{ fontFamily: FONT_HEAD, fontSize: 14, lineHeight: 1.7, color: 'var(--muted)', margin: '0 0 8px', maxWidth: '50ch', whiteSpace: 'pre-line' }}>{COPY.sub}</p>

          <div style={{ display: 'flex', gap: 8, margin: '36px 0 12px', flexWrap: 'wrap' }}>
            <button onClick={() => changeMode('binary')} style={modeBtn(mode === 'binary')}>Yes / No</button>
            <button onClick={() => changeMode('list')} style={modeBtn(mode === 'list')}>Pick one</button>
            <button onClick={() => changeMode('number')} style={modeBtn(mode === 'number')}>Number</button>
            <button onClick={() => changeMode('odds')} style={modeBtn(mode === 'odds')}>Odds</button>
          </div>

          {/* Input phase */}
          {phase === 'idle' && (
            <div>
              <div style={{ fontFamily: FONT_DATA, fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted)', margin: '16px 0 12px' }}>{MODE_HINTS[mode]}</div>

              {mode === 'binary' && (
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Should I ship it tonight?" style={inputStyle} />
              )}
              {mode === 'odds' && (
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Will it rain on launch day?" style={inputStyle} />
              )}
              {mode === 'list' && (
                <textarea value={listText} onChange={(e) => setListText(e.target.value)} rows={4} placeholder="One option per line" style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical' }} />
              )}
              {mode === 'number' && (
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
                  <label style={{ flex: 1 }}>
                    <span style={labelCap}>Minimum</span>
                    <input type="number" value={numMin} onChange={(e) => setNumMin(e.target.value)} style={{ ...inputStyle, fontFamily: FONT_DATA, fontSize: 18 }} />
                  </label>
                  <div style={{ fontFamily: FONT_DATA, color: 'var(--muted)', paddingBottom: 16 }}>to</div>
                  <label style={{ flex: 1 }}>
                    <span style={labelCap}>Maximum</span>
                    <input type="number" value={numMax} onChange={(e) => setNumMax(e.target.value)} style={{ ...inputStyle, fontFamily: FONT_DATA, fontSize: 18 }} />
                  </label>
                </div>
              )}

              <button onClick={roll} disabled={disabled} style={{ width: '100%', marginTop: 20, padding: 18, border: '1px solid var(--btn-brd)', borderRadius: 'var(--radius)', background: 'var(--btn-bg)', color: 'var(--btn-text)', fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: disabled ? 'not-allowed' : 'pointer', boxShadow: 'var(--btn-shadow)', opacity: disabled ? 0.4 : 1, filter: disabled ? 'grayscale(0.5)' : 'none' }}>{COPY.verb}</button>
            </div>
          )}

          {/* Extraction phase */}
          {phase === 'extracting' && (
            <div style={{ padding: '34px 0 10px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, margin: '0 auto 22px', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, border: '2px solid var(--dim)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'ringspin .9s linear infinite' }} />
                <div style={{ position: 'absolute', inset: 11, border: '2px solid var(--dim)', borderBottomColor: 'var(--accent2)', borderRadius: '50%', animation: 'ringspin 1.4s linear infinite reverse' }} />
              </div>
              <div ref={streamRef} style={{ fontFamily: FONT_DATA, fontSize: 13, letterSpacing: '0.28em', color: 'var(--accent)', minHeight: 20, wordBreak: 'break-all' }}>·· ·· ·· ··</div>
              <div style={{ fontFamily: FONT_HEAD, fontSize: 14, color: 'var(--muted)', marginTop: 16, animation: 'pulsefade 1.6s ease-in-out infinite' }}>{COPY.caption}</div>
            </div>
          )}

          {/* Result phase */}
          {phase === 'result' && result && (
            <div style={{ textAlign: 'center', padding: '18px 0 6px', animation: 'reveal .55s ease both' }}>
              {result.type === 'odds' ? (
                <div>
                  <div style={{ fontFamily: FONT_DATA, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)' }}>odds</div>
                  <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 'clamp(54px, 12vw, 92px)', lineHeight: 1, color: oddsColor, margin: '8px 0 0' }}>{result.pct.toFixed(1)}%</div>
                  <div style={{ height: 8, width: '100%', maxWidth: 340, margin: '8px auto 16px', background: 'var(--dim)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${result.pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999, transition: 'width .8s ease' }} />
                  </div>
                  <div style={{ fontFamily: FONT_HEAD, fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>{oddsVerdict}</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontFamily: FONT_DATA, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--muted)' }}>{resultLabel}</div>
                  <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 'clamp(46px, 11vw, 88px)', lineHeight: 1.02, color: bigColor, margin: '6px 0 4px', wordBreak: 'break-word' }}>{resultBig}</div>
                  {result.type === 'list' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6 }}>
                      {result.opts.map((o, i) => (
                        <span key={i} style={{ padding: '7px 14px', borderRadius: 999, border: '1px solid var(--panel-brd)', fontFamily: FONT_DATA, fontSize: 13, ...(i === result.idx ? { background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'transparent', fontWeight: 700, boxShadow: 'var(--btn-shadow)' } : { color: 'var(--muted)', opacity: 0.45 }) }}>{o}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ fontFamily: FONT_HEAD, fontSize: 14, color: 'var(--muted)', marginTop: 16 }}>{resultSub}</div>
              <div style={{ fontFamily: FONT_DATA, fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted)', opacity: 0.5, marginTop: 14 }}>{bytesToHex(result.bytes)} · {sourceTag}</div>

              <button onClick={reset} style={{ marginTop: 24, padding: '13px 28px', background: 'transparent', border: '1px solid var(--panel-brd)', borderRadius: 'var(--radius)', color: 'var(--text)', fontFamily: FONT_HEAD, fontSize: 13, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>Ask again</button>
            </div>
          )}
        </section>
      </main>

      {/* Info modal */}
      {infoOpen && (
        <div
          onClick={() => setInfoOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,5,10,0.82)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative', width: '100%', maxWidth: 520, background: 'var(--panel)', backdropFilter: 'var(--panel-blur)', WebkitBackdropFilter: 'var(--panel-blur)', border: '1px solid var(--panel-brd)', borderRadius: 12, padding: '28px 32px 24px', boxShadow: 'var(--card-shadow)', animation: 'modalin .35s ease both', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(125,249,255,0.2), transparent)', pointerEvents: 'none', animation: 'scanline 5s linear infinite' }} />

            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, animation: 'infcolor 4s ease-in-out infinite', lineHeight: 1 }}>∞</span>
                <div>
                  <div style={{ fontFamily: FONT_DATA, fontSize: 8, letterSpacing: '0.22em', color: 'var(--muted)', marginBottom: 1 }}>// INFO</div>
                  <div style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 15, color: 'var(--accent)', letterSpacing: '0.05em' }}>ENTROPY SYSTEM REPORT</div>
                </div>
              </div>
              <button onClick={() => setInfoOpen(false)} style={{ fontFamily: FONT_DATA, fontSize: 10, letterSpacing: '0.14em', color: 'var(--muted)', background: 'transparent', border: '1px solid var(--panel-brd)', borderRadius: 5, padding: '5px 10px', cursor: 'pointer' }}>[ ESC ]</button>
            </div>

            {/* section 1 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: FONT_DATA, fontSize: 8, letterSpacing: '0.22em', color: 'var(--accent2)', marginBottom: 7 }}>// WHY COMPUTERS ARE NOT RANDOM</div>
              <p style={{ fontFamily: FONT_HEAD, fontSize: 13, lineHeight: 1.65, color: 'var(--text)', margin: 0 }}>
                Computers are deterministic machines — same input, same output, always. <span style={{ fontFamily: FONT_DATA, color: 'var(--accent)', fontSize: 12 }}>Math.random()</span> uses a pseudo-random number generator (PRNG): a mathematical formula seeded by the system clock or hardware state. It <em>looks</em> random, but it's fully predictable if you know the seed. Security researchers have exploited this to break lotteries, games, and cryptographic systems.
              </p>
            </div>

            <div style={{ height: 1, background: 'var(--panel-brd)', marginBottom: 18 }} />

            {/* section 2 */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: FONT_DATA, fontSize: 8, letterSpacing: '0.22em', color: 'var(--accent)', marginBottom: 7 }}>// THE QUANTUM SOURCE · qrngapi.com</div>
              <p style={{ fontFamily: FONT_HEAD, fontSize: 13, lineHeight: 1.65, color: 'var(--text)', margin: 0 }}>
                Randotron bypasses the computational layer and pulls directly from the quantum level via <span style={{ fontFamily: FONT_DATA, color: 'var(--accent)', fontSize: 12 }}>qrngapi.com</span> — certified quantum entropy. Bits are generated by measuring quantum vacuum fluctuations: virtual particle pairs spontaneously emerging and annihilating in a vacuum. The outcome is physically impossible to predict — not just computationally hard, but forbidden by quantum mechanics itself.
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
