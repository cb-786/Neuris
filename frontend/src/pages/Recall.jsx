import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AmbientPanels } from '../components/ambient/AmbientPanels';
import { ArrowRight, CornerDownLeft, Database, Keyboard, RotateCw, Waypoints, Zap } from 'lucide-react';
import { MemoryOrb } from '../components/orb/MemoryOrb';
import { PipelineStages, RECALL_STAGES } from '../components/PipelineStages';
import { EntityChips, EvidencePanel } from '../components/EvidencePanel';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { useField } from '../components/field/FieldProvider';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useMicMeter } from '../hooks/useMicMeter';
import { api, ApiError } from '../api/api';
import { configStore } from '../lib/config';
import { formatLatency } from '../lib/format';
import { graphFromContext } from '../lib/graph';
import { recordTurn } from '../lib/session';
import { CodeBlock, useToast } from '../components/ui';

/**
 * RECALL MODE — asking NEURIS what it remembers.
 *
 * The important architectural point, which the UI is built to respect: recall
 * never writes. A spoken question is transcribed in the browser by the Web
 * Speech API and sent to GET /search/rag, which retrieves and answers without
 * storing a conversation. Capture is the only path that adds to memory, and it
 * lives on its own route so the two can never be confused.
 *
 * Every part of the answer is real: the prose from the synthesiser, the
 * referenced entities, the grounding subgraph, and the latency figure.
 */

const EXAMPLES = [
  'What did we decide about the deadline?',
  'Who did I speak with recently?',
  'What commitments did I make?',
];

