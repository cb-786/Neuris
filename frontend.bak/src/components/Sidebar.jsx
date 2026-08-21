import { useState, useEffect } from 'react';
import { api } from '../api/neuris';

const NAV_ITEMS = [
  {
    id: 'chat',
    label: 'Memory Chat',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    id: 'search',
    label: 'Search',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
    ),
  },
  {
    id: 'memories',
    label: 'Memories',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
      </svg>
    ),
  },
];

export default function Sidebar({ activeView, onNavigate }) {
  const [status, setStatus] = useState({ connected: false, text: 'Connecting...' });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await api.healthCheck();
        setStatus({ connected: true, text: 'Backend Online' });
      } catch {
        setStatus({ connected: false, text: 'Backend Offline' });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="url(#lg)" strokeWidth="2"/>
              <circle cx="16" cy="16" r="5" fill="url(#lg)"/>
              <circle cx="16" cy="6" r="2.5" fill="var(--accent)"/>
              <circle cx="24.5" cy="21" r="2.5" fill="var(--accent-dim)"/>
              <circle cx="7.5" cy="21" r="2.5" fill="var(--accent-dim)"/>
              <line x1="16" y1="11" x2="16" y2="8.5" stroke="var(--accent)" strokeWidth="1.5"/>
              <line x1="20.5" y1="18" x2="22.5" y2="19.5" stroke="var(--accent-dim)" strokeWidth="1.5"/>
              <line x1="11.5" y1="18" x2="9.5" y2="19.5" stroke="var(--accent-dim)" strokeWidth="1.5"/>
              <defs>
                <linearGradient id="lg" x1="2" y1="2" x2="30" y2="30">
                  <stop stopColor="var(--accent)"/>
                  <stop offset="1" stopColor="var(--accent-dim)"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="logo-text">NEURIS</span>
        </div>
        <span className="logo-badge">v1.0</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="status-indicator">
          <span className={`status-dot ${status.connected ? 'connected' : 'error'}`}></span>
          <span>{status.text}</span>
        </div>
      </div>
    </aside>
  );
}
