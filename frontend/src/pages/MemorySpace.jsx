import { useCallback, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { RotateCw, Search, X } from 'lucide-react';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { buildAdjacency, humanRelation, KIND_HEX, NODE_KINDS } from '../lib/graph';

/**
 * MEMORY SPACE — everything NEURIS knows, laid out.
 *
 * The graph is real on both axes: nodes and edges come from GET /api/v1/graph
 * (the Neo4j store) merged with the grounding subgraphs this session's
 * retrievals returned. When the backend has no /graph endpoint the view falls
 * back to session data alone and says so, rather than pretending the store is
 * empty.
 *
 * The canvas cannot hold focus, so every node is also rendered in a real list
 * beside it. That list is not a fallback — it is the primary way to navigate
 * the graph by keyboard, and selecting there drives the canvas.
 */

const SOURCE_COPY = {
  stored: 'Loaded from the memory graph',
  both: 'Memory graph plus this session',
  session: 'From this session only',
  empty: 'Nothing stored yet',
};

export function MemorySpace() {
  const { memory } = useOutletContext();
  const { graph, source, status, error, truncated, refresh } = memory;

  const [selectedId, setSelectedId] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState(null);

  const adjacency = useMemo(() => buildAdjacency(graph), [graph]);

  const counts = useMemo(() => {
    const map = new Map();
    for (const node of graph.nodes) map.set(node.kind, (map.get(node.kind) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  // Filtering narrows the visible graph rather than only the list, so the
  // canvas and the list never disagree about what is in the space.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !kindFilter) return graph;

    const keep = new Set(
      graph.nodes
        .filter(
          (n) =>
            (!kindFilter || n.kind === kindFilter) &&
            (!q || n.name.toLowerCase().includes(q))
        )
        .map((n) => n.id)
    );
    return {
      nodes: graph.nodes.filter((n) => keep.has(n.id)),
      edges: graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    };
  }, [graph, query, kindFilter]);

  const selected = useMemo(
    () => graph.nodes.find((n) => n.id === selectedId) ?? null,
    [graph, selectedId]
  );

  // Every relationship touching the selection, with direction preserved —
  // "spoke about X" and "X spoke about" are different facts.
  const relations = useMemo(() => {
    if (!selected) return [];
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    return graph.edges
      .filter((e) => e.source === selected.id || e.target === selected.id)
      .map((edge) => {
        const outgoing = edge.source === selected.id;
        const other = byId.get(outgoing ? edge.target : edge.source);
        return other ? { other, relation: humanRelation(edge.type), outgoing } : null;
      })
      .filter(Boolean);
  }, [graph, selected]);

  const onSelect = useCallback((node) => setSelectedId(node?.id ?? null), []);

  const sorted = useMemo(
    () => [...visible.nodes].sort((a, b) => (b.degree ?? 0) - (a.degree ?? 0) || a.name.localeCompare(b.name)),
    [visible]
  );

  const isEmpty = graph.nodes.length === 0;

  return (
    <div className="space">
      <header className="space__head">
        <div>
          <p className="eyebrow">Memory Space</p>
          <h1 className="space__title">Everything, connected</h1>
        </div>

        <div className="space__stats">
          <span className="statline">
            <b className="tnum">{graph.nodes.length}</b> nodes
          </span>
          <span className="statline">
            <b className="tnum">{graph.edges.length}</b> connections
          </span>
          <span className={`statline statline--muted`}>{SOURCE_COPY[source]}</span>
          <button type="button" className="iconbtn" onClick={refresh} aria-label="Reload the graph">
            <RotateCw size={14} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </header>

      {status === 'error' && (
        <p className="space__notice space__notice--warn">
          The graph could not be loaded: {error?.message}. Showing whatever this session
          retrieved.
        </p>
      )}
      {status === 'unsupported' && graph.nodes.length > 0 && (
        <p className="space__notice">
          This backend has no graph endpoint, so the space shows only what this session's
          questions and recordings touched.
        </p>
      )}
      {truncated && (
        <p className="space__notice">
          Showing the most connected part of a larger graph.
        </p>
      )}

      {isEmpty ? (
        <div className="space__empty">
          <div className="space__empty-mark" aria-hidden="true" />
          <h2>No memories yet</h2>
          <p>
            {status === 'loading'
              ? 'Reading the memory graph…'
              : 'Record a conversation and NEURIS will start building the space from the people, topics and decisions inside it.'}
          </p>
          <Link to="/capture" className="btn btn--voice">
            Record the first memory
          </Link>
        </div>
      ) : (
        <div className="space__body">
          <div className="space__canvas">
            <GraphCanvas
              graph={visible}
              selectedId={selectedId}
              onSelect={onSelect}
              onHover={setHovered}
            />

            {/* Hover readout — sits over the canvas, never blocks a node. */}
            {hovered && !selected && (
              <div className="space__peek" aria-hidden="true">
                <span
                  className="space__peek-dot"
                  style={{ background: KIND_HEX[hovered.kind] }}
                />
                <span className="space__peek-name">{hovered.name}</span>
                <span className="space__peek-kind">{NODE_KINDS[hovered.kind]?.label}</span>
              </div>
            )}

            <ul className="legend">
              {counts.map(([kind, count]) => (
                <li key={kind}>
                  <button
                    type="button"
                    className={`legend__item ${kindFilter === kind ? 'is-on' : ''}`}
                    onClick={() => setKindFilter((current) => (current === kind ? null : kind))}
                    aria-pressed={kindFilter === kind}
                  >
                    <span
                      className="legend__dot"
                      style={{ background: KIND_HEX[kind] }}
                      aria-hidden="true"
                    />
                    {NODE_KINDS[kind]?.label ?? kind}
                    <span className="legend__count tnum">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <aside className="space__panel" aria-label="Graph contents">
            {selected ? (
              <div className="nodedetail">
                <button
                  type="button"
                  className="nodedetail__close"
                  onClick={() => setSelectedId(null)}
                  aria-label="Close and return to the node list"
                >
                  <X size={15} strokeWidth={2} aria-hidden="true" />
                </button>

                <span
                  className="nodedetail__kind"
                  style={{ color: KIND_HEX[selected.kind] }}
                >
                  <span
                    className="nodedetail__dot"
                    style={{ background: KIND_HEX[selected.kind] }}
                    aria-hidden="true"
                  />
                  {NODE_KINDS[selected.kind]?.label ?? 'Node'}
                </span>

                <h2 className="nodedetail__name">{selected.name}</h2>

                <p className="nodedetail__meta tnum">
                  {relations.length} {relations.length === 1 ? 'connection' : 'connections'}
                  {selected.derived && ' · seen through a relationship'}
                </p>

                {relations.length ? (
                  <ul className="nodedetail__rels">
                    {relations.map(({ other, relation, outgoing }, i) => (
                      <li key={`${other.id}-${i}`}>
                        <button
                          type="button"
                          className="nodedetail__rel"
                          onClick={() => setSelectedId(other.id)}
                        >
                          <span className="nodedetail__relverb">
                            {outgoing ? relation : `${relation} by`}
                          </span>
                          <span className="nodedetail__relname">
                            <span
                              className="nodedetail__dot"
                              style={{ background: KIND_HEX[other.kind] }}
                              aria-hidden="true"
                            />
                            {other.name}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="nodedetail__none">
                    Nothing else in the graph links to this yet.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space__search">
                  <Search size={14} strokeWidth={2} aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Find a node"
                    aria-label="Find a node by name"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                      <X size={13} strokeWidth={2} aria-hidden="true" />
                    </button>
                  )}
                </div>

                {sorted.length === 0 ? (
                  <p className="space__nomatch">Nothing matches “{query}”.</p>
                ) : (
                  <ul className="nodelist">
                    {sorted.map((node) => (
                      <li key={node.id}>
                        <button
                          type="button"
                          className="nodelist__item"
                          onClick={() => setSelectedId(node.id)}
                          onFocus={() => setHovered(node)}
                          onBlur={() => setHovered(null)}
                        >
                          <span
                            className="nodelist__dot"
                            style={{ background: KIND_HEX[node.kind] }}
                            aria-hidden="true"
                          />
                          <span className="nodelist__name">{node.name}</span>
                          <span className="nodelist__degree tnum">{adjacency.get(node.id)?.size ?? 0}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
