import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCw, Waypoints } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api } from '../api/api';
import {
  formatAbsolute,
  formatRelative,
  groupByDate,
  memoryBody,
  memoryLead,
  parseExtraction,
  sortMemories,
  wordCount,
} from '../lib/memory';

/**
 * TIMELINE — stored memories in the order they happened.
 *
 * Reads GET /api/v1/memories. One honest detail drives the whole layout: the
 * pipeline writes `summary` as extraction telemetry ("Extracted 4 nodes and 3
 * edges."), not as a human title. So each entry leads with the opening line of
 * the real transcript, and the node/edge counts are shown separately as what
 * they actually are — a record of what extraction pulled out.
 */

function ExtractionBadge({ summary }) {
  const extraction = parseExtraction(summary);
  if (!extraction) return null;
  return (
    <span className="tl__extract" title="Entities and relationships extracted from this memory">
      <span className="tnum">{extraction.nodes}</span> nodes
      <span className="tl__extract-sep" aria-hidden="true" />
      <span className="tnum">{extraction.edges}</span> links
    </span>
  );
}

function MemoryEntry({ memory }) {
  const [open, setOpen] = useState(false);
  const lead = memoryLead(memory);
  const body = memoryBody(memory);
  const words = wordCount(memory);
  const relative = formatRelative(memory.created_at);
  const absolute = formatAbsolute(memory.created_at);

  return (
    <li className="tl__entry">
      <span className="tl__node" aria-hidden="true" />

      <article className="tl__card">
        <header className="tl__head">
          {relative && (
            <time className="tl__time tnum" dateTime={memory.created_at ?? undefined} title={absolute ?? undefined}>
              {relative}
            </time>
          )}
          <ExtractionBadge summary={memory.summary} />
        </header>

        <h3 className="tl__lead">{lead}</h3>

        {body && (
          <>
            <p className={`tl__body ${open ? 'is-open' : ''}`}>{body}</p>
            {body.length > 220 && (
              <button type="button" className="tl__more" onClick={() => setOpen((v) => !v)}>
                {open ? 'Show less' : 'Read the full transcript'}
              </button>
            )}
          </>
        )}

        <footer className="tl__foot">
          {words > 0 && <span className="tnum">{words} words</span>}
          {memory.conversation_id && (
            <span className="tl__conv" title="Conversation this memory belongs to">
              {memory.conversation_id}
            </span>
          )}
        </footer>
      </article>
    </li>
  );
}

export function Timeline() {
  const { data, error, loading, run } = useApi((opts) => api.memories(opts));

  const memories = useMemo(() => {
    const list = Array.isArray(data?.data) ? data.data : [];
    return sortMemories(list, 'newest');
  }, [data]);

  const groups = useMemo(() => groupByDate(memories), [memories]);

  return (
    <div className="timeline">
      <header className="page__head">
        <div>
          <p className="eyebrow">Timeline</p>
          <h1 className="page__title">Memories in order</h1>
          <p className="page__lead">
            Every conversation NEURIS has stored, newest first.
          </p>
        </div>
        <button type="button" className="iconbtn" onClick={() => run()} aria-label="Reload memories">
          <RotateCw size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      {loading && (
        <ul className="tl">
          {[0, 1, 2].map((i) => (
            <li className="tl__entry" key={i}>
              <span className="tl__node" aria-hidden="true" />
              <div className="tl__card tl__card--ghost" aria-hidden="true">
                <span className="ghost ghost--sm" />
                <span className="ghost ghost--lg" />
                <span className="ghost ghost--md" />
              </div>
            </li>
          ))}
          <li className="sr-only">Loading memories…</li>
        </ul>
      )}

      {!loading && error && (
        <div className="panel panel--alert">
          <h2 className="panel__title">Memories could not be loaded</h2>
          <p className="panel__lead">{error.message}</p>
          <button type="button" className="btn btn--voice" onClick={() => run()}>
            <RotateCw size={15} strokeWidth={2} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {!loading && !error && memories.length === 0 && (
        <div className="space__empty">
          <div className="space__empty-mark" aria-hidden="true" />
          <h2>Nothing stored yet</h2>
          <p>Recorded conversations appear here as soon as NEURIS has processed them.</p>
          <Link to="/capture" className="btn btn--voice">
            Record a conversation
          </Link>
        </div>
      )}

      {!loading && !error && memories.length > 0 && (
        <>
          {groups ? (
            groups.map((group) => (
              <section className="tl__group" key={group.key}>
                <h2 className="tl__daylabel">
                  {group.label}
                  <span className="tnum">{group.items.length}</span>
                </h2>
                <ul className="tl">
                  {group.items.map((memory) => (
                    <MemoryEntry key={memory.id} memory={memory} />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            // No usable timestamps in the payload — a flat list is the honest
            // presentation rather than inventing dates to group by.
            <ul className="tl">
              {memories.map((memory) => (
                <MemoryEntry key={memory.id} memory={memory} />
              ))}
            </ul>
          )}

          <div className="timeline__foot">
            <Link to="/space" className="btn btn--quiet">
              <Waypoints size={15} strokeWidth={1.9} aria-hidden="true" />
              See how these connect
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
