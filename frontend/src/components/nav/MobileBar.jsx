import { NavLink } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { PRIMARY_NAV } from './navigation';

/**
 * Mobile navigation.
 *
 * The four modes that matter get a permanent slot; everything else is behind
 * More. Capture is centre-weighted and carries the voice accent, because on a
 * phone the microphone is the reason the app is open.
 */
export function MobileBar({ onMore, moreActive }) {
  return (
    <nav className="mobilebar" aria-label="Primary">
      {PRIMARY_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `mobilebar__item ${isActive ? 'is-active' : ''} ${item.to === '/capture' ? 'is-voice' : ''}`
          }
        >
          <item.icon size={19} strokeWidth={1.8} aria-hidden="true" />
          <span>{item.short}</span>
        </NavLink>
      ))}

      <button
        type="button"
        className={`mobilebar__item ${moreActive ? 'is-active' : ''}`}
        onClick={onMore}
        aria-expanded={moreActive}
        aria-controls="app-rail"
      >
        <MoreHorizontal size={19} strokeWidth={1.8} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}
