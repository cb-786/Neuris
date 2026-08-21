import { useEffect, useRef } from 'react';
import { KIND_HEX } from '../../lib/graph';
import { metrics } from '../../lib/audioEngine';

/**
 * The space NEURIS lives in.
 *
 * One fixed canvas behind every route: a drifting constellation of memory
 * clusters, faint connections between them, and signals travelling along
 * those connections. It never unmounts on navigation, so moving between
 * Recall, Capture and Memory Space feels like moving through one place.
 *
 * Depth is the point. Nodes are distributed across three parallax layers with
 * different sizes, opacities, drift speeds and blur, so the field reads as a
 * volume rather than a flat particle wallpaper.
 *
 * Performance notes, because this runs on every screen:
 *   - glow sprites are pre-rendered once per palette entry and blitted with
 *     drawImage; building a radial gradient per node per frame is what makes
 *     canvas fields expensive, and this avoids it entirely
 *   - the far layer is rendered at half resolution onto an offscreen buffer
 *     and scaled up, which gives real blur for free
 *   - audio comes from the shared engine's mutable metrics, so the field
 *     reacts to the voice without causing a single React render
 *   - capped at ~28fps, paused when the tab is hidden, one static frame under
 *     prefers-reduced-motion
 */

const FPS_INTERVAL = 1000 / 28;
const TAU = Math.PI * 2;

