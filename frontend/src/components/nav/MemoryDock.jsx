import { NavLink } from 'react-router-dom';
import { AudioLines, Clock3, CircleUser, Radar, Waypoints } from 'lucide-react';

/**
 * The memory dock — a floating control surface rather than a navbar.
 *
 * Recall sits raised in the centre with its own glow, because it is the thing
 * NEURIS is for; the two capture-and-explore actions flank it, and the two
 * retrospective views sit outside those. The order is symmetric on purpose:
 * the dock should read as an instrument, not a list of links.
 *
 * It doubles as the mobile navigation, so there is one control surface at
 * every size instead of two separate systems to keep in sync.
 */

const LEFT = [
  { to: '/capture', label: 'Capture', blurb: 'Record & transcribe', icon: AudioLines },
  { to: '/space', label: 'Memory Space', blurb: 'Everything connected', icon: Waypoints },
];

const RIGHT = [
  { to: '/timeline', label: 'Timeline', blurb: 'Memories in order', icon: Clock3 },
  { to: '/people', label: 'People', blurb: 'Who you spoke with', icon: CircleUser },
];

function DockItem({ item }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => `dockitem ${isActive ? 'is-active' : ''}`}
    >
      <span className="dockitem__icon" aria-hidden="true">
        <item.icon size={18} strokeWidth={1.75} />
      </span>
      <span className="dockitem__text">
        <span className="dockitem__label">{item.label}</span>
        <span className="dockitem__blurb">{item.blurb}</span>
      </span>
    </NavLink>
  );
}

export function MemoryDock() {
  return (
    <nav className="dock" aria-label="Memory actions">
      <div className="dock__shell">
        <div className="dock__side">
          {LEFT.map((item) => (
            <DockItem key={item.to} item={item} />
          ))}
        </div>

        {/* Raised out of the dock — the centre of the whole product. */}
        <NavLink
          to="/"
          end
          className={({ isActive }) => `dockhome ${isActive ? 'is-active' : ''}`}
        >
          <span className="dockhome__ring" aria-hidden="true" />
          <span className="dockhome__orb" aria-hidden="true">
            <Radar size={20} strokeWidth={1.7} />
          </span>
          <span className="dockhome__label">Recall</span>
        </NavLink>

        <div className="dock__side">
          {RIGHT.map((item) => (
            <DockItem key={item.to} item={item} />
          ))}
        </div>
      </div>
    </nav>
  );
}
