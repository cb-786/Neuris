import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { VoiceRing } from './VoiceRing';
import { WaveField } from './WaveField';
import { metrics } from '../../lib/audioEngine';

/**
 * The Memory Orb — the control NEURIS is built around.
 *
 * It is a real <button> in every state, so it is focusable, operable by
 * keyboard, and announced correctly. Everything visual around it (rings,
 * spectrum, particles, glow) is canvas or decoration and is aria-hidden.
 *
 * Two things happen here without React state, on purpose:
 *
 *   - the audio-reactive glow is written straight onto the element as a CSS
 *     custom property from an animation frame
 *   - pointer position is written into a ref the canvas reads
 *
 * Both change every frame. Routing them through useState would re-render the
 * page continuously for effects that only ever touch style.
 *
 * States, and what each is allowed to claim:
 *   idle        waiting; nothing captured
 *   listening   the microphone is genuinely open and recording
 *   processing  a request is in flight to the backend
 *   forming     a response arrived and memory is being assembled
 *   settled     finished
 */

const COPY = {
  idle: { hint: 'Ask NEURIS', aria: 'Start listening' },
  listening: { hint: 'Listening', aria: 'Stop listening' },
  processing: { hint: 'Understanding', aria: 'Processing, please wait' },
  forming: { hint: 'Forming memory', aria: 'Forming memory, please wait' },
  settled: { hint: 'Ask NEURIS', aria: 'Start listening' },
};

export function MemoryOrb({
  state = 'idle',
  onActivate,
  disabled = false,
  size = 'lg',
  hue,
  label,
  hint,
  elapsedLabel,
  /** The wide horizontal waveform. Off for the compact orb, where there is
      no room for it to read as anything but noise. */
  wave = true,
}) {
  const rootRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const [pressed, setPressed] = useState(false);

  const listening = state === 'listening';
  const processing = state === 'processing';
  const forming = state === 'forming';
  const copy = COPY[state] ?? COPY.idle;

  // Violet going in (voice), cyan coming back (memory), warm while live.
  const ringHue = hue ?? (listening ? 'live' : processing || forming ? 'memory' : 'voice');

  // ── Audio-reactive glow, written directly to CSS ────────────────────────
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    if (!listening) {
      el.style.setProperty('--orb-level', '0');
      return undefined;
    }

    let raf = 0;
    let shown = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // One more easing pass on top of the engine envelope: the glow should
      // swell and fade rather than track every syllable.
      shown += (metrics.level - shown) * 0.16;
      el.style.setProperty('--orb-level', shown.toFixed(3));
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el.style.setProperty('--orb-level', '0');
    };
  }, [listening]);

  // ── Pointer magnetism ───────────────────────────────────────────────────
  const onPointerMove = useCallback((event) => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    pointerRef.current = { x, y, inside: true };

    // Very small lean toward the cursor — perceptible as responsiveness, not
    // as the orb chasing the mouse.
    const dx = (x / rect.width - 0.5) * 2;
    const dy = (y / rect.height - 0.5) * 2;
    el.style.setProperty('--orb-tilt-x', `${(dx * 5).toFixed(2)}px`);
    el.style.setProperty('--orb-tilt-y', `${(dy * 5).toFixed(2)}px`);
  }, []);

  const onPointerLeave = useCallback(() => {
    const el = rootRef.current;
    pointerRef.current = { ...pointerRef.current, inside: false };
    if (el) {
      el.style.setProperty('--orb-tilt-x', '0px');
      el.style.setProperty('--orb-tilt-y', '0px');
    }
  }, []);

  return (
    <div
      ref={rootRef}
      className={`orb orb--${size} orb--${state} ${pressed ? 'is-pressed' : ''}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {/* Breaks out of the orb box on both sides — the waveform is meant to
          span the hero, with the orb sitting inside its own voice. */}
      {wave && <WaveField state={state} className="orb__wave" />}

      <div className="orb__aura" aria-hidden="true" />

      <VoiceRing
        state={state}
        hue={ringHue}
        pointerRef={pointerRef}
        className="orb__spectrum"
      />

      <span className="orb__track orb__track--outer" aria-hidden="true" />
      <span className="orb__track orb__track--inner" aria-hidden="true" />

      <button
        type="button"
        className="orb__button"
        onClick={onActivate}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        disabled={disabled}
        aria-label={label ?? copy.aria}
        aria-pressed={listening}
      >
        <span className="orb__sphere" aria-hidden="true" />
        <span className="orb__gloss" aria-hidden="true" />
        <span className="orb__icon" aria-hidden="true">
          {listening ? (
            <Square size={20} strokeWidth={2} fill="currentColor" />
          ) : (
            <Mic size={28} strokeWidth={1.6} />
          )}
        </span>
      </button>

      <div className="orb__caption">
        {listening && elapsedLabel ? (
          <span className="orb__timer tnum" role="timer">
            <span className="orb__live-dot" aria-hidden="true" />
            {elapsedLabel}
          </span>
        ) : null}
        <span className="orb__hint" aria-live="polite">
          {hint ?? copy.hint}
        </span>
      </div>
    </div>
  );
}
