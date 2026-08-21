import { useCallback, useEffect, useRef, useState } from 'react';
import {
  acquire,
  beginEnvelope,
  describeError,
  endEnvelope,
  isSupported,
  release,
} from '../lib/audioEngine';

const PREFERRED_MIME = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return PREFERRED_MIME.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

/**
 * MediaRecorder capture for the server-side STT path
 * (POST /api/v1/conversations/ingest/audio), which is what unlocks speaker
 * diarization — the browser Speech API cannot do that.
 *
 * The stream comes from the shared audio engine rather than its own
 * getUserMedia call, so recording and visualisation use one microphone and the
 * user is prompted for permission at most once.
 *
 * Note what this hook deliberately does NOT return: per-frame level or band
 * data. Those live in `audioEngine.metrics` and are read straight from the
 * animation loops that draw them. Returning them here would re-render every
 * consumer sixty times a second for no visual gain.
 */
export function useAudioRecorder({ onComplete } = {}) {
  const supported =
    isSupported() && typeof MediaRecorder !== 'undefined';

  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [envelope, setEnvelope] = useState([]);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);
  const heldRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const letGo = useCallback(() => {
    if (!heldRef.current) return;
    heldRef.current = false;
    release();
  }, []);

  // Guarantees the microphone is released if the page navigates away or the
  // component unmounts mid-take.
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current?.state === 'recording') {
        cancelledRef.current = true;
        try {
          recorderRef.current.stop();
        } catch {
          /* already stopped */
        }
      }
      letGo();
    },
    [letGo]
  );

  const start = useCallback(async () => {
    if (!supported || recording) return;

    setError(null);
    setElapsed(0);
    setEnvelope([]);
    cancelledRef.current = false;
    chunksRef.current = [];

    let stream;
    try {
      stream = await acquire();
      heldRef.current = true;
    } catch (err) {
      setError(describeError(err));
      return;
    }

    let recorder;
    try {
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      letGo();
      setError('This browser cannot record from the microphone.');
      return;
    }

    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      chunksRef.current = [];

      // Published before the engine is released, so consumers receive the
      // finished envelope in the same commit that recording flips to false.
      setEnvelope(endEnvelope());
      letGo();

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setRecording(false);

      if (!cancelledRef.current && blob.size > 0) onCompleteRef.current?.(blob);
    };

    beginEnvelope();
    recorder.start();
    setRecording(true);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }, [supported, recording, letGo]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
  }, [stop]);

  const toggle = useCallback(() => {
    if (recording) stop();
    else start();
  }, [recording, start, stop]);

  return {
    supported,
    recording,
    error,
    elapsed,
    envelope,
    start,
    stop,
    cancel,
    toggle,
    clearError: () => setError(null),
  };
}
