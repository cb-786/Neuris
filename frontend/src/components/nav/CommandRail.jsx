import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, RotateCw } from 'lucide-react';
import { NeurisMark } from '../brand/NeurisMark';
import { NAV_SECTIONS } from './navigation';

/**
 * The rail — NEURIS's memory control panel.
 *
 * Deliberately not a SaaS sidebar: no filled panel, no cards, no avatar block,
 * no conversation history. It is a thin column of light against the same void
 * the rest of the app sits in, and the only thing that glows is where you are.
 *
 * Collapsing keeps the rail present as an icon column rather than removing it,
 * so the navigation model never changes shape — labels fade, width animates,
 * and each icon keeps its name in a tooltip.
 */

const DEP_LABELS = {
  database: 'Store',
  graph: 'Graph',
  cache: 'Cache',
};

/**
 * Live state of the three services memory depends on, straight from /health.
 * Shown because when the graph is down, recall silently returns nothing — the
 * user deserves to see that rather than conclude NEURIS forgot.
 */
function SystemPulse({ health, collapsed }) {
  const deps = health?.info?.dependencies ?? null;
  const status = health?.status ?? 'checking';
  const offline = status === 'offline';

  const label = offline
    ? 'Memory system unavailable'
    : status === 'online'
      ? 'Memory system online'
      : 'Connecting to memory';

  if (collapsed) {
    return (
      <div className="pulse pulse--mini" title={label}>
        <span className={`pulse__beacon pulse__beacon--${status}`} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div className="pulse">
      <div className="pulse__head">
        <span className={`pulse__beacon pulse__beacon--${status}`} aria-hidden="true" />
        <span className="pulse__label">{label}</span>
        {health?.latency != null && !offline && (
          <span className="pulse__latency tnum">{health.latency}ms</span>
        )}
      </div>

      {deps && (
        <ul className="pulse__deps">
          {Object.entries(DEP_LABELS).map(([key, text]) => {
            const state = deps[key]?.status === 'ok' ? 'ok' : deps[key] ? 'down' : 'unknown';
            return (
              <li key={key} className={`pulse__dep pulse__dep--${state}`}>
                <span className="pulse__dep-dot" aria-hidden="true" />
                <span>{text}</span>
                <span className="sr-only">
                  {state === 'ok' ? 'operational' : state === 'down' ? 'unavailable' : 'unknown'}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {offline && (
        <button type="button" className="pulse__retry" onClick={health?.refresh}>
          <RotateCw size={12} strokeWidth={2} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}

export function CommandRail({ open, collapsed, onToggleCollapse, onNavigate, health, asDrawer }) {
  return (
    <aside
      id="app-rail"
      className={`rail ${open ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''} ${
        asDrawer ? 'rail--drawer' : ''
      }`}
      aria-label="All sections"
      aria-hidden={asDrawer && !open ? 'true' : undefined}
    >
      <div className="rail__brand">
        <span className="rail__mark" aria-hidden="true">
          <NeurisMark size={20} />
        </span>
        <span className="rail__wordmark">
          <span className="rail__name">NEURIS</span>
          <span className="rail__tagline">Memory Intelligence</span>
        </span>
      </div>

      {/* Desktop-only: the mobile drawer is dismissed from the bar instead. */}
      <button
        type="button"
        className="rail__collapse"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-expanded={!collapsed}
        aria-controls="app-rail"
      >
        {collapsed ? (
          <PanelLeftOpen size={16} strokeWidth={1.9} aria-hidden="true" />
        ) : (
          <PanelLeftClose size={16} strokeWidth={1.9} aria-hidden="true" />
        )}
      </button>

      <nav className="rail__nav">
        {NAV_SECTIONS.map((section) => (
          <div className="rail__group" key={section.label}>
            <h2 className="rail__group-label">
              <span>{section.label}</span>
              {/* Stands in for the label once it has faded out, so the groups
                  stay visually separated in the icon rail. */}
              <span className="rail__group-rule" aria-hidden="true" />
            </h2>
            <ul className="rail__list">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) => `railitem ${isActive ? 'is-active' : ''}`}
                  >
                    <span className="railitem__glow" aria-hidden="true" />
                    <span className="railitem__icon">
                      <item.icon size={17} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="railitem__text">
                      <span className="railitem__label">{item.label}</span>
                      <span className="railitem__blurb">{item.blurb}</span>
                    </span>
                    <kbd className="railitem__key" aria-hidden="true">
                      {item.key}
                    </kbd>
                    {/* Only rendered as a tooltip in the collapsed rail. */}
                    <span className="railitem__tip" aria-hidden="true">
                      {item.label}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="rail__foot">
        <SystemPulse health={health} collapsed={collapsed} />
      </div>
    </aside>
  );
}
