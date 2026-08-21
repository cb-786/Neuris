import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/api';

/**
 * Polls /health so the shell can show a truthful connection state.
 * Pauses while the tab is hidden to avoid pointless background traffic.
 */
export function useHealth({ intervalMs = 30000 } = {}) {
  const [status, setStatus] = useState('checking'); // checking | online | offline
  const [info, setInfo] = useState(null);
  const [latency, setLatency] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    const started = performance.now();
    try {
      const data = await api.health();
      if (!mountedRef.current) return;
      setInfo(data);
      setLatency(Math.round(performance.now() - started));
      setStatus('online');
    } catch {
      if (!mountedRef.current) return;
      setInfo(null);
      setLatency(null);
      setStatus('offline');
    } finally {
      if (mountedRef.current) setCheckedAt(Date.now());
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const schedule = () => {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') check();
      }, intervalMs);
    };

    check();
    schedule();

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check, intervalMs]);

  return { status, info, latency, checkedAt, refresh: check };
}
