import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  PlugZap,
  RotateCcw,
  Save,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Switch, useToast } from '../components/ui';
import { api } from '../api/api';
import { configStore, getApiBase, setApiBase, STT_LANGUAGES } from '../lib/config';
import { clearSession, getEntries } from '../lib/session';

/**
 * SETTINGS — everything here is stored in this browser only.
 *
 * Carried over unchanged from the previous build: API endpoint (with save and
 * connection test), spoken language, raw payload visibility, and reset.
 *
 * One setting is deliberately gone. "Default capture mode" used to let the user
 * pick browser dictation or server STT for the same screen. That choice is now
 * structural rather than a preference: Recall transcribes in the browser
 * because asking a question must not write to memory, and Capture uploads audio
 * because speaker diarization only exists server-side. Making it configurable
 * again would let recall silently start storing conversations.
 */

function Field({ title, description, htmlFor, children }) {
  return (
    <div className="setting">
      <div className="setting__text">
        <label className="setting__title" htmlFor={htmlFor}>
          {title}
        </label>
        {description && <p className="setting__desc">{description}</p>}
      </div>
      <div className="setting__control">{children}</div>
    </div>
  );
}

export function Settings() {
  const { toast } = useToast();

  const [apiBase, setApiBaseValue] = useState(() => getApiBase());
  const [language, setLanguage] = useState(() => configStore.get('language'));
  const [showRaw, setShowRaw] = useState(() => configStore.get('showRaw'));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [sessionCount, setSessionCount] = useState(() => getEntries().length);

  const dirty = apiBase.replace(/\/+$/, '') !== getApiBase();

  useEffect(() => {
    configStore.set('language', language);
  }, [language]);

  useEffect(() => {
    configStore.set('showRaw', showRaw);
  }, [showRaw]);

  const saveApiBase = () => {
    setApiBase(apiBase);
    setApiBaseValue(getApiBase());
    setTestResult(null);
    toast('API endpoint saved.', { tone: 'success' });
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const started = performance.now();
    try {
      const data = await api.health();
      setTestResult({
        ok: true,
        ms: Math.round(performance.now() - started),
        service: data?.service,
        version: data?.version,
      });
    } catch (err) {
      setTestResult({ ok: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const resetAll = () => {
    ['apiBase', 'language', 'captureMode', 'showRaw'].forEach((key) => configStore.reset(key));
    setApiBaseValue(getApiBase());
    setLanguage(configStore.get('language'));
    setShowRaw(configStore.get('showRaw'));
    setTestResult(null);
    toast('Preferences reset to defaults.', { tone: 'info' });
  };

  const forgetSession = () => {
    clearSession();
    setSessionCount(0);
    toast('Session view cleared. Stored memories are unaffected.', { tone: 'info' });
  };

  return (
    <div className="settings">
      <header className="page__head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className="page__title">Preferences</h1>
          <p className="page__lead">
            Stored in this browser only. Nothing on this page is sent to the backend.
          </p>
        </div>
        <button type="button" className="btn btn--quiet" onClick={resetAll}>
          <RotateCcw size={15} strokeWidth={1.9} aria-hidden="true" />
          Reset to defaults
        </button>
      </header>

      <section className="panel">
        <h2 className="panel__title">Connection</h2>
        <p className="panel__lead">Where the interface sends its requests.</p>

        <Field
          title="API endpoint"
          description="Leave empty to use the same origin, which is what the dev proxy and the nginx route expect. Set an absolute origin such as http://localhost:8000 to target a remote backend."
          htmlFor="api-base"
        >
          <div className="stack gap-2">
            <input
              id="api-base"
              className="control"
              type="url"
              inputMode="url"
              value={apiBase}
              placeholder="(same origin)"
              onChange={(event) => setApiBaseValue(event.target.value)}
              spellCheck="false"
              autoComplete="off"
            />
            <div className="row gap-2 wrap">
              <button
                type="button"
                className={`btn btn--sm ${dirty ? 'btn--voice' : 'btn--quiet'}`}
                onClick={saveApiBase}
                disabled={!dirty}
              >
                <Save size={14} strokeWidth={1.9} aria-hidden="true" />
                Save
              </button>
              <button
                type="button"
                className="btn btn--sm btn--quiet"
                onClick={testConnection}
                disabled={testing}
              >
                <PlugZap size={14} strokeWidth={1.9} aria-hidden="true" />
                {testing ? 'Testing…' : 'Test'}
              </button>
            </div>
          </div>
        </Field>

        {testResult && (
          <div
            className={`testresult ${testResult.ok ? 'is-ok' : 'is-bad'}`}
            role="status"
          >
            {testResult.ok ? (
              <>
                <CheckCircle2 size={14} strokeWidth={2} aria-hidden="true" />
                {testResult.service} v{testResult.version} responded in {testResult.ms} ms
              </>
            ) : (
              <>
                <XCircle size={14} strokeWidth={2} aria-hidden="true" />
                {testResult.message}
              </>
            )}
          </div>
        )}

        <Field
          title="API reference"
          description="Interactive OpenAPI documentation served by the backend."
        >
          <a
            className="btn btn--sm btn--quiet"
            href={`${getApiBase()}/api/docs`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} strokeWidth={1.9} aria-hidden="true" />
            Open docs
          </a>
        </Field>
      </section>

      <section className="panel">
        <h2 className="panel__title">Voice</h2>
        <p className="panel__lead">How speech is transcribed.</p>

        <Field
          title="Spoken language"
          description="Sent as the language hint for server-side transcription during capture, and used for browser dictation during recall."
          htmlFor="stt-language"
        >
          <select
            id="stt-language"
            className="control control--select"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {STT_LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <p className="setting__aside">
          Transport is fixed per mode and not configurable: Recall transcribes in the browser so
          that asking a question never writes to memory, and Capture uploads audio because speaker
          separation only runs server-side.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel__title">Interface</h2>
        <p className="panel__lead">What the interface exposes.</p>

        <Field
          title="Show raw payloads"
          description="Adds a collapsible JSON view of the backend response to answers and captures. Useful when demonstrating what retrieval actually returned."
          htmlFor="show-raw"
        >
          <Switch id="show-raw" checked={showRaw} onChange={setShowRaw} label="Show raw payloads" />
        </Field>

        <Field
          title="Session view"
          description="Transcripts and grounding subgraphs from this tab, used to show speakers and connections that the stored API does not return on its own. Clearing it does not delete any stored memory."
        >
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={forgetSession}
            disabled={sessionCount === 0}
          >
            <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
            {sessionCount ? `Clear ${sessionCount} from this session` : 'Nothing to clear'}
          </button>
        </Field>
      </section>
    </div>
  );
}
