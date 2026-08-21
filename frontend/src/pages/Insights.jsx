import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RotateCw } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/api';
import { formatCount, formatLatency } from '../lib/format';
import { KIND_HEX, NODE_KINDS } from '../lib/graph';
import { parseDate } from '../lib/memory';

/**
 * INSIGHTS — how memory is actually growing.
 *
 * Every figure here is read from a real endpoint. Where the backend does not
 * measure something, this page says so rather than filling the space with a
 * plausible-looking chart:
 *
 *   - counts and latency percentiles: GET /analytics/summary
 *   - growth curve: the real `created_at` timestamps on GET /memories
 *   - graph shape: the node/edge export
 *
 * Analytics aggregates only the most recent 500 events, so anything derived
 * from that window is labelled with the window size.
 */

/** Area sparkline over a real daily series. Pure SVG — no chart dependency. */
function GrowthCurve({ series, label }) {
  if (series.length < 2) return null;

  const width = 640;
  const height = 130;
  const max = Math.max(...series.map((d) => d.total), 1);
  const step = width / (series.length - 1);

  const points = series.map((d, i) => [i * step, height - (d.total / max) * (height - 12) - 4]);
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <figure className="curve">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
        <defs>
          <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#curve-fill)" />
        <path d={line} fill="none" stroke="#22d3ee" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2" fill="#22d3ee" opacity={i === points.length - 1 ? 1 : 0.35} />
        ))}
      </svg>
      <figcaption className="curve__axis">
        <span>{series[0].label}</span>
        <span>{series[series.length - 1].label}</span>
      </figcaption>
    </figure>
  );
}

/** Proportional bar. Only rendered when there is something to divide. */
function SplitBar({ parts, total }) {
  if (!total) return null;
  return (
    <>
      <div className="split" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {parts.map((part) => (
          <span
            key={part.label}
            className="split__seg"
            style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
          />
        ))}
      </div>
      <ul className="split__key">
        {parts.map((part) => (
          <li key={part.label}>
            <span className="split__dot" style={{ background: part.color }} aria-hidden="true" />
            {part.label}
            <b className="tnum">{part.value}</b>
          </li>
        ))}
      </ul>
    </>
  );
}

function Metric({ label, value, note, tone = 'memory' }) {
  return (
    <div className={`metric metric--${tone}`}>
      <span className="metric__value tnum">{value}</span>
      <span className="metric__label">{label}</span>
      {note && <span className="metric__note">{note}</span>}
    </div>
  );
}

