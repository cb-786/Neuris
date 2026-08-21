import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, RotateCw, Search } from 'lucide-react';
import { NeurisMark } from '../brand/NeurisMark';
import { NAV_SECTIONS } from './navigation';

/**
 * The control layer.
 *
 * A thin header rather than a tall sidebar: NEURIS is a space you look into,
 * and a persistent column down one edge both eats the stage and reads as a
 * chat application. Primary routes live here; the rest sit behind the dock.
 *
 * The search field is a real control — it routes to Recall with the query,
 * which runs the same retrieval path as asking by voice.
 */

const PRIMARY = NAV_SECTIONS[0].items.concat(NAV_SECTIONS[1].items);

function StatusPip({ health }) {
  const status = health?.status ?? 'checking';
  const offline = status === 'offline';
  const label = offline
    ? 'Memory system unavailable'
    : status === 'online'
      ? 'Memory system online'
      : 'Connecting to memory';

  return (
    <div className={`statuspip statuspip--${status}`}>
      <span className="statuspip__dot" aria-hidden="true" />
      <span className="statuspip__text">{label}</span>
      {health?.latency != null && !offline && (
        <span className="statuspip__ms tnum">{health.latency}ms</span>
      )}
      {offline && (
        <button type="button" className="statuspip__retry" onClick={health?.refresh}>
          <RotateCw size={11} strokeWidth={2.2} aria-hidden="true" />
          <span className="sr-only">Retry connection</span>
        </button>
      )}
    </div>
  );
}

export function TopBar({ health, onOpenMenu }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Slash focuses search, the way a system utility would.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const el = event.target;
      if (
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      )
        return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    setQuery('');
    inputRef.current?.blur();
    // Recall reads this and runs the query immediately.
    navigate('/', { state: { query: text } });
  };

  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand" aria-label="NEURIS home">
        <span className="topbar__mark" aria-hidden="true">
          <NeurisMark size={19} />
        </span>
        <span className="topbar__wordmark">
          <span className="topbar__name">NEURIS</span>
          <span className="topbar__tagline">Memory Intelligence</span>
        </span>
      </Link>

      <nav className="topnav" aria-label="Primary">
        {PRIMARY.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `topnav__link ${isActive ? 'is-active' : ''}`}
          >
            <span>{item.label}</span>
            <span className="topnav__underline" aria-hidden="true" />
          </NavLink>
        ))}
      </nav>

      <form className="topsearch" onSubmit={submit} role="search">
        <Search size={15} strokeWidth={2} aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search memories, people, topics…"
          aria-label="Search your memories"
          autoComplete="off"
        />
        <kbd aria-hidden="true">/</kbd>
      </form>

      <div className="topbar__end">
        <StatusPip health={health} />
        <button
          type="button"
          className="topbar__menu"
          onClick={onOpenMenu}
          aria-label="Open menu"
        >
          <Menu size={18} strokeWidth={1.9} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
