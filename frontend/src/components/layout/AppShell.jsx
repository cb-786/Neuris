import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CommandRail } from '../nav/CommandRail';
import { TopBar } from '../nav/TopBar';
import { MemoryDock } from '../nav/MemoryDock';
import { FieldProvider } from '../field/FieldProvider';
import { FLAT_NAV } from '../nav/navigation';
import { useHealth } from '../../hooks/useHealth';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useMemoryGraph } from '../../hooks/useMemoryGraph';

/**
 * The frame every route renders inside.
 *
 * There is no topbar and no breadcrumb — each page opens with its own
 * statement instead, because a persistent chrome strip is what makes a product
 * read as a dashboard, and NEURIS is a space.
 */

const COLLAPSE_KEY = 'neuris.railCollapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const isCompact = useMediaQuery('(max-width: 960px)');
  const health = useHealth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Fetched once at the shell so the ambient field, Memory Space and People
  // all read the same graph instead of each firing their own request.
  const memory = useMemoryGraph();

  // The field is tinted by the kinds of node actually in the user's graph.
  const kinds = useMemo(() => {
    const set = new Set(memory.graph.nodes.map((n) => n.kind));
    set.delete('unknown');
    return set.size ? [...set] : undefined;
  }, [memory.graph]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable — the choice just will not persist */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Digits jump between routes, [ toggles the rail, Escape closes the drawer.
  // All skipped while typing, so a query containing a number still works.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const el = event.target;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable);
      if (typing) return;

      if (event.key === '[') {
        event.preventDefault();
        toggleCollapse();
        return;
      }

      const match = FLAT_NAV.find((item) => item.key === event.key);
      if (match) {
        event.preventDefault();
        navigate(match.to);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, navigate, toggleCollapse]);

  return (
    <FieldProvider kinds={kinds}>
      <div className={`shell ${isCompact ? 'shell--compact' : ''}`}>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>

        <TopBar health={health} onOpenMenu={() => setDrawerOpen(true)} />

        <main id="main-content" className="shell__main">
          {/* Keyed on the path so each route plays a short entrance rather
              than swapping instantly. Kept brief — navigation should never
              feel like it is waiting on an animation. */}
          <div className="routeview" key={pathname}>
            <Outlet context={{ health, memory }} />
          </div>
        </main>

        <MemoryDock />

        {/* The full route list, including the system pages the dock leaves
            out. Opened from the menu button at any size. */}
        <CommandRail
          open={drawerOpen}
          collapsed={false}
          onToggleCollapse={toggleCollapse}
          onNavigate={closeDrawer}
          health={health}
          asDrawer
        />

        {drawerOpen && (
          <button
            type="button"
            className="rail-scrim"
            onClick={closeDrawer}
            aria-label="Close menu"
          />
        )}
      </div>
    </FieldProvider>
  );
}
