/**
 * Turning NEURIS API payloads into a graph the UI can draw.
 *
 * There are two real sources and no third:
 *
 *   1. GET /api/v1/graph  — the stored Neo4j graph, already node/edge shaped.
 *   2. `context_used` on any retrieval response, which is
 *      `[{ entity, score, facts: ["is <REL> <target>", ...] }]`. That is a
 *      graph too: `entity` is an anchor node and each fact is one edge to a
 *      named neighbour. Parsing it is how a recall answer can show the exact
 *      subgraph it was grounded in.
 *
 * Nothing here invents nodes. If retrieval returned nothing, the graph is
 * empty and the UI says so.
 */

/** Matches the string context_builder.build_grounded_context() emits. */
const FACT_RE = /^\s*is\s+(\S+)\s+(.+?)\s*$/i;

/** Neo4j labels the extraction prompt actually writes, mapped to node kinds. */
const LABEL_KIND = {
  person: 'person',
  topic: 'topic',
  memory: 'memory',
  event: 'event',
  conversation: 'memory',
  entity: 'entity',
};

export const NODE_KINDS = {
  person: { label: 'Person', color: 'var(--node-person)', glyph: 'circle' },
  topic: { label: 'Topic', color: 'var(--node-topic)', glyph: 'diamond' },
  memory: { label: 'Memory', color: 'var(--node-memory)', glyph: 'ring' },
  event: { label: 'Event', color: 'var(--node-event)', glyph: 'square' },
  entity: { label: 'Entity', color: 'var(--node-entity)', glyph: 'circle' },
  unknown: { label: 'Node', color: 'var(--node-default)', glyph: 'circle' },
};

/** Raw hex per kind — canvas cannot resolve CSS custom properties. */
export const KIND_HEX = {
  person: '#7c5cff',
  topic: '#22d3ee',
  memory: '#8a90ab',
  event: '#fbbf24',
  entity: '#34d399',
  unknown: '#666d88',
};

export function kindFromLabel(label) {
  if (!label) return 'unknown';
  return LABEL_KIND[String(label).toLowerCase()] ?? 'entity';
}

/**
 * Relationship types carry their own hint about what the target is, which is
 * the only signal available when a fact names a neighbour the export did not
 * include. Conservative on purpose — anything unrecognised stays 'unknown'.
 */
function kindFromRelation(rel) {
  const r = String(rel || '').toUpperCase();
  if (/(SPOKE|SAID|ATTENDED|PARTICIPANT|KNOWS|MET|WITH)/.test(r)) return 'person';
  if (/(ABOUT|TOPIC|DISCUSSED|MENTIONS|CONCERNS|REGARDING)/.test(r)) return 'topic';
  if (/(ON|AT|SCHEDULED|DEADLINE|DUE|WHEN)/.test(r)) return 'event';
  return 'unknown';
}

const slug = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '');

/**
 * Builds a graph from one or more `context_used` arrays.
 *
 * Anchors (the vector hits) keep their score so the view can size and rank
 * them; neighbours discovered only through a fact are marked `derived` so the
 * UI can present them as second-hand rather than as a scored match.
 */