/** Node budget per depth layer, scaled to viewport area. */
function densityFor(width, height) {
  const area = width * height;
  if (area < 420_000) return { far: 44, mid: 22, near: 9, motes: 30 };
  if (area < 1_100_000) return { far: 78, mid: 34, near: 14, motes: 54 };
  return { far: 110, mid: 48, near: 20, motes: 78 };
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Pre-renders a soft radial dot once, so the loop only ever blits. */
function makeSprite(rgb, radius) {
  const s = document.createElement('canvas');
  const size = Math.max(4, Math.ceil(radius * 2));
  s.width = size;
  s.height = size;
  const c = s.getContext('2d');
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
  const [r, gg, b] = rgb;
  g.addColorStop(0, `rgba(${r}, ${gg}, ${b}, 1)`);
  g.addColorStop(0.32, `rgba(${r}, ${gg}, ${b}, 0.34)`);
  g.addColorStop(1, `rgba(${r}, ${gg}, ${b}, 0)`);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return s;
}

export function MemoryField({ mode = 'idle', kinds }) {
  const canvasRef = useRef(null);
  const modeRef = useRef(mode);
  const kindsRef = useRef(kinds);
  modeRef.current = mode;
  kindsRef.current = kinds;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    const started = performance.now();

    /** Offscreen buffer for the blurred far layer. */
    const farBuffer = document.createElement('canvas');
    const farCtx = farBuffer.getContext('2d');

    let layers = [];
    let links = [];
    let motes = [];
    let signals = [];
    let sprites = new Map();

    // Pointer parallax, heavily damped so it reads as depth, not tracking.
    const pointer = { x: 0.5, y: 0.5, cx: 0.5, cy: 0.5 };

    function build() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Half-resolution buffer: cheap, and upscaling is what blurs it.
      farBuffer.width = Math.max(1, Math.round(width / 2));
      farBuffer.height = Math.max(1, Math.round(height / 2));

      const budget = densityFor(width, height);
      const rand = mulberry(0x5eed);

      // Palette follows the user's real graph when we know it; otherwise the
      // house split, so an empty NEURIS still looks like NEURIS.
      const available =
        Array.isArray(kindsRef.current) && kindsRef.current.length
          ? kindsRef.current
          : ['person', 'topic'];

      sprites = new Map();
      for (const kind of [...available, 'unknown']) {
        const rgb = hexToRgb(KIND_HEX[kind] ?? KIND_HEX.unknown);
        sprites.set(kind, { sprite: makeSprite(rgb, 26), rgb });
      }

      // Three depth bands. `depth` 0 = far, 1 = near, and it drives size,
      // brightness, drift speed and parallax together.
      const specs = [
        { key: 'far', count: budget.far, depth: 0.18, r: [0.7, 1.7], alpha: [0.1, 0.26] },
        { key: 'mid', count: budget.mid, depth: 0.52, r: [1.4, 3.0], alpha: [0.24, 0.5] },
        { key: 'near', count: budget.near, depth: 1, r: [2.4, 4.6], alpha: [0.4, 0.78] },
      ];

      layers = specs.map((spec) => {
        const nodes = [];
        // Cluster centres per layer, so each depth has its own communities.
        const clusterCount = Math.max(2, Math.round(spec.count / 7));
        const centres = Array.from({ length: clusterCount }, () => ({
          x: (0.04 + rand() * 0.92) * width,
          y: (0.04 + rand() * 0.92) * height,
          spread: (0.08 + rand() * 0.16) * Math.min(width, height),
        }));

        for (let i = 0; i < spec.count; i += 1) {
          const centre = centres[Math.floor(rand() * centres.length)];
          const angle = rand() * TAU;
          // pow < 1 concentrates toward the cluster centre without making it
          // a hard disc.
          const dist = Math.pow(rand(), 0.62) * centre.spread;
          const kind = available[Math.floor(rand() * available.length)] ?? 'topic';

          nodes.push({
            hx: centre.x + Math.cos(angle) * dist,
            hy: centre.y + Math.sin(angle) * dist,
            x: 0,
            y: 0,
            r: spec.r[0] + rand() * (spec.r[1] - spec.r[0]),
            alpha: spec.alpha[0] + rand() * (spec.alpha[1] - spec.alpha[0]),
            kind,
            phase: rand() * TAU,
            speed: (0.00005 + rand() * 0.00014) * (0.4 + spec.depth),
            amp: (5 + rand() * 18) * (0.5 + spec.depth),
            cluster: centres.indexOf(centre),
          });
        }
        return { ...spec, nodes };
      });

      // Connections are drawn only between mid and near nodes. Linking the far
      // layer as well turns the background into a mesh, which is exactly the
      // technical diagram look to avoid.
      links = [];
      const connectable = [
        ...layers[1].nodes.map((n) => ({ n, layer: 1 })),
        ...layers[2].nodes.map((n) => ({ n, layer: 2 })),
      ];

      for (let i = 0; i < connectable.length; i += 1) {
        for (let j = i + 1; j < connectable.length; j += 1) {
          const a = connectable[i];
          const b = connectable[j];
          const same = a.n.cluster === b.n.cluster && a.layer === b.layer;
          const dist = Math.hypot(a.n.hx - b.n.hx, a.n.hy - b.n.hy);
          const reach = Math.min(width, height) * (same ? 0.18 : 0.26);
          if (dist > reach) continue;
          if (!same && rand() > 0.1) continue;
          if (same && rand() > 0.42) continue;

          links.push({
            a: a.n,
            b: b.n,
            // Wide variation so some edges are nearly invisible and a few
            // read clearly, rather than all sitting at one opacity.
            base: 0.02 + Math.pow(rand(), 2) * 0.12,
            bow: (rand() - 0.5) * 0.3,
            depth: (a.n.alpha + b.n.alpha) / 2,
          });
        }
      }

      motes = Array.from({ length: budget.motes }, () => ({
        x: rand() * width,
        y: rand() * height,
        r: 0.4 + rand() * 1.1,
        depth: 0.2 + rand() * 0.8,
        drift: 0.0016 + rand() * 0.005,
        phase: rand() * TAU,
        alpha: 0.08 + rand() * 0.26,
      }));

      signals = [];
    }

    function draw(now) {
      const elapsed = now - started;
      const mode = modeRef.current;

      const listening = mode === 'listening';
      const recalling = mode === 'recalling';
      const forming = mode === 'forming';

      // Real audio when a stream is open, a resting baseline otherwise.
      const level = metrics.active ? metrics.level : 0;
      const energy = metrics.active
        ? metrics.energy
        : recalling || forming
          ? 0.45
          : 0.12;

      const activity = listening ? 0.55 + energy * 0.45 : recalling || forming ? 0.6 : 0.24;

      pointer.cx += (pointer.x - pointer.cx) * 0.03;
      pointer.cy += (pointer.y - pointer.cy) * 0.03;
      const px = (pointer.cx - 0.5) * 2;
      const py = (pointer.cy - 0.5) * 2;

      // Processing draws the field gently inward — voice condensing to memory.
      const pull = recalling || forming ? 0.05 : 0;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);
      farCtx.clearRect(0, 0, farBuffer.width, farBuffer.height);

      // ── Resolve positions ───────────────────────────────────────────────
      for (const layer of layers) {
        const par = layer.depth * 26;
        for (const node of layer.nodes) {
          const wobble = elapsed * node.speed;
          const driftX = Math.sin(wobble + node.phase) * node.amp * (0.6 + activity * 0.7);
          const driftY = Math.cos(wobble * 0.83 + node.phase) * node.amp * 0.7 * (0.6 + activity * 0.7);
          let x = node.hx + driftX - px * par;
          let y = node.hy + driftY - py * par;
          if (pull) {
            x += (cx - x) * pull;
            y += (cy - y) * pull;
          }
          node.x = x;
          node.y = y;
        }
      }

      // ── Far layer, into the half-res buffer ─────────────────────────────
      farCtx.globalCompositeOperation = 'lighter';
      const far = layers[0];
      for (const node of far.nodes) {
        const entry = sprites.get(node.kind) ?? sprites.get('unknown');
        const radius = node.r * (1 + level * 0.2) * 7;
        farCtx.globalAlpha = node.alpha * (0.6 + activity * 0.5);
        farCtx.drawImage(
          entry.sprite,
          (node.x - radius) / 2,
          (node.y - radius) / 2,
          radius,
          radius
        );
      }
      farCtx.globalAlpha = 1;

      ctx.globalCompositeOperation = 'lighter';
      // Upscaling the half-res buffer is what softens the far layer.
      ctx.drawImage(farBuffer, 0, 0, width, height);

      // ── Connections ─────────────────────────────────────────────────────
      ctx.lineWidth = 0.7;
      for (const link of links) {
        const { a, b } = link;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        // Control point pushed perpendicular to the chord, so no two edges
        // read as parallel straight lines.
        const ctrlX = mx - dy * link.bow;
        const ctrlY = my + dx * link.bow;

        // Each edge breathes on its own phase, so the web is never uniform.
        const shimmer = 0.75 + Math.sin(elapsed * 0.0004 + link.bow * 40) * 0.25;
        const alpha = link.base * shimmer * (0.5 + activity) * (0.5 + link.depth);

        ctx.strokeStyle = `rgba(150, 170, 255, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, b.x, b.y);
        ctx.stroke();
      }

      // ── Signals travelling between memories ─────────────────────────────
      const spawn = listening
        ? 0.02 + level * 0.16
        : recalling || forming
          ? 0.09
          : 0.012;
      if (!reduced && links.length && signals.length < 22 && Math.random() < spawn) {
        signals.push({
          link: links[Math.floor(Math.random() * links.length)],
          t: 0,
          speed: 0.004 + Math.random() * 0.007,
        });
      }

      const signalRgb = recalling || forming ? [34, 211, 238] : listening ? [245, 150, 110] : [124, 92, 255];
      for (let i = signals.length - 1; i >= 0; i -= 1) {
        const signal = signals[i];
        signal.t += signal.speed;
        if (signal.t >= 1) {
          signals.splice(i, 1);
          continue;
        }
        const { a, b, bow } = signal.link;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const ctrlX = mx - (b.y - a.y) * bow;
        const ctrlY = my + (b.x - a.x) * bow;

        const t = signal.t;
        const inv = 1 - t;
        const x = inv * inv * a.x + 2 * inv * t * ctrlX + t * t * b.x;
        const y = inv * inv * a.y + 2 * inv * t * ctrlY + t * t * b.y;
        // Fade in and out, so signals emerge and dissolve rather than blink.
        const fade = Math.sin(t * Math.PI);

        const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
        glow.addColorStop(0, `rgba(${signalRgb.join(',')}, ${0.55 * fade})`);
        glow.addColorStop(1, `rgba(${signalRgb.join(',')}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, TAU);
        ctx.fill();
      }

      // ── Mid and near layers ─────────────────────────────────────────────
      for (let l = 1; l < layers.length; l += 1) {
        const layer = layers[l];
        for (const node of layer.nodes) {
          const entry = sprites.get(node.kind) ?? sprites.get('unknown');
          const pulse = 1 + Math.sin(elapsed * 0.0005 + node.phase) * 0.14;
          const radius = node.r * pulse * (1 + level * 0.3) * 8;

          ctx.globalAlpha = node.alpha * (0.55 + activity * 0.5);
          ctx.drawImage(entry.sprite, node.x - radius, node.y - radius, radius * 2, radius * 2);

          // A hard centre on the nearest layer only, so those points read as
          // solid objects while the rest stay atmospheric.
          if (l === 2) {
            ctx.globalAlpha = Math.min(1, node.alpha + 0.2);
            ctx.fillStyle = `rgba(${entry.rgb.join(',')}, 1)`;
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.r * 0.62, 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;

      // ── Dust ────────────────────────────────────────────────────────────
      for (const mote of motes) {
        mote.y -= mote.drift * (0.6 + activity) * 16;
        mote.x += Math.sin(elapsed * 0.0002 + mote.phase) * 0.05;
        if (mote.y < -6) {
          mote.y = height + 6;
          mote.x = Math.random() * width;
        }
        ctx.fillStyle = `rgba(190, 205, 255, ${mote.alpha * (0.45 + activity * 0.55)})`;
        ctx.beginPath();
        ctx.arc(mote.x - px * mote.depth * 12, mote.y - py * mote.depth * 12, mote.r, 0, TAU);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
    }

    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (now - last < FPS_INTERVAL) return;
      last = now;
      if (document.visibilityState !== 'visible') return;
      draw(now);
    }

    function onPointerMove(event) {
      pointer.x = event.clientX / window.innerWidth;
      pointer.y = event.clientY / window.innerHeight;
    }

    let resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        build();
        if (reduced) draw(performance.now());
      }, 160);
    }

    build();

    if (reduced) {
      // One frame: the field still establishes the space, it just holds still.
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(loop);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [kinds]);

  return (
    <div className={`memory-field memory-field--${mode}`} aria-hidden="true">
      <canvas ref={canvasRef} className="memory-field__canvas" />
      <div className="memory-field__vignette" />
    </div>
  );
}
