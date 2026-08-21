import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../api/api';
import { formatCount, formatLatency } from '../../lib/format';
import { buildAdjacency, KIND_HEX, NODE_KINDS } from '../../lib/graph';
import { formatRelative, memoryLead, parseDate } from '../../lib/memory';

/**
 * Ambient memory information, floating either side of the orb.
 *
 * Every figure here is real and comes from an endpoint the app already calls:
 *
 *   count + growth   GET /memories, using the genuine created_at timestamps
 *   graph totals     GET /graph (shared via the shell, not re-fetched)
 *   most connected   node degree computed from the real edge list
 *   recall speed     GET /analytics/summary latency percentiles
 *   recent activity  the real most-recent memories and their relative times
 *
 * Nothing is padded with plausible-looking numbers to make the layout busier.
 * Each block renders only when its own data exists, so a fresh install shows
 * fewer blocks rather than empty ones.
 *
 * These are deliberately quiet: low contrast, no borders, no card chrome. They
 * are context, and they must never compete with the orb.
 */

function Sparkline({ series }) {
  if (series.length < 2) return null;

  const w = 220;
  const h = 40;
  const max = Math.max(...series, 1);
  const step = w / (series.length - 1);
  const pts = series.map((v, i) => [i * step, h - (v / max) * (h - 4) - 2]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <svg
      className="snapshot__spark"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="rgba(124, 92, 255, 0.12)" />
      <path
        d={d}
        fill="none"
        stroke="url(#spark-stroke)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill="#a855f7" />
    </svg>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Ticks on the minute, not the second — this is ambient, and a seconds
    // counter would pull the eye away from the orb.
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ambient__clock">
      <span className="ambient__time tnum">
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="ambient__date">
        {now.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    </div>
  );
}

/** Totals for the stored graph, plus what it is made of. */
function GraphSummary({ graph }) {
  const nodes = graph.nodes.length;
  const edges = graph.edges.length;

  const kinds = useMemo(() => {
    const counts = new Map();
    for (const node of graph.nodes) counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kind, value]) => ({ kind, value }));
  }, [graph.nodes]);

  if (!nodes) return null;

  // Average connections per entity — the one number that says whether the
  // graph is a web or a pile of unconnected points.
  const density = nodes ? (edges * 2) / nodes : 0;

  return (
    <section>
      <h2 className="ambient__label">Memory graph</h2>

      <div className="gsum">
        <div className="gsum__stat">
          <span className="gsum__value tnum">{formatCount(nodes)}</span>
          <span className="gsum__key">entities</span>
        </div>
        <div className="gsum__stat">
          <span className="gsum__value tnum">{formatCount(edges)}</span>
          <span className="gsum__key">links</span>
        </div>
        <div className="gsum__stat">
          <span className="gsum__value tnum">{density.toFixed(1)}</span>
          <span className="gsum__key">avg links</span>
        </div>
      </div>

      <div className="gsum__bar" role="img" aria-label={kinds.map((k) => `${NODE_KINDS[k.kind]?.label ?? k.kind} ${k.value}`).join(', ')}>
        {kinds.map((k) => (
          <span
            key={k.kind}
            style={{ width: `${(k.value / nodes) * 100}%`, background: KIND_HEX[k.kind] ?? KIND_HEX.unknown }}
          />
        ))}
      </div>

      <ul className="gsum__key-list">
        {kinds.slice(0, 3).map((k) => (
          <li key={k.kind}>
            <span
              className="gsum__dot"
              style={{ background: KIND_HEX[k.kind] ?? KIND_HEX.unknown }}
              aria-hidden="true"
            />
            {NODE_KINDS[k.kind]?.label ?? k.kind}
            <b className="tnum">{k.value}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The hubs of the graph — what NEURIS knows the most about. */
function MostConnected({ graph }) {
  const top = useMemo(() => {
    if (!graph.nodes.length || !graph.edges.length) return [];
    const adjacency = buildAdjacency(graph);
    return graph.nodes
      .map((node) => ({ node, degree: adjacency.get(node.id)?.size ?? 0 }))
      .filter((entry) => entry.degree > 0)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 4);
  }, [graph]);

  if (!top.length) return null;
  const max = top[0].degree || 1;

  return (
    <section>
      <h2 className="ambient__label">Most connected</h2>
      <ul className="hubs">
        {top.map(({ node, degree }) => (
          <li key={node.id} className="hub">
            <span className="hub__head">
              <span
                className="hub__dot"
                style={{ background: KIND_HEX[node.kind] ?? KIND_HEX.unknown }}
                aria-hidden="true"
              />
              <span className="hub__name" title={node.name}>
                {node.name}
              </span>
              <span className="hub__degree tnum">{degree}</span>
            </span>
            <span className="hub__meter" aria-hidden="true">
              <span
                style={{
                  width: `${(degree / max) * 100}%`,
                  background: KIND_HEX[node.kind] ?? KIND_HEX.unknown,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
      <Link to="/space" className="recent__all">
        Open memory space
        <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" />
      </Link>
    </section>
  );
}

export function AmbientPanels() {
  // The graph is already loaded by the shell — reuse it rather than fetching
  // the same thing again for a side panel.
  const outlet = useOutletContext();
  const graph = outlet?.memory?.graph ?? { nodes: [], edges: [] };

  const { data, loading, error } = useApi((opts) => api.memories(opts));
  const analytics = useApi((opts) => api.analyticsSummary(opts));

  const memories = useMemo(() => (Array.isArray(data?.data) ? data.data : []), [data]);

  // Cumulative memories per day, from real timestamps only.
  const series = useMemo(() => {
    const byDay = new Map();
    for (const m of memories) {
      const date = parseDate(m.created_at);
      if (!date) continue;
      const key = date.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
    let running = 0;
    return days.map(([, count]) => (running += count));
  }, [memories]);

  const recent = useMemo(
    () =>
      [...memories]
        .sort(
          (a, b) =>
            (parseDate(b.created_at)?.getTime() ?? 0) - (parseDate(a.created_at)?.getTime() ?? 0)
        )
        .slice(0, 4),
    [memories]
  );

  const summary = analytics.data?.data ?? null;
  const p50 = summary?.latency_ms?.p50 ?? null;
  const asked = summary?.total_queries ?? null;

  const hasRight = recent.length > 0 || graph.edges.length > 0 || p50 != null;

  return (
    <>
      {/* The left column always renders. The clock is local to the browser and
          does not depend on the backend, so hiding it when the API is down
          would remove something that is still perfectly true. */}
      <aside className="ambient ambient--left" aria-label="Memory snapshot">
        <Clock />

        <section className="snapshot">
          <h2 className="ambient__label">Memory snapshot</h2>
          {loading ? (
            <div className="ambient__loading" aria-hidden="true">
              <span className="ghost ghost--sm" />
              <span className="ghost ghost--lg" />
            </div>
          ) : error ? (
            // Nothing is shown when the backend is unreachable. A zero would
            // read as "you have no memories", and the top bar already reports
            // the connection state, so repeating it here is just noise.
            null
          ) : memories.length === 0 ? (
            <p className="ambient__offline">
              No memories yet.{' '}
              <Link to="/capture" className="inline-link">
                Record one
              </Link>{' '}
              to begin.
            </p>
          ) : (
            <>
              <p className="snapshot__lead">Your memory is growing</p>
              <div className="snapshot__row">
                <span className="snapshot__count tnum">{formatCount(memories.length)}</span>
                <Link to="/timeline" className="snapshot__go" aria-label="Open the timeline">
                  <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
              <p className="snapshot__unit">
                {memories.length === 1 ? 'memory stored' : 'memories stored'}
                {memories.length >= 50 && <span className="snapshot__cap"> · most recent 50</span>}
              </p>
              <Sparkline series={series} />
            </>
          )}
        </section>

        <GraphSummary graph={graph} />
      </aside>

      <aside className="ambient ambient--right" aria-label="Recent activity">
        {!hasRight && !error && (
          <section>
            <h2 className="ambient__label">Recent activity</h2>
            <p className="ambient__offline">
              Nothing recorded yet. Captured conversations appear here.
            </p>
          </section>
        )}

        {recent.length > 0 && (
            <section>
              <h2 className="ambient__label">Recent activity</h2>
              <ul className="recent">
                {recent.map((memory) => (
                  <li key={memory.id} className="recent__item">
                    <span className="recent__dot" aria-hidden="true" />
                    <span className="recent__text" title={memoryLead(memory)}>
                      {memoryLead(memory)}
                    </span>
                    <span className="recent__when">
                      {formatRelative(memory.created_at) ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/timeline" className="recent__all">
                View all activity
                <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" />
              </Link>
            </section>
          )}

          <MostConnected graph={graph} />

          {/* Only shown once the backend has actually measured something. */}
          {p50 != null && (
            <section className="pace">
              <h2 className="ambient__label">Recall pace</h2>
              <p className="pace__value tnum">{formatLatency(p50)}</p>
              <p className="pace__key">
                median response
                {asked ? ` · ${formatCount(asked)} asked` : ''}
              </p>
            </section>
          )}
      </aside>
    </>
  );
}