export function graphFromContext(contexts) {
  const groups = Array.isArray(contexts) ? contexts : [contexts];
  const nodes = new Map();
  const edges = new Map();

  const put = (name, patch) => {
    const id = slug(name);
    if (!id) return null;
    const existing = nodes.get(id);
    if (existing) {
      Object.assign(existing, {
        ...patch,
        // An anchor always wins over a derived mention of the same name.
        derived: existing.derived && patch.derived !== false ? patch.derived : false,
        score: Math.max(existing.score ?? 0, patch.score ?? 0) || existing.score || patch.score,
      });
      return existing;
    }
    const node = { id, name: String(name).trim(), kind: 'unknown', degree: 0, ...patch };
    nodes.set(id, node);
    return node;
  };

  for (const group of groups) {
    if (!Array.isArray(group)) continue;

    for (const item of group) {
      const anchorName = item?.entity;
      if (!anchorName) continue;

      const anchor = put(anchorName, {
        score: typeof item.score === 'number' ? item.score : null,
        anchor: true,
        derived: false,
      });
      if (!anchor) continue;

      for (const fact of Array.isArray(item.facts) ? item.facts : []) {
        const match = String(fact).match(FACT_RE);
        if (!match) continue;

        const [, relation, targetName] = match;
        const target = put(targetName, { derived: true, kind: kindFromRelation(relation) });
        if (!target || target.id === anchor.id) continue;

        const key = `${anchor.id}->${target.id}:${relation}`;
        if (!edges.has(key)) {
          edges.set(key, { source: anchor.id, target: target.id, type: relation });
          anchor.degree += 1;
          target.degree += 1;
        }
      }
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/** Normalises the GET /api/v1/graph payload into the same internal shape. */
export function graphFromExport(payload) {
  const rawNodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
  const rawEdges = Array.isArray(payload?.edges) ? payload.edges : [];

  const nodes = rawNodes
    .filter((n) => n?.id && n?.name)
    .map((n) => ({
      id: String(n.id),
      name: String(n.name),
      kind: kindFromLabel(n.label),
      label: n.label ?? null,
      degree: typeof n.degree === 'number' ? n.degree : 0,
      anchor: false,
      derived: false,
    }));

  const known = new Set(nodes.map((n) => n.id));
  const edges = rawEdges
    .filter((e) => known.has(String(e?.source)) && known.has(String(e?.target)))
    .map((e) => ({ source: String(e.source), target: String(e.target), type: e.type ?? 'RELATED' }));

  return { nodes, edges, truncated: Boolean(payload?.truncated) };
}

/** Merges graphs, preferring richer node data (a real label beats a guess). */
export function mergeGraphs(...graphs) {
  const nodes = new Map();
  const edges = new Map();

  for (const graph of graphs) {
    for (const node of graph?.nodes ?? []) {
      const existing = nodes.get(node.id);
      if (!existing) {
        nodes.set(node.id, { ...node });
        continue;
      }
      nodes.set(node.id, {
        ...existing,
        ...node,
        kind: existing.kind !== 'unknown' ? existing.kind : node.kind,
        degree: Math.max(existing.degree ?? 0, node.degree ?? 0),
        anchor: existing.anchor || node.anchor,
        derived: existing.derived && node.derived,
      });
    }
    for (const edge of graph?.edges ?? []) {
      edges.set(`${edge.source}->${edge.target}:${edge.type}`, edge);
    }
  }

  const present = new Set(nodes.keys());
  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()].filter((e) => present.has(e.source) && present.has(e.target)),
  };
}

/** Adjacency index, used for hover dimming and neighbour panels. */
export function buildAdjacency(graph) {
  const map = new Map(graph.nodes.map((n) => [n.id, new Set()]));
  for (const edge of graph.edges) {
    map.get(edge.source)?.add(edge.target);
    map.get(edge.target)?.add(edge.source);
  }
  return map;
}

/**
 * Deterministic force-directed layout.
 *
 * Runs to completion synchronously before paint rather than animating the
 * simulation: a settling graph reads as instability, and NEURIS should feel
 * like a place that already exists. Seeded so the same graph always lays out
 * the same way and the view does not reshuffle between renders.
 */
export function layoutGraph(graph, { width = 1000, height = 700, iterations = 320 } = {}) {
  const nodes = graph.nodes.map((n) => ({ ...n }));
  const count = nodes.length;
  if (!count) return { nodes: [], edges: [] };

  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const edges = graph.edges.filter((e) => index.has(e.source) && index.has(e.target));

  // Seeded PRNG — same graph in, same picture out.
  let seed = 0;
  for (const node of nodes) {
    for (let i = 0; i < node.id.length; i += 1) seed = (seed * 31 + node.id.charCodeAt(i)) >>> 0;
  }
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Seed on a phyllotaxis spiral so the starting state is already evenly
  // spread; random starts need far more iterations to untangle.
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.42;
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const angle = i * 2.399963 + rand() * 0.4;
    nodes[i].x = cx + Math.cos(angle) * radius * Math.sqrt(t);
    nodes[i].y = cy + Math.sin(angle) * radius * Math.sqrt(t);
    nodes[i].vx = 0;
    nodes[i].vy = 0;
  }

  const area = width * height;
  const k = Math.sqrt(area / count) * 0.62;
  const linkLength = k * 0.85;

  for (let step = 0; step < iterations; step += 1) {
    const alpha = 1 - step / iterations;

    // Repulsion. O(n²) is fine at the sizes this view caps at (<= 1000 nodes)
    // and avoids pulling in a quadtree dependency for a one-off layout.
    for (let i = 0; i < count; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < count; j += 1) {
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = (rand() - 0.5) * 0.1;
          dy = (rand() - 0.5) * 0.1;
          dist = 0.01;
        }
        const force = (k * k) / dist / dist;
        const fx = dx * force;
        const fy = dy * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Attraction along edges.
    for (const edge of edges) {
      const a = nodes[index.get(edge.source)];
      const b = nodes[index.get(edge.target)];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const force = (dist - linkLength) * 0.045;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }

    // Gentle pull to centre keeps disconnected components from drifting off.
    for (const node of nodes) {
      node.vx += (cx - node.x) * 0.0022;
      node.vy += (cy - node.y) * 0.0022;

      const damping = 0.82;
      const maxStep = 24 * alpha + 0.5;
      node.vx *= damping;
      node.vy *= damping;
      const speed = Math.hypot(node.vx, node.vy);
      if (speed > maxStep) {
        node.vx = (node.vx / speed) * maxStep;
        node.vy = (node.vy / speed) * maxStep;
      }
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  // Fit to the viewport with a margin, preserving aspect ratio.
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const margin = 56;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((width - margin * 2) / spanX, (height - margin * 2) / spanY, 2.2);

  for (const node of nodes) {
    node.x = (node.x - (minX + maxX) / 2) * scale + cx;
    node.y = (node.y - (minY + maxY) / 2) * scale + cy;
    delete node.vx;
    delete node.vy;
  }

  return { nodes, edges };
}

/** Node radius from connectedness, so the visual weight means something. */
export function radiusFor(node, maxDegree) {
  const base = node.anchor ? 7 : 4.5;
  const ratio = maxDegree > 0 ? (node.degree ?? 0) / maxDegree : 0;
  return base + Math.sqrt(ratio) * 7;
}

/** Human-readable relationship label: SPOKE_ABOUT -> "spoke about". */
export function humanRelation(type) {
  return String(type || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .trim();
}
