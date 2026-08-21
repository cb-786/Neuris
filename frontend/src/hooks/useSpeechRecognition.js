import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web Speech API wrapper — the same in-browser capture path the original
 * voice tester used, with interim results surfaced so the user sees words
 * appear as they speak.
 *
 * Availability is Chrome/Edge-only; `supported` lets callers degrade cleanly
 * rather than showing a dead button.
 */
export function useSpeechRecognition({ language = 'en-US', onFinal } = {}) {
  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : undefined;

  const supported = Boolean(SpeechRecognition);

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    if (!supported) return undefined;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const chunk = result[0]?.transcript ?? '';
        if (result.isFinal) finalRef.current += chunk;
        else interimText += chunk;
      }
      setInterim(interimText);
    };

    // Mirrors the original tester: stop as soon as the speaker pauses.
    recognition.onspeechend = () => {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    };

    recognition.onerror = (event) => {
      // `aborted` fires on our own stop() calls and is not a user-facing error.
      if (event.error === 'aborted') return;
      setError(
        event.error === 'not-allowed'
          ? 'Microphone permission denied. Allow mic access in your browser to use voice.'
          : event.error === 'no-speech'
            ? 'No speech detected. Try again and speak a little louder.'
            : `Speech recognition error: ${event.error}`
      );
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim('');
      const text = finalRef.current.trim();
      finalRef.current = '';
      if (text) onFinalRef.current?.(text);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onspeechend = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    };
  }, [SpeechRecognition, supported, language]);

  const start = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    setError(null);
    setInterim('');
    finalRef.current = '';
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // start() throws if a session is already running; ignore and stay in sync.
      setListening(false);
    }
  }, [listening]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      /* noop */
    }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, interim, error, start, stop, toggle, clearError: () => setError(null) };
}
