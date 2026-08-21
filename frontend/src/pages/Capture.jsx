import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, MicOff, RotateCw, Users, Waypoints, X } from 'lucide-react';
import { MemoryOrb } from '../components/orb/MemoryOrb';
import { MemoryFormation } from '../components/formation/MemoryFormation';
import { CAPTURE_STAGES, PipelineStages } from '../components/PipelineStages';
import { EntityChips, EvidencePanel } from '../components/EvidencePanel';
import { useField } from '../components/field/FieldProvider';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { api, ApiError } from '../api/api';
import { configStore } from '../lib/config';
import { formatLatency, formatSeconds, speakerLabel } from '../lib/format';
import { graphFromContext } from '../lib/graph';
import { recordTurn } from '../lib/session';
import { useToast } from '../components/ui';

/**
 * CAPTURE MODE — speaking a conversation into memory.
 *
 * Unlike Recall, this path writes. Audio goes to POST /conversations/ingest/audio,
 * which runs server-side transcription with speaker diarization, stores the
 * turn, and kicks off entity extraction into the graph. The UI states are named
 * for what is actually happening at each step and nothing is claimed before the
 * backend confirms it.
 *
 * The formation view is the centrepiece: the amplitude envelope recorded from
 * the mic is animated into the entities retrieval genuinely returned. If the
 * response carried no entities, the waveform dissolves and the screen says the
 * graph gained nothing — it never invents nodes to fill the space.
 */

const HINTS = {
  idle: 'Tap to remember',
  listening: 'Listening',
  processing: 'Understanding',
  forming: 'Forming memory',
  formed: 'Capture again',
  error: 'Try again',
};

