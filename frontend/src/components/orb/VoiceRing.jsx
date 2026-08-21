import { useEffect, useRef } from 'react';
import { BANDS, metrics, WAVE_POINTS } from '../../lib/audioEngine';

/**
 * The living ring around the Memory Orb.
 *
 * Driven by the real microphone signal from the shared audio engine —
 * `metrics.bands` is genuine spectrum data and `metrics.wave` genuine
 * time-domain data. The engine's attack/release envelope is what makes quiet
 * speech produce a small crown, loud speech a large one, and a pause settle
 * gently instead of snapping flat.
 *
 * Layers, inner to outer:
 *   1. tick ring     fine ticks hugging the sphere, always alive
 *   2. waveform loop the actual waveform bent into a circle
 *   3. spike crown   144 mirrored spectrum spikes, the dominant element
 *   4. energy rings  emitted on genuinely loud moments
 *   5. particles     orbiting motes, energy-reactive and pointer-magnetic
 *
 * Colour sweeps around the circle (magenta → violet → cyan → blue) rather than
 * sitting on one hue, so the crown reads as a spectrum in itself.
 *
 * A floor amplitude keeps the crown visible even in silence. That is a visual
 * baseline, not a claim about the signal: the copy under the orb is what tells
 * the user whether NEURIS is listening, and it is driven by real state.
 */

const TAU = Math.PI * 2;

/** Colour stops swept around the ring, by angle. */
const SWEEPS = {
  voice: [
    [236, 72, 153],
    [147, 97, 255],
    [56, 189, 248],
    [99, 102, 241],
  ],
  memory: [
    [34, 211, 238],
    [56, 189, 248],
    [147, 197, 253],
    [45, 212, 191],
  ],
  live: [
    [244, 114, 182],
    [168, 85, 247],
    [56, 189, 248],
    [251, 146, 60],
  ],
};

/**
 * Linear blend between the four stops, wrapping around the circle.
 *
 * `t` is normalised into [0, 1) first. Particles orbit in both directions, so
 * their angle goes negative, and a raw `t % 1` would then index backwards off
 * the front of the array.
 */
