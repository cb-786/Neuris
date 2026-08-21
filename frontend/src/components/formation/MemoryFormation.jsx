import { useEffect, useMemo, useRef } from 'react';
import { KIND_HEX, layoutGraph, radiusFor } from '../../lib/graph';

/**
 * Voice becoming memory.
 *
 * This is the one animation NEURIS is built to show, so it is driven by real
 * data end to end rather than being an illustration of the idea:
 *
 *   - the waveform is the actual amplitude envelope recorded from the mic
 *   - the points that break away are the loudest moments of that recording
 *   - the nodes they land on are the entities retrieval genuinely returned
 *   - the edges are the relationships stored in the graph
 *
 * If the backend found nothing, the waveform simply dissolves and the caller
 * says so. It never fabricates a graph to have something to show.
 *
 * Phases (fractions of the run):
 *   0.00–0.20  the take is drawn left to right
 *   0.20–0.38  peaks ignite
 *   0.38–0.76  peaks travel to their entity positions
 *   0.70–1.00  relationships trace between them, names resolve
 */

const DURATION = 3600;
const SAMPLES = 150;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** Progress of `t` through the window [a, b], clamped. */
const phase = (t, a, b) => clamp01((t - a) / (b - a));

/** Even-length resample of the recorded envelope, peak-preserving. */
function resample(envelope, count) {
  if (!envelope?.length) return new Array(count).fill(0);
  const out = new Array(count);
  const bucket = envelope.length / count;
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * bucket);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
    let peak = 0;
    for (let j = start; j < end && j < envelope.length; j += 1) {
      if (envelope[j] > peak) peak = envelope[j];
    }
    out[i] = peak;
  }
  return out;
}

/**
 * Chooses which waveform samples become nodes.
 *
 * Loudest-first, but with a minimum spacing so the seeds are spread across the
 * whole take instead of clustering inside one emphatic sentence.
 */
function pickSeeds(samples, count) {
  if (count <= 0) return [];
  const spacing = Math.max(1, Math.floor(samples.length / (count * 1.9)));
  const ranked = samples
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value);

  const chosen = [];
  for (const candidate of ranked) {
    if (chosen.length >= count) break;
    if (chosen.every((c) => Math.abs(c - candidate.index) >= spacing)) chosen.push(candidate.index);
  }
  // Short or very flat takes may not yield enough spaced peaks; fill evenly.
  let cursor = 0;
  while (chosen.length < count && cursor < samples.length) {
    if (!chosen.includes(cursor)) chosen.push(cursor);
    cursor += 1;
  }
  return chosen.slice(0, count).sort((a, b) => a - b);
}