export function Capture() {
  const [phase, setPhase] = useState('idle'); // idle | processing | forming | formed | error
  const [memory, setMemory] = useState(null);
  const [failure, setFailure] = useState(null);
  const [takeEnvelope, setTakeEnvelope] = useState([]);

  const resultRef = useRef(null);
  const { toast } = useToast();
  const { setMode } = useField();
  const language = configStore.get('language');

  const send = useCallback(
    async (blob) => {
      setPhase('processing');
      setFailure(null);

      try {
        const payload = await api.ingestAudio(blob, language);
        const transcript = payload?.transcript ?? {};
        const ai = payload?.ai_response ?? {};

        setMemory({
          text: transcript.full_text ?? '',
          segments: Array.isArray(transcript.segments) ? transcript.segments : [],
          speakerCount: transcript.speaker_count ?? null,
          entities: Array.isArray(ai.entities) ? ai.entities : [],
          context: Array.isArray(ai.context_used) ? ai.context_used : [],
          conversationId: payload?.conversation_id ?? null,
          latencyMs: payload?.latency_ms ?? null,
          at: new Date(),
        });
        setPhase('forming');
        recordTurn({ kind: 'capture', response: payload, source: 'audio' });
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : 'Something went wrong while sending the audio.';
        setFailure(message);
        setPhase('error');
        toast(message, { tone: 'error', duration: 7000 });
      }
    },
    [language, toast]
  );

  const recorder = useAudioRecorder({ onComplete: send });

  // The envelope is published when the take ends; hold it for the formation.
  useEffect(() => {
    if (recorder.envelope.length) setTakeEnvelope(recorder.envelope);
  }, [recorder.envelope]);

  // Amplitude is not forwarded — the field reads the shared audio engine
  // directly, so this only has to describe what the page is doing.
  useEffect(() => {
    setMode(
      recorder.recording
        ? 'listening'
        : phase === 'processing'
          ? 'recalling'
          : phase === 'forming'
            ? 'forming'
            : 'idle'
    );
    return () => setMode('idle');
  }, [recorder.recording, phase, setMode]);

  useEffect(() => {
    if (recorder.error) toast(recorder.error, { tone: 'error', duration: 7000 });
  }, [recorder.error, toast]);

  useEffect(() => {
    if (phase === 'formed') resultRef.current?.focus();
  }, [phase]);

  const graph = useMemo(
    () => (memory?.context?.length ? graphFromContext([memory.context]) : { nodes: [], edges: [] }),
    [memory]
  );

  const reset = () => {
    setPhase('idle');
    setMemory(null);
    setFailure(null);
    setTakeEnvelope([]);
  };

  const orbState = recorder.recording
    ? 'listening'
    : phase === 'processing'
      ? 'processing'
      : 'idle';

  const busy = phase === 'processing' || phase === 'forming';
  const showStage = phase === 'idle' || phase === 'processing' || recorder.recording;

  // Speakers actually detected by diarization in this take.
  const speakers = useMemo(() => {
    if (!memory?.segments?.length) return [];
    const seen = new Map();
    for (const segment of memory.segments) {
      const name = String(segment.speaker ?? '').trim();
      if (!name) continue;
      seen.set(name, (seen.get(name) ?? 0) + 1);
    }
    return [...seen.entries()].map(([name, turns]) => ({ name, turns }));
  }, [memory]);

  return (
    <div className={`capture capture--${phase}`}>
      {showStage && (
        <section className={`capture__stage ${recorder.recording ? 'is-live' : ''}`}>
          <p className="eyebrow eyebrow--voice">Capture</p>

          <h1 className="capture__title">
            {recorder.recording ? (
              <>
                NEURIS is
                <br />
                <em>remembering</em>
              </>
            ) : phase === 'processing' ? (
              <>
                Understanding
                <br />
                <em>what you said</em>
              </>
            ) : (
              <>
                Speak, and it
                <br />
                <em>becomes memory</em>
              </>
            )}
          </h1>

          {!recorder.recording && phase === 'idle' && (
            <p className="capture__lead">
              Record a conversation. NEURIS transcribes it, separates the speakers, and pulls out
              the people, topics and commitments it contains.
            </p>
          )}

          {recorder.supported ? (
            <MemoryOrb
              state={orbState}
              onActivate={recorder.toggle}
              disabled={busy}
              size="lg"
              hint={HINTS[recorder.recording ? 'listening' : phase] ?? HINTS.idle}
              elapsedLabel={formatSeconds(recorder.elapsed)}
              label={recorder.recording ? 'Stop recording' : 'Start recording'}
            />
          ) : (
            <div className="capture__unsupported">
              <MicOff size={20} strokeWidth={1.6} aria-hidden="true" />
              <p>
                This browser cannot record audio. Recording needs MediaRecorder and microphone
                access — you can still ask questions from{' '}
                <Link to="/" className="inline-link">
                  Recall
                </Link>
                .
              </p>
            </div>
          )}

          {recorder.recording && (
            <>
              <p className="capture__guide" aria-live="polite">
                Speak naturally. Everything you say is being recorded.
              </p>
              <button type="button" className="capture__discard" onClick={recorder.cancel}>
                <X size={14} strokeWidth={2} aria-hidden="true" />
                Discard this take
              </button>
            </>
          )}

          {phase === 'processing' && (
            <div className="capture__pipeline">
              <PipelineStages stages={CAPTURE_STAGES} running pace={800} />
            </div>
          )}
        </section>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {phase === 'error' && (
        <section className="panel panel--alert capture__result">
          <h2 className="panel__title">The recording did not reach NEURIS</h2>
          <p className="panel__lead">{failure}</p>
          <p className="panel__note">
            Nothing was stored. Recording again will start a fresh take.
          </p>
          <button type="button" className="btn btn--voice" onClick={reset}>
            <RotateCw size={15} strokeWidth={2} aria-hidden="true" />
            Record again
          </button>
        </section>
      )}

      {/* ── Formation: voice becoming graph ─────────────────────────────── */}
      {(phase === 'forming' || phase === 'formed') && memory && (
        <section className="formationstage" aria-live="polite">
          <div className="formationstage__canvas">
            <MemoryFormation
              envelope={takeEnvelope}
              graph={graph}
              running={phase === 'forming'}
              onComplete={() => setPhase('formed')}
            />
            {phase === 'forming' && (
              <p className="formationstage__caption">
                {graph.nodes.length
                  ? 'Forming connections'
                  : 'No entities matched — nothing to connect'}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── The stored memory ───────────────────────────────────────────── */}
      {phase === 'formed' && memory && (
        <section className="capture__result" ref={resultRef} tabIndex={-1} aria-label="Memory stored">
          <header className="formed__head">
            <span className="formed__badge">Memory stored</span>
            <h2 className="formed__title">{leadOf(memory.text)}</h2>
            <p className="formed__stamp tnum">
              {memory.at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              {memory.latencyMs != null && <> · processed in {formatLatency(memory.latencyMs)}</>}
              {memory.conversationId && <> · {memory.conversationId}</>}
            </p>
          </header>

          <div className="formed__grid">
            {/* Speakers — real diarization output. */}
            <div className="formed__cell">
              <h3 className="formed__label">
                <Users size={13} strokeWidth={2} aria-hidden="true" />
                Voices
              </h3>
              {speakers.length ? (
                <ul className="formed__speakers">
                  {speakers.map((speaker) => (
                    <li key={speaker.name}>
                      <span className="formed__speaker">{speakerLabel(speaker.name)}</span>
                      <span className="formed__speaker-turns tnum">
                        {speaker.turns} {speaker.turns === 1 ? 'segment' : 'segments'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="formed__none">
                  Diarization returned a single undifferentiated track.
                </p>
              )}
              {memory.speakerCount != null && (
                <p className="formed__meta tnum">{memory.speakerCount} detected</p>
              )}
            </div>

            {/* Entities the retrieval step referenced. */}
            <div className="formed__cell">
              <h3 className="formed__label">
                <Waypoints size={13} strokeWidth={2} aria-hidden="true" />
                Entities
              </h3>
              {memory.entities.length ? (
                <EntityChips entities={memory.entities} kind="topic" />
              ) : (
                <p className="formed__none">
                  Nothing in the graph matched this turn yet. Extraction runs in the background —
                  check{' '}
                  <Link to="/space" className="inline-link">
                    Memory Space
                  </Link>{' '}
                  shortly.
                </p>
              )}
            </div>
          </div>

          {/* Transcript with real speaker attribution. */}
          {memory.segments.length > 0 && (
            <details className="formed__transcript">
              <summary>
                Transcript
                <span className="formed__meta tnum">{memory.segments.length} segments</span>
              </summary>
              <ol className="transcript">
                {memory.segments.map((segment, i) => (
                  <li key={i} className="transcript__line">
                    <span className="transcript__who">{speakerLabel(segment.speaker)}</span>
                    <span className="transcript__what">{segment.text}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}

          {memory.context.length > 0 && (
            <div className="formed__evidence">
              <h3 className="section-title">
                Connected to
                <span className="section-title__hint">
                  {memory.context.length} {memory.context.length === 1 ? 'entity' : 'entities'}
                </span>
              </h3>
              <EvidencePanel context={memory.context} />
            </div>
          )}

          <div className="formed__actions">
            <button type="button" className="btn btn--voice" onClick={reset}>
              Record another
            </button>
            <Link to="/space" className="btn btn--quiet">
              <Waypoints size={15} strokeWidth={1.9} aria-hidden="true" />
              See it in Memory Space
            </Link>
          </div>

          {!memory.entities.length && !memory.context.length && (
            <p className="formed__warning">
              <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" />
              The conversation was stored, but retrieval found no existing entities to connect it
              to. That is expected for the first few memories.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Heading for a freshly stored memory.
 *
 * Deliberately the opening line of the real transcript rather than the
 * backend's `summary` field, which the pipeline writes as extraction telemetry
 * ("Extracted 4 nodes and 3 edges.") — that is a debug string, not a title.
 */
function leadOf(text) {
  const content = String(text ?? '').trim();
  if (!content) return 'Empty recording';
  const sentence = content.split(/(?<=[.!?])\s+/)[0] ?? content;
  if (sentence.length >= 12 && sentence.length <= 120) return sentence;
  return content.length > 120 ? `${content.slice(0, 119).trimEnd()}…` : content;
}
