import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { AudioLines, Info, Waypoints } from 'lucide-react';
import { buildAdjacency, humanRelation, KIND_HEX, NODE_KINDS } from '../lib/graph';
import { sessionSpeakers } from '../lib/session';
import { initials } from '../lib/format';
import { formatRelative } from '../lib/memory';

/**
 * PEOPLE — memory organised by who was in it.
 *
 * NEURIS is speaker-aware in two genuinely different ways, and this page keeps
 * them apart instead of blending them into one flattering number:
 *
 *   1. Person nodes in the graph. Named, extracted from what was said, and
 *      connected to topics and events. These are identities.
 *   2. Diarization output. The audio pipeline reliably separates *voices* and
 *      labels them "Speaker 1", "Speaker 2" — it does not know who they are.
 *      Presenting those as people would be a claim the system cannot support.
 *
 * Everything shown is derived from data already returned by the API. There is
 * no per-person endpoint, so counts are relationship counts from the graph,
 * described as exactly that.
 */

function PersonCard({ person, relations, onOpen, open }) {
  const topics = relations.filter((r) => r.other.kind === 'topic');
  const others = relations.filter((r) => r.other.kind !== 'topic');

  return (
    <li className={`person ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="person__head"
        onClick={onOpen}
        aria-expanded={open}
      >
        <span className="person__avatar" aria-hidden="true">
          {initials(person.name)}
          <span className="person__ring" />
        </span>

        <span className="person__id">
          <span className="person__name">{person.name}</span>
          <span className="person__stats tnum">
            {relations.length} {relations.length === 1 ? 'connection' : 'connections'}
            {topics.length > 0 && <> · {topics.length} topics</>}
          </span>
        </span>
      </button>

      {open && (
        <div className="person__detail">
          {topics.length > 0 && (
            <div className="person__block">
              <h4 className="person__blocklabel">Topics</h4>
              <ul className="chipset">
                {topics.map(({ other, relation }, i) => (
                  <li key={`${other.id}-${i}`} className="chipset__chip">
                    <span
                      className="chipset__dot"
                      style={{ background: KIND_HEX.topic }}
                      aria-hidden="true"
                    />
                    {other.name}
                    <span className="chipset__rel">{relation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {others.length > 0 && (
            <div className="person__block">
              <h4 className="person__blocklabel">Also connected to</h4>
              <ul className="person__rels">
                {others.map(({ other, relation, outgoing }, i) => (
                  <li key={`${other.id}-${i}`}>
                    <span className="person__relverb">{outgoing ? relation : `${relation} by`}</span>
                    <span className="person__relname">
                      <span
                        className="chipset__dot"
                        style={{ background: KIND_HEX[other.kind] }}
                        aria-hidden="true"
                      />
                      {other.name}
                      <span className="person__relkind">{NODE_KINDS[other.kind]?.label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {relations.length === 0 && (
            <p className="person__none">
              This person is in the graph but nothing connects to them yet.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export function People() {
  const { memory } = useOutletContext();
  const { graph } = memory;
  const [openId, setOpenId] = useState(null);

  const adjacency = useMemo(() => buildAdjacency(graph), [graph]);

  const people = useMemo(
    () =>
      graph.nodes
        .filter((n) => n.kind === 'person')
        .sort((a, b) => (adjacency.get(b.id)?.size ?? 0) - (adjacency.get(a.id)?.size ?? 0)),
    [graph, adjacency]
  );

  const relationsFor = useMemo(() => {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    return (id) =>
      graph.edges
        .filter((e) => e.source === id || e.target === id)
        .map((edge) => {
          const outgoing = edge.source === id;
          const other = byId.get(outgoing ? edge.target : edge.source);
          return other ? { other, relation: humanRelation(edge.type), outgoing } : null;
        })
        .filter(Boolean);
  }, [graph]);

  const voices = useMemo(() => sessionSpeakers(), []);

  const nothing = people.length === 0 && voices.length === 0;

  return (
    <div className="people">
      <header className="page__head">
        <div>
          <p className="eyebrow">People</p>
          <h1 className="page__title">Who you spoke with</h1>
          <p className="page__lead">
            The people NEURIS has extracted from your conversations, and the distinct voices its
            transcription separated.
          </p>
        </div>
      </header>

      {nothing ? (
        <div className="space__empty">
          <div className="space__empty-mark" aria-hidden="true" />
          <h2>No one yet</h2>
          <p>
            Record a conversation with more than one person and NEURIS will separate the voices
            and pull out who was named.
          </p>
          <Link to="/capture" className="btn btn--voice">
            Record a conversation
          </Link>
        </div>
      ) : (
        <div className="people__body">
          <section className="people__section">
            <h2 className="section-title">
              In the graph
              <span className="section-title__hint">
                {people.length} {people.length === 1 ? 'person' : 'people'}
              </span>
            </h2>

            {people.length ? (
              <ul className="people__list">
                {people.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    relations={relationsFor(person.id)}
                    open={openId === person.id}
                    onOpen={() => setOpenId((current) => (current === person.id ? null : person.id))}
                  />
                ))}
              </ul>
            ) : (
              <p className="people__empty">
                No entity has been extracted as a person yet. Extraction labels people when a
                conversation names them.
              </p>
            )}
          </section>

          {voices.length > 0 && (
            <section className="people__section">
              <h2 className="section-title">
                Voices this session
                <span className="section-title__hint">{voices.length} detected</span>
              </h2>

              <p className="people__caveat">
                <Info size={13} strokeWidth={2} aria-hidden="true" />
                Diarization separates voices reliably but cannot name them. These are distinct
                speakers, not identified people.
              </p>

              <ul className="voices">
                {voices.map((voice) => (
                  <li key={voice.name} className="voice">
                    <span className="voice__mark" aria-hidden="true">
                      <AudioLines size={15} strokeWidth={1.8} />
                    </span>
                    <span className="voice__id">
                      <span className="voice__name">{voice.name}</span>
                      <span className="voice__stats tnum">
                        {voice.segments} segments · {voice.words} words ·{' '}
                        {voice.conversations}{' '}
                        {voice.conversations === 1 ? 'recording' : 'recordings'}
                      </span>
                    </span>
                    <span className="voice__when">{formatRelative(voice.lastAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="people__foot">
            <Link to="/space" className="btn btn--quiet">
              <Waypoints size={15} strokeWidth={1.9} aria-hidden="true" />
              See everyone in Memory Space
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