function sweepColor(stops, t) {
  const norm = Number.isFinite(t) ? ((t % 1) + 1) % 1 : 0;
  const scaled = norm * stops.length;
  const i = Math.floor(scaled) % stops.length;
  const f = scaled - Math.floor(scaled);
  const a = stops[i];
  const b = stops[(i + 1) % stops.length];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

const PARTICLE_COUNT = 42;

export function VoiceRing({ state = 'idle', hue = 'voice', pointerRef, className = '' }) {
  const canvasRef = useRef(null);
  const viewRef = useRef({ state, hue });
  viewRef.current = { state, hue };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let size = 0;
    let dpr = 1;
    let rotation = 0;
    let lastEmit = 0;
    const started = performance.now();

    const idleWave = new Float32Array(WAVE_POINTS);
    const idleBands = new Float32Array(BANDS);
    const rings = [];

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      angle: Math.random() * TAU,
      radius: 0.44 + Math.random() * 0.24,
      speed: (0.00006 + Math.random() * 0.00016) * (Math.random() < 0.5 ? -1 : 1),
      size: 0.6 + Math.random() * 1.5,
      phase: Math.random() * TAU,
      ox: 0,
      oy: 0,
    }));

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = rect.width;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!size) return;

      const { state, hue } = viewRef.current;
      const stops = SWEEPS[hue] ?? SWEEPS.voice;
      const elapsed = now - started;

      const listening = state === 'listening';
      const processing = state === 'processing';
      const forming = state === 'forming';
      const working = processing || forming;
      const live = metrics.active && listening;

      // ── Source ───────────────────────────────────────────────────────────
      let wave;
      let bands;
      let level;
      let energy;

      if (live) {
        wave = metrics.wave;
        bands = metrics.bands;
        level = metrics.level;
        energy = metrics.energy;
      } else {
        const speed = working ? 0.0034 : 0.0012;
        const depth = working ? 0.3 : 0.14;
        for (let i = 0; i < WAVE_POINTS; i += 1) {
          idleWave[i] = Math.sin(elapsed * speed + (i / WAVE_POINTS) * TAU * 3) * depth;
        }
        for (let i = 0; i < BANDS; i += 1) {
          // Two detuned waves so the resting crown is uneven, like a signal,
          // rather than a rotating sine that reads as decoration.
          idleBands[i] =
            (working ? 0.3 : 0.2) +
            Math.sin(elapsed * speed - i * 0.28) * (working ? 0.18 : 0.11) +
            Math.sin(elapsed * speed * 0.53 + i * 0.61) * 0.07;
        }
        wave = idleWave;
        bands = idleBands;
        level = working ? 0.36 : 0.16;
        energy = working ? 0.5 : 0.18;
      }

      const cx = size / 2;
      const cy = size / 2;

      // Radii as fractions of the canvas. The sphere occupies the middle 40%,
      // so the crown has real room to extend without clipping.
      const tickBase = size * 0.232;
      const tickLen = size * 0.026;
      const waveR = size * 0.278;
      const spikeBase = size * 0.305;
      const spikeMax = size * 0.185;

      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';

      if (!reduced) {
        rotation += processing ? 0.0038 : listening ? 0.0009 : 0.0004;
      }

      // ── 1. Tick ring ────────────────────────────────────────────────────
      // Fine, dense, and always present, so the orb never looks switched off.
      const TICKS = 96;
      ctx.lineWidth = 1;
      for (let i = 0; i < TICKS; i += 1) {
        const angle = (i / TICKS) * TAU - rotation * 1.6;
        const band = bands[Math.floor((i / TICKS) * BANDS)] ?? 0;
        // Ticks answer the voice too, just far more subtly than the crown.
        const len = tickLen * (0.4 + band * (live ? 0.6 + level * 1.6 : 0.9));
        const [r, g, b] = sweepColor(stops, i / TICKS);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.3 + band * 0.45})`;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * tickBase, cy + Math.sin(angle) * tickBase);
        ctx.lineTo(cx + Math.cos(angle) * (tickBase + len), cy + Math.sin(angle) * (tickBase + len));
        ctx.stroke();
      }

      // ── 2. Waveform loop ────────────────────────────────────────────────
      // Amplitude scales with loudness on top of the waveform's own values, so
      // the loop visibly swells when the voice does.
      const waveAmp = size * 0.026 * (live ? 1.2 + level * 2.6 : 1);
      ctx.beginPath();
      for (let i = 0; i <= WAVE_POINTS; i += 1) {
        const index = i % WAVE_POINTS;
        const angle = (index / WAVE_POINTS) * TAU + rotation;
        const r = waveR + wave[index] * waveAmp;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const [wr, wg, wb] = sweepColor(stops, 0.5);
      ctx.strokeStyle = `rgba(${wr}, ${wg}, ${wb}, ${live ? 0.5 + level * 0.5 : 0.34})`;
      ctx.lineWidth = Math.max(1.1, size * 0.0042);
      ctx.stroke();

      // ── 3. Spike crown ──────────────────────────────────────────────────
      // The dominant element, and the thing that has to answer the voice.
      //
      // Two independent inputs drive every spike:
      //   shape  the band's own magnitude — gives the crown its silhouette
      //   drive  overall loudness — scales the whole crown up and down
      //
      // Keeping them separate is what makes volume legible: without `drive`
      // the crown only changes shape, and a shout looks much like a whisper.
      const total = BANDS * 2;
      const step = TAU / total;

      // The floor matters more than it looks. A muted or very quiet microphone
      // produces near-zero bands, and with a small floor the crown collapses
      // into nothing and reads as "the visualiser is broken". This keeps a
      // clearly visible ring at all times while leaving most of the range for
      // the voice to drive.
      const floor = live ? 0.12 : 0.18;
      // Quiet speech lifts the crown a little; a loud voice pushes it to full
      // reach. Idle holds a steady mid drive so the resting ring still moves.
      const drive = live ? 0.35 + level * 1.8 : 0.8;

      ctx.lineCap = 'round';
      for (let i = 0; i < total; i += 1) {
        // Mirrored: speech spectra are lopsided and an unmirrored crown
        // visibly leans to one side.
        const bandIndex = i < BANDS ? i : total - 1 - i;
        const shape = bands[bandIndex] ?? 0;
        const magnitude = Math.min(1, floor + shape * drive);

        const angle = -Math.PI / 2 + i * step + rotation * 0.55;
        const reach = spikeMax * magnitude;

        const x1 = cx + Math.cos(angle) * spikeBase;
        const y1 = cy + Math.sin(angle) * spikeBase;
        const x2 = cx + Math.cos(angle) * (spikeBase + reach);
        const y2 = cy + Math.sin(angle) * (spikeBase + reach);

        const [r, g, b] = sweepColor(stops, i / total);
        const intensity = 0.35 + magnitude * 0.65;

        // Bloom pass
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${intensity * 0.22})`;
        ctx.lineWidth = Math.max(3, size * 0.016);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Core pass, fading out along its length
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity})`);
        gradient.addColorStop(0.65, `rgba(${r}, ${g}, ${b}, ${intensity * 0.75})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = Math.max(1.5, size * 0.0058);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Ambient bloom sitting under the crown.
      const glow = ctx.createRadialGradient(cx, cy, spikeBase * 0.8, cx, cy, spikeBase + spikeMax);
      const [gr, gg, gb] = sweepColor(stops, 0.25);
      glow.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, 0)`);
      glow.addColorStop(0.45, `rgba(${gr}, ${gg}, ${gb}, ${0.09 + level * 0.16})`);
      glow.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, spikeBase + spikeMax, 0, TAU);
      ctx.fill();

      // ── 4. Energy rings ─────────────────────────────────────────────────
      if (!reduced && live && metrics.raw > 0.24 && now - lastEmit > 300) {
        lastEmit = now;
        rings.push({ t: 0, strength: Math.min(1, metrics.raw * 1.4) });
      }
      if (!reduced && working && now - lastEmit > 900) {
        lastEmit = now;
        rings.push({ t: 0, strength: 0.5 });
      }
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const ring = rings[i];
        ring.t += 0.011;
        if (ring.t >= 1) {
          rings.splice(i, 1);
          continue;
        }
        const eased = 1 - Math.pow(1 - ring.t, 2);
        const [r, g, b] = sweepColor(stops, ring.t);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(1 - ring.t) * 0.3 * ring.strength})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, spikeBase + spikeMax * 0.5 + eased * size * 0.12, 0, TAU);
        ctx.stroke();
      }

      // ── 5. Particles ────────────────────────────────────────────────────
      const pointer = pointerRef?.current;
      for (const p of particles) {
        if (!reduced) p.angle += p.speed * (1 + energy * 5) * 16;

        const converge = working ? 0.74 : 1;
        const breathe = 1 + Math.sin(elapsed * 0.0006 + p.phase) * 0.06;
        const orbit = size * p.radius * converge * breathe * (1 + level * 0.1);

        let x = cx + Math.cos(p.angle) * orbit;
        let y = cy + Math.sin(p.angle) * orbit;

        if (pointer?.inside && !reduced) {
          const dx = pointer.x - x;
          const dy = pointer.y - y;
          const dist = Math.hypot(dx, dy) || 1;
          const pull = Math.max(0, 1 - dist / (size * 0.42)) * 14;
          p.ox += ((dx / dist) * pull - p.ox) * 0.08;
          p.oy += ((dy / dist) * pull - p.oy) * 0.08;
        } else {
          p.ox += -p.ox * 0.06;
          p.oy += -p.oy * 0.06;
        }
        x += p.ox;
        y += p.oy;

        const [r, g, b] = sweepColor(stops, p.angle / TAU);
        const alpha = (0.18 + energy * 0.5) * (0.5 + Math.sin(elapsed * 0.001 + p.phase) * 0.5);
        const radius = p.size * (1 + level * 0.5);

        const dot = ctx.createRadialGradient(x, y, 0, x, y, radius * 5);
        dot.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        dot.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = dot;
        ctx.beginPath();
        ctx.arc(x, y, radius * 5, 0, TAU);
        ctx.fill();
      }

      // ── Processing sweep ────────────────────────────────────────────────
      if (processing) {
        const sweepStart = rotation * 3.4;
        const [r, g, b] = sweepColor(stops, 0.6);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
        ctx.lineWidth = Math.max(1.6, size * 0.0075);
        ctx.beginPath();
        ctx.arc(cx, cy, spikeBase + spikeMax * 0.6, sweepStart, sweepStart + Math.PI * 0.4);
        ctx.stroke();
      }

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
  }, [pointerRef]);

  return <canvas ref={canvasRef} className={`voice-ring ${className}`} aria-hidden="true" />;
}
