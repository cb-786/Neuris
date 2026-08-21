import { useEffect, useRef } from 'react';
import { BANDS, metrics } from '../../lib/audioEngine';

/**
 * The horizontal waveform that radiates out of the Memory Orb.
 *
 * Bars march outward from the centre in both directions, mirrored above and
 * below the centre line, so the orb sits inside its own voice. Cyan flows to
 * the left, violet to the right — memory out, voice in.
 *
 * Everything is driven by the shared audio engine's real analyser output:
 *
 *   height = bands[i]            per-bar shape, from the frequency spectrum
 *          × (0.22 + level×2.4)  overall loudness, so volume is legible
 *          × falloff(distance)   envelope that tapers the tails to nothing
 *
 * Separating shape from loudness is what makes a shout look different from a
 * whisper. With only the per-band shape the waveform changes silhouette but
 * not size, which is the usual reason these visualisers feel fake.
 *
 * Frequencies are mapped by distance from the centre: low frequencies sit
 * nearest the orb where the bars are tallest and slowest, high frequencies at
 * the tips where the fine detail and sparks live.
 *
 * One canvas, one requestAnimationFrame, no React state per frame.
 */

const TAU = Math.PI * 2;
/** Bars per side. Dense enough to read as a waveform, cheap enough to be free. */
const BARS = 72;

const SIDES = {
  // [near-orb, mid, tip] — each side fades from its accent into white-hot.
  left: [
    [34, 211, 238],
    [56, 189, 248],
    [186, 230, 253],
  ],
  right: [
    [168, 85, 247],
    [217, 70, 239],
    [240, 171, 252],
  ],
};

function lerp3(stops, t) {
  const scaled = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = stops[i];
  const b = stops[Math.min(stops.length - 1, i + 1)];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

export function WaveField({ state = 'idle', className = '' }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const started = performance.now();

    const idleBands = new Float32Array(BANDS);
    /** Sparks thrown off the tips of tall bars while speaking. */
    const sparks = [];

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!w || !h) return;

      const state = stateRef.current;
      const listening = state === 'listening';
      const working = state === 'processing' || state === 'forming';
      const live = metrics.active && listening;
      const elapsed = now - started;

      let bands;
      let level;
      if (live) {
        bands = metrics.bands;
        level = metrics.level;
      } else {
        // Resting breath. Deliberately shallow so it never passes for speech.
        for (let i = 0; i < BANDS; i += 1) {
          idleBands[i] =
            (working ? 0.24 : 0.1) +
            Math.sin(elapsed * (working ? 0.0032 : 0.0011) - i * 0.3) * (working ? 0.12 : 0.055) +
            Math.sin(elapsed * 0.0007 + i * 0.55) * 0.03;
        }
        bands = idleBands;
        level = working ? 0.3 : 0.1;
      }

      const cx = w / 2;
      const cy = h / 2;
      // The bars start outside the sphere and run to the edge of the canvas.
      const inner = h * 0.28;
      const span = cx - inner;
      const maxBar = h * 0.42;

      // Loudness scales the whole waveform; this is what makes volume visible.
      const drive = live ? 0.22 + level * 2.4 : working ? 0.55 : 0.32;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      for (const side of [-1, 1]) {
        const stops = side === -1 ? SIDES.left : SIDES.right;

        for (let i = 0; i < BARS; i += 1) {
          const t = i / (BARS - 1);
          const x = cx + side * (inner + t * span);

          // Frequency by distance: lows near the orb, highs at the tips.
          const band = bands[Math.min(BANDS - 1, Math.floor(t * BANDS))] ?? 0;

          // Envelope: rises just off the orb, tapers to nothing at the edge,
          // so the waveform reads as emanating rather than being cropped.
          const falloff = Math.pow(1 - t, 1.5) * Math.min(1, t * 9 + 0.12);
          // A slow travelling ripple keeps the tails from looking static.
          const ripple = 1 + Math.sin(elapsed * 0.0016 - t * 7 + (side === -1 ? 0 : Math.PI)) * 0.14;

          const height = maxBar * band * drive * falloff * ripple;
          if (height < 0.6) continue;

          const [r, g, b] = lerp3(stops, t);
          const alpha = 0.32 + band * drive * 0.5;

          // Bloom pass, then a bright core — cheaper than a canvas shadow and
          // it gives the bars their neon edge.
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.5, alpha * 0.3)})`;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(x, cy - height);
          ctx.lineTo(x, cy + height);
          ctx.stroke();

          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, cy - height);
          ctx.lineTo(x, cy + height);
          ctx.stroke();

          // Sparks off genuinely tall bars only.
          if (!reduced && live && height > maxBar * 0.42 && Math.random() < 0.012) {
            sparks.push({
              x,
              y: cy + (Math.random() < 0.5 ? -height : height),
              vx: side * (0.3 + Math.random() * 0.9),
              vy: (Math.random() - 0.5) * 1.1,
              life: 1,
              rgb: [r, g, b],
            });
          }
        }
      }

      // ── Sparks ────────────────────────────────────────────────────────────
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.016;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 5);
        glow.addColorStop(0, `rgba(${s.rgb.join(',')}, ${s.life * 0.7})`);
        glow.addColorStop(1, `rgba(${s.rgb.join(',')}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, TAU);
        ctx.fill();
      }

      // ── Centre line ───────────────────────────────────────────────────────
      // A faint thread joining the two tails through the orb.
      const line = ctx.createLinearGradient(0, 0, w, 0);
      line.addColorStop(0, 'rgba(34, 211, 238, 0)');
      line.addColorStop(0.3, `rgba(34, 211, 238, ${0.1 + level * 0.2})`);
      line.addColorStop(0.7, `rgba(168, 85, 247, ${0.1 + level * 0.2})`);
      line.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(w, cy);
      ctx.stroke();

      ctx.globalCompositeOperation = 'source-over';
    }

    resize();
    raf = requestAnimationFrame(frame);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={`wavefield ${className}`} aria-hidden="true" />;
}
