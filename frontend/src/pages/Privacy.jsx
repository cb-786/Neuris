import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Check, CircleDot, Minus } from 'lucide-react';

/**
 * PRIVACY — what NEURIS actually does with what it hears.
 *
 * This page is deliberately not reassurance copy. Every claim on it was read
 * out of the backend, and the limitations section exists because a system that
 * stores conversations has no business hiding them:
 *
 *   - audio is sent to Google Cloud Speech-to-Text (services/stt_service)
 *   - redaction covers emails and US-format phone numbers, and is applied to
 *     the generated answer only — the stored transcript keeps the original text
 *     (routes.py: `ai_response["response"] = post_processor.redact_pii(...)`)
 *   - the analytics log records the full query text (routes.py log_event)
 *   - authentication is stubbed: get_current_user() returns a fixed user
 *   - no endpoint deletes a memory
 *
 * If any of that changes in the backend, this page has to change with it.
 */

const FLOW = [
  {
    step: 'In your browser',
    detail:
      'Recording only ever starts when you press the orb, and the interface shows a live indicator the whole time it is open. Nothing is captured in the background.',
  },
  {
    step: 'Transcription',
    detail:
      'Recorded audio is uploaded to the NEURIS backend, which sends it to Google Cloud Speech-to-Text to transcribe it and separate the speakers. The audio leaves your machine.',
    external: true,
  },
  {
    step: 'Understanding',
    detail:
      'The transcript is sent to a language model to extract people, topics and relationships, and again when an answer is written. Conversation text reaches the model provider.',
    external: true,
  },
  {
    step: 'Storage',
    detail:
      'The transcript is saved as a memory, the extracted entities are written to the graph, and the answer is cached so a repeated question does not re-run retrieval.',
  },
];

const STORES = [
  {
    key: 'database',
    name: 'Memory store',
    holds: 'Full conversation transcripts, and an event log that includes the text of every question asked.',
  },
  {
    key: 'graph',
    name: 'Knowledge graph',
    holds: 'People, topics and events extracted from conversations, plus the relationships between them and their embeddings.',
  },
  {
    key: 'cache',
    name: 'Answer cache',
    holds: 'Recent answers, keyed by the normalised text of the question that produced them.',
  },
];

const LIMITS = [
  {
    title: 'There is no sign-in',
    detail:
      'Authentication is stubbed out — every request is treated as the same default user. Anyone who can reach the backend can read every memory. Do not expose this deployment to a network you do not control.',
  },
  {
    title: 'Redaction is narrow, and only covers answers',
    detail:
      'Email addresses and US-format phone numbers are stripped from generated answers. The stored transcript keeps the original text, and no other category of personal data is detected.',
  },
  {
    title: 'Memories cannot be deleted from here',
    detail:
      'The API has no delete endpoint yet. Removing a memory means clearing it directly from the database and the graph.',
  },
  {
    title: 'Nothing is encrypted by NEURIS',
    detail:
      'Data is protected only by whatever the database, graph and cache are configured to do underneath. NEURIS adds no encryption of its own.',
  },
];

function StoreStatus({ status }) {
  if (status === 'ok') {
    return (
      <span className="store__state store__state--ok">
        <Check size={12} strokeWidth={2.5} aria-hidden="true" />
        Connected
      </span>
    );
  }
  if (status === 'down') {
    return (
      <span className="store__state store__state--down">
        <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
        Unavailable
      </span>
    );
  }
  return (
    <span className="store__state store__state--unknown">
      <CircleDot size={12} strokeWidth={2.5} aria-hidden="true" />
      Unknown
    </span>
  );
}

export function Privacy() {
  const { health } = useOutletContext();
  const deps = health?.info?.dependencies ?? {};

  return (
    <div className="privacy">
      <header className="page__head page__head--stack">
        <div>
          <p className="eyebrow">Privacy</p>
          <h1 className="page__title privacy__title">
            Your memories
            <br />
            <em>belong to you</em>
          </h1>
          <p className="page__lead">
            NEURIS records conversations, so it owes you a precise account of where they go. This
            page describes what the system actually does — including what it does not protect.
          </p>
        </div>
      </header>

      <section className="privacy__section">
        <h2 className="section-title">Where your voice goes</h2>
        <ol className="flow">
          {FLOW.map((stage, i) => (
            <li key={stage.step} className="flow__step">
              <span className="flow__marker" aria-hidden="true">
                <span className="flow__dot" />
                {i < FLOW.length - 1 && <span className="flow__line" />}
              </span>
              <div className="flow__content">
                <h3 className="flow__title">
                  {stage.step}
                  {stage.external && <span className="flow__tag">Leaves your machine</span>}
                </h3>
                <p className="flow__detail">{stage.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="privacy__section">
        <h2 className="section-title">
          What is stored
          <span className="section-title__hint">live status</span>
        </h2>
        <ul className="stores">
          {STORES.map((store) => (
            <li key={store.key} className="store">
              <div className="store__head">
                <h3 className="store__name">{store.name}</h3>
                <StoreStatus status={deps[store.key]?.status === 'ok' ? 'ok' : deps[store.key] ? 'down' : 'unknown'} />
              </div>
              <p className="store__holds">{store.holds}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="privacy__section">
        <h2 className="section-title">Recall does not record</h2>
        <p className="privacy__note">
          Asking a question is read-only. When you speak a question on the Recall screen, your
          browser transcribes it locally through the Web Speech API and only the resulting text is
          sent, to a search endpoint that retrieves without storing a conversation. Capture is the
          only path that writes to memory.
        </p>
        <p className="privacy__note privacy__note--sub">
          One caveat worth knowing: in Chrome the Web Speech API is not fully on-device — the
          browser may send audio to Google's speech service to transcribe it. That is the browser's
          behaviour, not something NEURIS controls.
        </p>
      </section>

      <section className="privacy__section">
        <h2 className="section-title section-title--warn">
          <AlertTriangle size={15} strokeWidth={2} aria-hidden="true" />
          What this build does not protect
        </h2>
        <ul className="limits">
          {LIMITS.map((limit) => (
            <li key={limit.title} className="limit">
              <h3 className="limit__title">{limit.title}</h3>
              <p className="limit__detail">{limit.detail}</p>
            </li>
          ))}
        </ul>
        <p className="privacy__footnote">
          This is a research prototype. The list above is what an honest deployment checklist would
          flag, and it is here rather than buried so nobody records a real conversation under the
          wrong assumption.
        </p>
      </section>
    </div>
  );
}
