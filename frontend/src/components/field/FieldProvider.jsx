import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MemoryField } from './MemoryField';

/**
 * Owns the ambient memory field so it survives navigation.
 *
 * Pages declare only what they are doing — `idle`, `listening`, `recalling`,
 * `forming` — and the field responds. Audio reactivity is not plumbed through
 * here: the field reads the shared engine's metrics directly, so a page never
 * has to forward amplitude and the provider never re-renders on a signal.
 */

const FieldContext = createContext(null);

export function useField() {
  const context = useContext(FieldContext);
  if (!context) throw new Error('useField must be used inside <FieldProvider>');
  return context;
}

/**
 * Declarative form: sets the mode while mounted and restores idle on unmount,
 * so a page can never leave the background stuck in `listening`.
 */
export function useFieldMode(mode) {
  const { setMode } = useField();

  useEffect(() => {
    setMode(mode);
    return () => setMode('idle');
  }, [mode, setMode]);
}

export function FieldProvider({ kinds, children }) {
  const [mode, setMode] = useState('idle');
  const value = useMemo(() => ({ mode, setMode }), [mode]);

  return (
    <FieldContext.Provider value={value}>
      <MemoryField mode={mode} kinds={kinds} />
      {children}
    </FieldContext.Provider>
  );
}
