import { useEffect, useState } from 'react';
import { acquire, describeError, isSupported, release } from '../lib/audioEngine';

/**
 * Holds the microphone open purely so the visualiser has a real signal.
 *
 * The Web Speech API transcribes without exposing the audio it hears, so a
 * spoken question on the Recall screen would otherwise leave the orb with
 * nothing to react to. This takes a reference on the shared audio engine
 * instead of opening a second stream, which means one permission prompt and
 * one analyser regardless of how many things are watching.
 *
 * Returns only coarse status. The signal itself is read from
 * `audioEngine.metrics` inside the render loops that draw it.
 */
export function useMicMeter(active) {
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || !isSupported()) {
      setReady(false);
      return undefined;
    }

    let held = false;
    let cancelled = false;

    acquire()
      .then(() => {
        if (cancelled) {
          // Unmounted while the permission prompt was open — hand the
          // reference straight back rather than leaking the stream.
          release();
          return;
        }
        held = true;
        setReady(true);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(describeError(err));
      });

    return () => {
      cancelled = true;
      setReady(false);
      if (held) release();
    };
  }, [active]);

  return { ready, error };
}
