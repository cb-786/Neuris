import { useState } from 'react';
import { ChevronDown, Network } from 'lucide-react';
import { humanRelation, KIND_HEX } from '../lib/graph';
import { formatScore } from '../lib/format';

/**
 * What an answer stands on.
 *
 * The backend returns `context_used: [{ entity, score, facts[] }]` — graph
 * entities and their two-hop neighbourhood. These are not memories and the
 * copy never calls them memories; conflating the two would misrepresent what
 * retrieval actually returned.
 *
 * Scores come from a cosine vector index with no fixed ceiling, so each bar is
 * drawn relative to the strongest hit in this result set rather than as a
 * percentage of some absolute maximum that does not exist.
 */

const FACT_RE = /^\s*is\s+(\S+)\s+(.+?)\s*$/i;

/** Splits "is SPOKE_ABOUT Anubhav" into a readable relation and target. */
function parseFact(fact) {
  const match = String(fact).match(FACT_RE);
  if (!match) return { relation: null, target: String(fact) };
  return { relation: humanRelation(match[1]), target: match[2] };
}

function EvidenceItem({ item, rank, top, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);

  const name = item?.entity ?? 'Unnamed entity';
  const score = typeof item?.score === 'number' ? item.score : null;
  const facts = Array.isArray(item?.facts) ? item.facts : [];
  const width = score != null ? Math.max(6, Math.min(100, (score / top) * 100)) : 0;

  return (
    <li className={`evidence__item ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="evidence__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!facts.length}
      >
        <span className="evidence__rank tnum" aria-hidden="true">
          {String(rank).padStart(2, '0')}
        </span>

        <span className="evidence__body">
          <span className="evidence__name">{name}</span>
          <span className="evidence__count">
            {facts.length
              ? `${facts.length} connected ${facts.length === 1 ? 'fact' : 'facts'}`
              : 'no connections within two hops'}
          </span>
        </span>

        {score != null && (
          <span className="evidence__score tnum" title={`Cosine similarity ${score}`}>
            {formatScore(score)}
          </span>
        )}

        {facts.length > 0 && (
          <ChevronDown className="evidence__chev" size={15} strokeWidth={2} aria-hidden="true" />
        )}
      </button>

      {score != null && (
        <div className="evidence__meter" aria-hidden="true">
          <div className="evidence__meter-fill" style={{ width: `${width}%` }} />
        </div>
      )}

      {open && facts.length > 0 && (
        <ul className="evidence__facts">
          {facts.map((fact, i) => {
            const { relation, target } = parseFact(fact);
            return (
              <li key={i} className="evidence__fact">
                <span className="evidence__edge" aria-hidden="true" />
                {relation && <span className="evidence__relation">{relation}</span>}
                <span className="evidence__target">{target}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function EvidencePanel({ context, startIndex = 0, defaultOpen = false }) {
  const items = Array.isArray(context) ? context.filter(Boolean) : [];

  if (!items.length) {
    return (
      <div className="evidence__empty">
        <Network size={18} strokeWidth={1.6} aria-hidden="true" />
        <p>
          Retrieval matched nothing in the graph, so this answer is not grounded in stored
          memory.
        </p>
      </div>
    );
  }

  const top = Math.max(...items.map((i) => (typeof i.score === 'number' ? i.score : 0)), 0) || 1;

  return (
    <ol className="evidence">
      {items.map((item, index) => (
        <EvidenceItem
          key={`${item.entity ?? 'entity'}-${index}`}
          item={item}
          rank={startIndex + index + 1}
          top={top}
          defaultOpen={defaultOpen && index === 0}
        />
      ))}
    </ol>
  );
}

/** Compact entity chips — the names an answer explicitly referenced. */
export function EntityChips({ entities, kind = 'entity' }) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  if (!list.length) return null;

  return (
    <ul className="chipset">
      {list.map((entity, i) => (
        <li key={`${entity}-${i}`} className="chipset__chip">
          <span
            className="chipset__dot"
            style={{ background: KIND_HEX[kind] ?? KIND_HEX.entity }}
            aria-hidden="true"
          />
          {String(entity)}
        </li>
      ))}
    </ul>
  );
}