export function Insights() {
  const { memory } = useOutletContext();
  const analytics = useApi((opts) => api.analyticsSummary(opts));
  const memories = useApi((opts) => api.memories(opts));

  const summary = analytics.data?.data ?? null;
  const memoryList = useMemo(
    () => (Array.isArray(memories.data?.data) ? memories.data.data : []),
    [memories.data]
  );

  // Cumulative memories per day, from real timestamps only.
  const growth = useMemo(() => {
    const dated = memoryList
      .map((m) => parseDate(m.created_at))
      .filter(Boolean)
      .sort((a, b) => a - b);
    if (dated.length < 2) return [];

    const byDay = new Map();
    for (const date of dated) {
      const key = date.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    let running = 0;
    return [...byDay.entries()].map(([key, count]) => {
      running += count;
      return {
        key,
        total: running,
        label: new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
        }),
      };
    });
  }, [memoryList]);

  const kindSplit = useMemo(() => {
    const counts = new Map();
    for (const node of memory.graph.nodes) counts.set(node.kind, (counts.get(node.kind) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([kind, value]) => ({
        label: NODE_KINDS[kind]?.label ?? kind,
        value,
        color: KIND_HEX[kind] ?? KIND_HEX.unknown,
      }));
  }, [memory.graph]);

  const sourceSplit = useMemo(() => {
    const bySource = summary?.by_source ?? null;
    if (!bySource) return [];
    const palette = { audio: '#7c5cff', text: '#22d3ee' };
    return Object.entries(bySource).map(([label, value]) => ({
      label: label === 'audio' ? 'Spoken' : label === 'text' ? 'Typed' : label,
      value,
      color: palette[label] ?? '#666d88',
    }));
  }, [summary]);

  const latency = summary?.latency_ms ?? null;
  const cacheRate = typeof summary?.cache_hit_rate === 'number' ? summary.cache_hit_rate : null;
  const loading = analytics.loading || memories.loading;

  const reload = () => {
    analytics.run();
    memories.run();
    memory.refresh();
  };

  return (
    <div className="insights">
      <header className="page__head">
        <div>
          <p className="eyebrow">Insights</p>
          <h1 className="page__title">How memory is growing</h1>
          <p className="page__lead">
            Measured from stored memories, the graph, and the backend's own event log.
          </p>
        </div>
        <button type="button" className="iconbtn" onClick={reload} aria-label="Reload insights">
          <RotateCw size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      {analytics.error && !summary && (
        <div className="panel panel--alert">
          <h2 className="panel__title">Analytics could not be loaded</h2>
          <p className="panel__lead">{analytics.error.message}</p>
          <button type="button" className="btn btn--voice" onClick={() => analytics.run()}>
            Try again
          </button>
        </div>
      )}

      <section className="metrics" aria-label="Memory at a glance">
        <Metric
          label="Memories stored"
          value={loading ? '—' : formatCount(memoryList.length)}
          note={memoryList.length >= 50 ? 'most recent 50' : null}
        />
        <Metric
          label="Entities in graph"
          value={formatCount(memory.graph.nodes.length)}
          tone="voice"
        />
        <Metric
          label="Connections"
          value={formatCount(memory.graph.edges.length)}
          tone="voice"
        />
        <Metric
          label="Questions asked"
          value={summary ? formatCount(summary.total_queries) : '—'}
          note={summary?.by_type ? describeTypes(summary.by_type) : null}
        />
      </section>

      <div className="insights__grid">
        {growth.length >= 2 && (
          <section className="panel">
            <h2 className="panel__title">Memory growth</h2>
            <p className="panel__lead">
              Cumulative stored memories, by the day they were created.
            </p>
            <GrowthCurve series={growth} label="Cumulative memories over time" />
          </section>
        )}

        {kindSplit.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">What the graph is made of</h2>
            <p className="panel__lead">
              Every node NEURIS has extracted, by the label it was stored under.
            </p>
            <SplitBar parts={kindSplit} total={memory.graph.nodes.length} />
          </section>
        )}

        {latency && (
          <section className="panel">
            <h2 className="panel__title">Response time</h2>
            <p className="panel__lead">
              Across the last {latency.samples} requests the backend logged.
            </p>
            <div className="latency">
              <div className="latency__row">
                <span className="latency__label">Median</span>
                <div className="latency__track">
                  <span
                    className="latency__fill"
                    style={{ width: `${Math.min(100, (latency.p50 / latency.p95) * 100)}%` }}
                  />
                </div>
                <span className="latency__value tnum">{formatLatency(latency.p50)}</span>
              </div>
              <div className="latency__row">
                <span className="latency__label">95th</span>
                <div className="latency__track">
                  <span className="latency__fill latency__fill--wide" style={{ width: '100%' }} />
                </div>
                <span className="latency__value tnum">{formatLatency(latency.p95)}</span>
              </div>
              <p className="latency__mean tnum">Mean {formatLatency(latency.mean)}</p>
            </div>
          </section>
        )}

        {sourceSplit.length > 0 && (
          <section className="panel">
            <h2 className="panel__title">Spoken or typed</h2>
            <p className="panel__lead">
              How the last {summary.window} logged requests reached NEURIS.
            </p>
            <SplitBar
              parts={sourceSplit}
              total={sourceSplit.reduce((sum, part) => sum + part.value, 0)}
            />
          </section>
        )}

        {cacheRate != null && (
          <section className="panel">
            <h2 className="panel__title">Cache</h2>
            <p className="panel__lead">
              Repeat questions answered without re-running retrieval, over{' '}
              {summary.cache_samples} samples.
            </p>
            <div className="gauge">
              <span className="gauge__value tnum">{Math.round(cacheRate * 100)}%</span>
              <div className="gauge__track">
                <span className="gauge__fill" style={{ width: `${cacheRate * 100}%` }} />
              </div>
            </div>
          </section>
        )}
      </div>

      {summary && !latency && (
        <p className="insights__note">
          The backend has not logged enough requests to report response times yet.
        </p>
      )}
    </div>
  );
}

/** "412 asked, 88 searched" from the by_type counter. */
function describeTypes(byType) {
  const parts = [];
  if (byType.query) parts.push(`${byType.query} through capture`);
  if (byType.search) parts.push(`${byType.search} through recall`);
  return parts.join(' · ') || null;
}
