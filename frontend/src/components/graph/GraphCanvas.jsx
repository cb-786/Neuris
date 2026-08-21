import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildAdjacency, KIND_HEX, layoutGraph, radiusFor } from '../../lib/graph';

/**
 * The spatial view of stored memory.
 *
 * Canvas rather than DOM: a few hundred nodes with glow and per-frame drift
 * would be hundreds of composited layers as elements, and the whole point of
 * this view is that it stays fluid while you move through it.
 *
 * Canvas is not focusable content, so the accessible representation is a real
 * list of nodes rendered alongside it by the parent (see MemorySpace) — the
 * canvas is labelled and summarised, and every node remains reachable there.
 *
 * Interaction: drag to pan, wheel or pinch to zoom, hover to isolate a node's
 * neighbourhood, click to select.
 */

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 3.2;

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function GraphCanvas({
  graph,
  selectedId = null,
  onSelect,
  onHover,
  className = '',
  emptyLabel = 'No memories yet',
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hoverId, setHoverId] = useState(null);

  // View transform and interaction state live in refs — they change on every
  // pointer move and must not drive React renders.
  const viewRef = useRef({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef(null);
  const layoutRef = useRef({ nodes: [], edges: [] });
  const hoverRef = useRef(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const adjacency = useMemo(() => buildAdjacency(graph), [graph]);

  // Layout is expensive and deterministic, so it is computed once per graph and
  // per viewport size, never per frame.
  const laid = useMemo(() => {
    if (!graph?.nodes?.length || !size.width) return { nodes: [], edges: [] };
    return layoutGraph(graph, {
      width: size.width,
      height: size.height,
      iterations: graph.nodes.length > 160 ? 220 : 320,
    });
  }, [graph, size.width, size.height]);

  layoutRef.current = laid;

  const maxDegree = useMemo(
    () => Math.max(1, ...laid.nodes.map((n) => n.degree ?? 0)),
    [laid]
  );

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  /** Screen point -> graph point, accounting for pan and zoom. */
  const toGraph = useCallback((clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const view = viewRef.current;
    return {
      x: (clientX - rect.left - view.x) / view.zoom,
      y: (clientY - rect.top - view.y) / view.zoom,
    };
  }, []);

  const hitTest = useCallback(
    (clientX, clientY) => {
      const point = toGraph(clientX, clientY);
      const nodes = layoutRef.current.nodes;
      let best = null;
      let bestDist = Infinity;
      for (const node of nodes) {
        const radius = radiusFor(node, maxDegree);
        // Generous target: fine motor precision should not be required to
        // inspect a memory.
        const reach = Math.max(radius + 8, 14);
        const dist = Math.hypot(node.x - point.x, node.y - point.y);
        if (dist <= reach && dist < bestDist) {
          best = node;
          bestDist = dist;
        }
      }
      return best;
    },
    [toGraph, maxDegree]
  );

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);

    let raf = 0;
    const started = performance.now();

    function paint(now) {
      raf = requestAnimationFrame(paint);

      const { nodes, edges } = layoutRef.current;
      const view = viewRef.current;
      const hovered = hoverRef.current;
      const selected = selectedRef.current;
      const focusId = hovered ?? selected;
      const neighbours = focusId ? adjacency.get(focusId) : null;
      const elapsed = reduced ? 0 : now - started;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);
      ctx.save();
      ctx.translate(view.x, view.y);
      ctx.scale(view.zoom, view.zoom);
      ctx.globalCompositeOperation = 'lighter';

      const byId = new Map(nodes.map((n) => [n.id, n]));

      // Breathing offsets keep the space feeling alive without moving anything
      // far enough to make a node hard to click.
      const drift = (node, i) =>
        reduced ? 0 : Math.sin(elapsed * 0.00035 + i * 0.7) * 2.2;

      // ── Edges ──────────────────────────────────────────────────────────
      for (const edge of edges) {
        const a = byId.get(edge.source);
        const b = byId.get(edge.target);
        if (!a || !b) continue;

        const related =
          !focusId || edge.source === focusId || edge.target === focusId;
        const alpha = focusId ? (related ? 0.55 : 0.045) : 0.16;

        ctx.strokeStyle = related && focusId
          ? `rgba(34, 211, 238, ${alpha})`
          : `rgba(150, 170, 255, ${alpha})`;
        ctx.lineWidth = related && focusId ? 1.4 / view.zoom : 0.8 / view.zoom;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + drift(a, 1));
        ctx.lineTo(b.x, b.y + drift(b, 2));
        ctx.stroke();
      }

      // ── Nodes ──────────────────────────────────────────────────────────
      nodes.forEach((node, i) => {
        const isFocus = node.id === focusId;
        const isNeighbour = neighbours?.has(node.id);
        const dimmed = focusId && !isFocus && !isNeighbour;

        const [r, g, b] = hexToRgb(KIND_HEX[node.kind] ?? KIND_HEX.unknown);
        const radius = radiusFor(node, maxDegree) * (isFocus ? 1.35 : 1);
        const y = node.y + drift(node, i);
        const alpha = dimmed ? 0.14 : isFocus ? 1 : isNeighbour ? 0.92 : 0.66;

        const haloR = radius * (isFocus ? 7 : 4.5);
        const halo = ctx.createRadialGradient(node.x, y, 0, node.x, y, haloR);
        halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.42 * alpha})`);
        halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(node.x, y, haloR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(node.x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (isFocus) {
          ctx.strokeStyle = `rgba(238, 240, 248, 0.85)`;
          ctx.lineWidth = 1.5 / view.zoom;
          ctx.beginPath();
          ctx.arc(node.x, y, radius + 5 / view.zoom, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // ── Labels ─────────────────────────────────────────────────────────
      // Only for nodes that earn one: the well-connected, the focused, and its
      // neighbours. Labelling everything turns the space into a word cloud.
      ctx.globalCompositeOperation = 'source-over';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelSize = Math.max(9, Math.min(13, 11 / view.zoom));
      ctx.font = `500 ${labelSize}px "JetBrains Mono", ui-monospace, monospace`;

      nodes.forEach((node, i) => {
        const isFocus = node.id === focusId;
        const isNeighbour = neighbours?.has(node.id);
        const prominent = (node.degree ?? 0) >= Math.max(2, maxDegree * 0.45);
        if (!isFocus && !isNeighbour && !(prominent && view.zoom > 0.62)) return;
        if (focusId && !isFocus && !isNeighbour) return;

        const radius = radiusFor(node, maxDegree) * (isFocus ? 1.35 : 1);
        const y = node.y + drift(node, i) + radius + 6 / view.zoom;
        const alpha = isFocus ? 0.95 : isNeighbour ? 0.7 : 0.42;
        const name = node.name.length > 24 ? `${node.name.slice(0, 23)}…` : node.name;

        ctx.fillStyle = `rgba(238, 240, 248, ${alpha})`;
        ctx.fillText(name, node.x, y);
      });

      ctx.restore();
    }

    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, [size, adjacency, maxDegree]);

  // ── Fit the view whenever a new layout arrives ───────────────────────────
  useEffect(() => {
    viewRef.current = { x: 0, y: 0, zoom: 1 };
  }, [laid]);

  // ── Pointer interaction ──────────────────────────────────────────────────
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    const node = hitTest(event.clientX, event.clientY);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
      moved: false,
      node,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;

    if (drag) {
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      // A few pixels of slop so a slightly shaky click still selects.
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) {
        viewRef.current.x = drag.originX + dx;
        viewRef.current.y = drag.originY + dy;
      }
      return;
    }

    const node = hitTest(event.clientX, event.clientY);
    const id = node?.id ?? null;
    if (id !== hoverRef.current) {
      hoverRef.current = id;
      setHoverId(id);
      onHover?.(node ?? null);
    }
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
    // A click that did not pan is a selection; clicking empty space clears.
    if (!drag.moved) onSelect?.(drag.node ?? null);
  };

  const onWheel = (event) => {
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const view = viewRef.current;
    const factor = Math.exp(-event.deltaY * 0.0016);
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom * factor));
    // Zoom about the cursor, so the thing under the pointer stays put.
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    view.x = px - ((px - view.x) / view.zoom) * next;
    view.y = py - ((py - view.y) / view.zoom) * next;
    view.zoom = next;
  };

  // Native listener: React's onWheel is passive, so it cannot preventDefault
  // and the page would scroll while zooming.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const handler = (event) => onWheel(event);
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = { x: 0, y: 0, zoom: 1 };
  }, []);

  const isEmpty = !graph?.nodes?.length;

  return (
    <div ref={wrapRef} className={`graphcanvas ${className}`}>
      <canvas
        ref={canvasRef}
        className="graphcanvas__canvas"
        style={{ width: size.width, height: size.height, cursor: hoverId ? 'pointer' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => {
          if (hoverRef.current) {
            hoverRef.current = null;
            setHoverId(null);
            onHover?.(null);
          }
        }}
        role="img"
        aria-label={
          isEmpty
            ? emptyLabel
            : `Memory graph: ${graph.nodes.length} nodes, ${graph.edges.length} connections. A text list of every node follows.`
        }
      />

      {!isEmpty && (
        <button type="button" className="graphcanvas__reset" onClick={resetView}>
          Reset view
        </button>
      )}
    </div>
  );
}
