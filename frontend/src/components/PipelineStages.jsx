import { useEffect, useState } from 'react';

/**
 * The stages a request moves through, shown while it is genuinely in flight.
 *
 * Honesty rules this component follows:
 *  - The stage names are the real steps in the backend pipeline, not invented
 *    machinery. Retrieval really does embed, vector-search, expand two hops
 *    and then synthesise.
 *  - The backend streams no progress, so the walk between stages is paced, not
 *    measured — which is why no stage ever displays a duration. The one timing
 *    the UI shows anywhere is `latency_ms`, the real figure from the response.
 *  - The final stage completes only when the response actually lands. It never
 *    reaches "done" on a timer.
 */

export const RECALL_STAGES = [
  { key: 'query', label: 'Query', detail: 'Your question is embedded as a vector' },
  { key: 'search', label: 'Memory search', detail: 'Nearest entities in the graph' },
  { key: 'connections', label: 'Connections', detail: 'Two hops out from each match' },
  { key: 'ground', label: 'Grounding', detail: 'Answer written from those facts only' },
];

export const CAPTURE_STAGES = [
  { key: 'voice', label: 'Voice', detail: 'Audio captured in the browser' },
  { key: 'understand', label: 'Understand', detail: 'Speech to text, speakers separated' },
  { key: 'remember', label: 'Remember', detail: 'Turn stored as a memory' },
  { key: 'connect', label: 'Connect', detail: 'Entities and relationships extracted' },
];

/**
 * @param {object}  props
 * @param {Array}   props.stages
 * @param {boolean} props.running   A request is in flight.
 * @param {boolean} props.complete  The response landed; light every stage.
 * @param {number}  props.pace      ms spent on each stage while walking.
 */
export function PipelineStages({ stages, running, complete = false, pace = 620, className = '' }) {
  const [reached, setReached] = useState(0);

  useEffect(() => {
    if (complete) {
      setReached(stages.length);
      return undefined;
    }
    if (!running) {
      setReached(0);
      return undefined;
    }

    setReached(1);
    // Walks up to the last stage and waits there. Synthesis is the slow step
    // and holding on it is truthful: that is where the time is actually going.
    const timer = setInterval(() => {
      setReached((current) => (current >= stages.length - 1 ? current : current + 1));
    }, pace);

    return () => clearInterval(timer);
  }, [running, complete, stages.length, pace]);

  return (
    <ol className={`pipeline ${className}`} aria-label="Retrieval progress">
      {stages.map((stage, index) => {
        const done = complete || index < reached - 1;
        const active = !complete && index === reached - 1;
        const state = done ? 'done' : active ? 'active' : 'idle';

        return (
          <li key={stage.key} className={`pipeline__stage is-${state}`}>
            <span className="pipeline__marker" aria-hidden="true">
              <span className="pipeline__dot" />
              {index < stages.length - 1 && (
                <span className="pipeline__link">
                  <span className="pipeline__link-fill" />
                </span>
              )}
            </span>

            <span className="pipeline__text">
              <span className="pipeline__label">{stage.label}</span>
              <span className="pipeline__detail">{stage.detail}</span>
            </span>

            <span className="sr-only">
              {done ? 'complete' : active ? 'in progress' : 'pending'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