export function Recall() {
  const [phase, setPhase] = useState('idle'); // idle | asking | answered | error
  const [question, setQuestion] = useState('');
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const [typing, setTyping] = useState(false);
  const showRaw = configStore.get('showRaw');

  const inputRef = useRef(null);
  const answerRef = useRef(null);
  const { toast } = useToast();
  const { setMode } = useField();
  const language = configStore.get('language');

  const speech = useSpeechRecognition({
    language,
    onFinal: (text) => ask(text, 'voice'),
  });
  // Holds the shared microphone open purely so the orb has a real signal to
  // react to — the Web Speech API does not expose the audio it hears.
  const meter = useMicMeter(speech.listening);

  const asking = phase === 'asking';

  // Field mode mirrors what is genuinely happening. Amplitude is not forwarded:
  // the field reads the shared audio engine directly.
  useEffect(() => {
    setMode(speech.listening ? 'listening' : asking ? 'recalling' : 'idle');
    return () => setMode('idle');
  }, [speech.listening, asking, setMode]);

  useEffect(() => {
    if (speech.error) toast(speech.error, { tone: 'error', duration: 6000 });
  }, [speech.error, toast]);

  useEffect(() => {
    if (meter.error) toast(meter.error, { tone: 'error', duration: 6000 });
  }, [meter.error, toast]);

  const ask = useCallback(
    async (raw, source = 'text') => {
      const text = String(raw ?? '').trim();
      if (!text) return;

      setQuestion(text);
      setDraft('');
      setPhase('asking');
      setResult(null);
      setFailure(null);

      try {
        const payload = await api.searchRag(text);
        const data = payload?.data ?? {};
        setResult({
          answer: data.response ?? '',
          entities: Array.isArray(data.entities) ? data.entities : [],
          context: Array.isArray(data.context_used) ? data.context_used : [],
          latencyMs: payload?.latency_ms ?? null,
          cached: Boolean(payload?.cached),
          source,
          raw: payload,
        });
        setPhase('answered');
        recordTurn({ kind: 'recall', query: text, response: payload, source });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Something went wrong reaching the backend.';
        setFailure(message);
        setPhase('error');
        toast(message, { tone: 'error', duration: 7000 });
      }
    },
    [toast]
  );

  // Move focus to the answer once it exists, so keyboard and screen-reader
  // users land on the result instead of being left at the orb.
  useEffect(() => {
    if (phase === 'answered') answerRef.current?.focus();
  }, [phase]);

  // A query submitted from the header search lands here as route state.
  const location = useLocation();
  const pendingQuery = location.state?.query;
  useEffect(() => {
    if (!pendingQuery) return;
    ask(pendingQuery, 'text');
    // Clear it so a back-navigation does not silently re-run the search.
    window.history.replaceState({}, '');
  }, [pendingQuery, ask]);

  const reset = () => {
    setPhase('idle');
    setQuestion('');
    setResult(null);
    setFailure(null);
  };

  const subgraph = useMemo(
    () => (result?.context?.length ? graphFromContext([result.context]) : { nodes: [], edges: [] }),
    [result]
  );

  const orbState = speech.listening ? 'listening' : asking ? 'processing' : 'idle';

  const handleOrb = () => {
    if (asking) return;
    if (!speech.supported) {
      setTyping(true);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    speech.toggle();
  };

  return (
    <div className={`recall recall--${phase}`}>
      {/* Ambient memory context, only while the stage is at rest — it must
          never compete with an answer. */}
      {phase === 'idle' && <AmbientPanels />}

      {/* ── Stage: the orb and the question ─────────────────────────────── */}
      <section className={`recall__stage ${phase !== 'idle' ? 'is-lifted' : ''}`}>
        <p className="eyebrow">Recall</p>

        <h1 className="recall__title">
          {phase === 'idle' ? (
            <>
              What do you
              <br />
              <em>remember?</em>
            </>
          ) : (
            question
          )}
        </h1>

        {phase === 'idle' && (
          <p className="recall__lead">
            NEURIS answers from the conversations it has already heard — and shows you exactly
            which part of the graph each answer came from.
          </p>
        )}

        <MemoryOrb
          state={orbState}
          onActivate={handleOrb}
          disabled={asking}
          size={phase === 'idle' ? 'lg' : 'sm'}
          hue={speech.listening ? 'live' : 'memory'}
          label={
            speech.listening
              ? 'Stop listening'
              : speech.supported
                ? 'Ask a question by voice'
                : 'Type a question'
          }
          hint={
            speech.listening
              ? 'Listening'
              : asking
                ? 'Searching memories'
                : speech.supported
                  ? 'Ask NEURIS'
                  : 'Type to ask'
          }
        />

        {/* Interim transcript: real words from the recogniser, as they arrive. */}
        {speech.listening && (
          <p className="recall__interim" aria-live="polite">
            {speech.interim || <span className="recall__interim-wait">Speak naturally…</span>}
          </p>
        )}

        {/* Text is the secondary path, and looks it. */}
        {!speech.listening && !asking && (
          <div className="recall__text">
            {typing || !speech.supported ? (
              <form
                className="askline"
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(draft, 'text');
                }}
              >
                <input
                  ref={inputRef}
                  className="askline__input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask what NEURIS remembers…"
                  aria-label="Ask what NEURIS remembers"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="askline__go"
                  disabled={!draft.trim()}
                  aria-label="Ask"
                >
                  <CornerDownLeft size={15} strokeWidth={2} aria-hidden="true" />
                </button>
              </form>
            ) : (
              <button type="button" className="recall__typelink" onClick={() => {
                setTyping(true);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}>
                <Keyboard size={14} strokeWidth={1.9} aria-hidden="true" />
                or type your question
              </button>
            )}
          </div>
        )}

        {!speech.supported && phase === 'idle' && (
          <p className="recall__note">
            Voice questions need the Web Speech API, which this browser does not provide. Typing
            works the same way — or use{' '}
            <Link to="/capture" className="inline-link">
              Capture
            </Link>{' '}
            to record with server-side transcription.
          </p>
        )}
      </section>

      {/* ── Idle: examples ──────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <section className="recall__examples" aria-label="Example questions">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className="examplechip" onClick={() => ask(example, 'text')}>
              <span>{example}</span>
              <ArrowRight size={14} strokeWidth={1.9} aria-hidden="true" />
            </button>
          ))}
        </section>
      )}

      {/* ── Retrieval in flight ─────────────────────────────────────────── */}
      {asking && (
        <section className="recall__pipeline" aria-live="polite">
          <PipelineStages stages={RECALL_STAGES} running />
        </section>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <section className="panel panel--alert recall__result">
          <h2 className="panel__title">NEURIS could not reach memory</h2>
          <p className="panel__lead">{failure}</p>
          <div className="row gap-2">
            <button type="button" className="btn btn--voice" onClick={() => ask(question, 'text')}>
              <RotateCw size={15} strokeWidth={2} aria-hidden="true" />
              Try again
            </button>
            <button type="button" className="btn btn--quiet" onClick={reset}>
              Ask something else
            </button>
          </div>
        </section>
      )}

      {/* ── Answer ──────────────────────────────────────────────────────── */}
      {phase === 'answered' && result && (
        <section className="recall__result" aria-live="polite">
          <article
            className="answer"
            ref={answerRef}
            tabIndex={-1}
            aria-label="Answer from memory"
          >
            <div className="answer__glow" aria-hidden="true" />

            <p className="answer__text">
              {result.answer || 'The backend returned an empty answer.'}
            </p>

            <EntityChips entities={result.entities} kind="topic" />

            <footer className="answer__meta">
              <span className="answer__metaitem tnum">
                {formatLatency(result.latencyMs)}
              </span>
              <span className="answer__metaitem">
                {result.cached ? (
                  <>
                    <Zap size={12} strokeWidth={2} aria-hidden="true" />
                    From cache
                  </>
                ) : (
                  <>
                    <Database size={12} strokeWidth={2} aria-hidden="true" />
                    Live retrieval
                  </>
                )}
              </span>
              <span className="answer__metaitem">
                {result.source === 'voice' ? 'Asked by voice' : 'Asked by text'}
              </span>
            </footer>
          </article>

          {/* Grounding: the exact subgraph the answer stands on. */}
          <div className="recall__grounding">
            <div className="grounding__evidence">
              <h2 className="section-title">
                Grounded in
                <span className="section-title__hint">
                  {result.context.length
                    ? `${result.context.length} matched ${result.context.length === 1 ? 'entity' : 'entities'}`
                    : 'nothing matched'}
                </span>
              </h2>
              <EvidencePanel context={result.context} defaultOpen />
            </div>

            {subgraph.nodes.length > 0 && (
              <div className="grounding__map">
                <h2 className="section-title">
                  Retrieved subgraph
                  <span className="section-title__hint">
                    {subgraph.nodes.length} nodes · {subgraph.edges.length} links
                  </span>
                </h2>
                <div className="grounding__canvas">
                  <GraphCanvas graph={subgraph} />
                </div>
                <Link to="/space" className="grounding__link">
                  <Waypoints size={14} strokeWidth={1.9} aria-hidden="true" />
                  Open in Memory Space
                </Link>
              </div>
            )}
          </div>

          {/* Enabled from Settings — the exact payload retrieval returned. */}
          {showRaw && result.raw && (
            <details className="rawview">
              <summary>Raw response</summary>
              <CodeBlock label="application/json" value={result.raw} />
            </details>
          )}

          <div className="recall__again">
            <button type="button" className="btn btn--quiet" onClick={reset}>
              Ask something else
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
