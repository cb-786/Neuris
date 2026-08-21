/**
 * Runtime configuration, persisted to localStorage so the app keeps working
 * against whichever backend the operator points it at.
 *
 * Precedence: user setting (localStorage) > build-time env > same-origin ''.
 * An empty base means "same origin", which is what the Vite dev proxy and the
 * nginx reverse-proxy in docker-compose both expect.
 */

const KEYS = {
  apiBase: 'neuris.apiBase',
  theme: 'neuris.theme',
  language: 'neuris.sttLanguage',
  captureMode: 'neuris.captureMode',
  showRaw: 'neuris.showRaw',
};

const DEFAULTS = {
  apiBase: import.meta.env.VITE_API_BASE_URL || '',
  theme: 'system',
  language: 'en-US',
  captureMode: 'browser', // 'browser' = Web Speech API, 'server' = upload to STT
  showRaw: false,
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — fall back to in-memory only */
  }
}

export const configStore = {
  KEYS,
  DEFAULTS,
  get(name) {
    return read(KEYS[name], DEFAULTS[name]);
  },
  set(name, value) {
    write(KEYS[name], value);
  },
  reset(name) {
    try {
      localStorage.removeItem(KEYS[name]);
    } catch {
      /* noop */
    }
  },
};

/** Normalised API origin, never with a trailing slash. */
export function getApiBase() {
  const raw = configStore.get('apiBase');
  return typeof raw === 'string' ? raw.replace(/\/+$/, '') : '';
}

export function setApiBase(value) {
  configStore.set('apiBase', (value || '').trim().replace(/\/+$/, ''));
}

/**
 * Theme is stored as a bare string (not JSON) because index.html reads it
 * synchronously before any bundle executes, to avoid a flash of wrong theme.
 */
export function getTheme() {
  try {
    return localStorage.getItem(KEYS.theme) || 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
  try {
    if (theme === 'system') localStorage.removeItem(KEYS.theme);
    else localStorage.setItem(KEYS.theme, theme);
  } catch {
    /* noop */
  }
}

export const STT_LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'hi-IN', label: 'Hindi (India)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
];
