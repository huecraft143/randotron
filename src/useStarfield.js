import { useEffect, useRef } from 'react';

// Animated cosmic background (drifting starfield + nebula glows) drawn on a
// full-screen canvas. Self-contained: handles resize, DPR scaling, and cleanup.
export function useStarfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, raf = 0;
    let stars = [], neb = [];

    const initParticles = () => {
      const r = Math.random;
      stars = Array.from({ length: 150 }, () => ({ x: r() * W, y: r() * H, z: r(), p: r() * 6.28 }));
      neb = Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: r() * H, h: i }));
    };

    const resize = () => {
      const d = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * d; cv.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      if (!stars.length) initParticles();
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);
      neb.forEach((nb, i) => {
        const x = nb.x + Math.sin(t * 0.05 + i) * 50;
        const y = nb.y + Math.cos(t * 0.04 + i) * 35;
        const col = i % 2 ? '125,249,255' : '179,136,255';
        const g = ctx.createRadialGradient(x, y, 0, x, y, 280);
        g.addColorStop(0, `rgba(${col},0.10)`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - 280, y - 280, 560, 560);
      });
      stars.forEach((s) => {
        ctx.globalAlpha = 0.3 + 0.55 * Math.abs(Math.sin(t * (0.6 + s.z) + s.p));
        ctx.fillStyle = s.z > 0.85 ? '#b388ff' : '#eaf4ff';
        ctx.beginPath();
        ctx.arc((s.x + t * 6 * s.z) % W, s.y, s.z * 1.5 + 0.3, 0, 6.28);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    resize();
    window.addEventListener('resize', resize);
    const t0 = performance.now();
    const loop = (now) => { draw((now - t0) / 1000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return canvasRef;
}