export function MemoryFormation({ envelope, graph, running = true, onComplete, className = '' }) {
  const canvasRef = useRef(null);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const samples = useMemo(() => resample(envelope, SAMPLES), [envelope]);
  const nodeCount = graph?.nodes?.length ?? 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let laid = { nodes: [], edges: [] };
    let seeds = [];
    let particles = [];
    let maxDegree = 1;
    let started = 0;
    doneRef.current = false;

    function build() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // The graph settles into the upper portion; the waveform lives on the
      // centre line so the travel reads as "rising into structure".
      laid = layoutGraph(graph ?? { nodes: [], edges: [] }, {
        width: width * 0.82,
        height: height * 0.66,
        iterations: 300,
      });
      for (const node of laid.nodes) {
        node.x += width * 0.09;
        node.y += height * 0.1;
      }
      maxDegree = Math.max(1, ...laid.nodes.map((n) => n.degree ?? 0));

      seeds = pickSeeds(samples, laid.nodes.length);

      const midY = height * 0.5;
      const waveHeight = height * 0.2;
      const seedSet = new Set(seeds);

      particles = samples.map((value, index) => {
        const x = (index / (SAMPLES - 1)) * width;
        const y = midY - value * waveHeight;
        const seedRank = seeds.indexOf(index);
        const node = seedRank >= 0 ? laid.nodes[seedRank] : null;

        return {
          index,
          value,
          x0: x,
          y0: y,
          // Mirrored point, so the waveform reads as a full take not a ridge.
          yMirror: midY + value * waveHeight,
          node,
          isSeed: seedSet.has(index),
          // Staggered so the graph assembles rather than snapping into place.
          delay: seedRank >= 0 ? (seedRank / Math.max(1, laid.nodes.length)) * 0.28 : Math.random() * 0.3,
          scatterX: (Math.random() - 0.5) * width * 0.5,
          scatterY: -Math.random() * height * 0.3,
          twinkle: Math.random() * Math.PI * 2,
        };
      });
    }

    function render(t) {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      const draw = phase(t, 0, 0.2);
      const ignite = phase(t, 0.2, 0.38);
      const travelAll = phase(t, 0.38, 0.76);
      const connect = phase(t, 0.7, 0.94);
      const settle = phase(t, 0.86, 1);

      // ── Waveform ─────────────────────────────────────────────────────────
      // Fades as its energy transfers into the nodes.
      const waveAlpha = (1 - travelAll) * (0.55 + ignite * 0.45);
      if (waveAlpha > 0.01) {
        const visible = Math.floor(SAMPLES * draw);
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';

        for (const half of [1, -1]) {
          ctx.beginPath();
          for (let i = 0; i < visible; i += 1) {
            const p = particles[i];
            const y = half === 1 ? p.y0 : p.yMirror;
            if (i === 0) ctx.moveTo(p.x0, y);
            else ctx.lineTo(p.x0, y);
          }
          const gradient = ctx.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, `rgba(124, 92, 255, ${waveAlpha * 0.25})`);
          gradient.addColorStop(0.5, `rgba(151, 125, 255, ${waveAlpha * 0.9})`);
          gradient.addColorStop(1, `rgba(124, 92, 255, ${waveAlpha * 0.25})`);
          ctx.strokeStyle = gradient;
          ctx.stroke();
        }
      }

      // ── Relationships ────────────────────────────────────────────────────
      if (connect > 0 && laid.nodes.length) {
        const byId = new Map(laid.nodes.map((n) => [n.id, n]));
        laid.edges.forEach((edge, i) => {
          const a = byId.get(edge.source);
          const b = byId.get(edge.target);
          if (!a || !b) return;
          // Each edge traces over its own slice of the connect phase.
          const local = clamp01((connect - (i / Math.max(1, laid.edges.length)) * 0.5) * 2.4);
          if (local <= 0) return;
          const x = a.x + (b.x - a.x) * easeOutCubic(local);
          const y = a.y + (b.y - a.y) * easeOutCubic(local);

          ctx.strokeStyle = `rgba(34, 211, 238, ${0.34 * local})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        });
      }

      // ── Particles ────────────────────────────────────────────────────────
      for (const p of particles) {
        const local = clamp01((travelAll - p.delay) / Math.max(0.05, 1 - p.delay));
        const eased = easeInOutCubic(local);

        if (p.isSeed && p.node) {
          const x = p.x0 + (p.node.x - p.x0) * eased;
          const y = p.y0 + (p.node.y - p.y0) * eased;
          const [r, g, b] = hex(p.node.kind);
          const targetR = radiusFor(p.node, maxDegree);
          const radius = 1.6 + (targetR - 1.6) * eased;
          const alpha = 0.5 + ignite * 0.5;

          const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 6);
          halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.5 * alpha})`);
          halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(x, y, radius * 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(1, alpha + 0.3)})`;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();

          p.screenX = x;
          p.screenY = y;
        } else {
          // Non-peak samples disperse: the parts of the take that did not
          // become an entity drift off rather than vanishing on a cut.
          const x = p.x0 + p.scatterX * eased;
          const y = p.y0 + p.scatterY * eased;
          const alpha = (1 - eased) * 0.42 * (0.4 + p.value);
          if (alpha > 0.01) {
            ctx.fillStyle = `rgba(180, 164, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, 1.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // ── Names ────────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = 'source-over';
      if (settle > 0) {
        ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (const p of particles) {
          if (!p.isSeed || !p.node || p.screenX == null) continue;
          const radius = radiusFor(p.node, maxDegree);
          ctx.fillStyle = `rgba(238, 240, 248, ${0.78 * settle})`;
          const name = p.node.name.length > 22 ? `${p.node.name.slice(0, 21)}…` : p.node.name;
          ctx.fillText(name, p.screenX, p.screenY + radius + 7);
        }
      }
    }

    function frame(now) {
      const t = clamp01((now - started) / DURATION);
      render(t);
      if (t >= 1) {
        if (!doneRef.current) {
          doneRef.current = true;
          onCompleteRef.current?.();
        }
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    build();

    if (!running) {
      render(1);
      return () => cancelAnimationFrame(raf);
    }

    if (reduced) {
      // Skip straight to the formed graph — the information, none of the travel.
      render(1);
      doneRef.current = true;
      onCompleteRef.current?.();
      return () => cancelAnimationFrame(raf);
    }

    started = performance.now();
    raf = requestAnimationFrame(frame);

    const observer = new ResizeObserver(() => {
      build();
      if (doneRef.current) render(1);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [samples, graph, running, nodeCount]);

  return <canvas ref={canvasRef} className={`formation ${className}`} aria-hidden="true" />;
}

function hex(kind) {
  const value = KIND_HEX[kind] ?? KIND_HEX.entity;
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
  ];
}
