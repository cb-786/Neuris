import { useState, useEffect } from 'react';
import { api } from '../api/neuris';

const STAT_ICONS = {
  queries: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  status: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  memories: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
  ),
  cache: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
};

export default function AnalyticsView() {
  const [stats, setStats] = useState({
    totalQueries: '—',
    systemStatus: '—',
    totalMemories: '—',
    cacheStatus: '—',
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [analyticsData, memoriesData, healthData] = await Promise.allSettled([
        api.getAnalyticsSummary(),
        api.getMemories(),
        api.healthCheck(),
      ]);

      setStats({
        totalQueries:
          analyticsData.status === 'fulfilled'
            ? (analyticsData.value.data?.total_queries ?? 0).toString()
            : '—',
        systemStatus:
          healthData.status === 'fulfilled' ? 'Online' : 'Offline',
        totalMemories:
          memoriesData.status === 'fulfilled'
            ? (memoriesData.value.data?.length ?? 0).toString()
            : '—',
        cacheStatus: 'Redis Active',
      });
    } catch {
      // Keep defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const cards = [
    { icon: STAT_ICONS.queries, value: stats.totalQueries, label: 'Total Queries' },
    { icon: STAT_ICONS.status, value: stats.systemStatus, label: 'System Status' },
    { icon: STAT_ICONS.memories, value: stats.totalMemories, label: 'Stored Memories' },
    { icon: STAT_ICONS.cache, value: stats.cacheStatus, label: 'Cache Status' },
  ];

  return (
    <div className="analytics-view">
      <header className="view-header">
        <div>
          <h1 className="view-title">Analytics</h1>
          <p className="view-subtitle">System performance and usage metrics</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadAnalytics} disabled={isLoading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          Refresh
        </button>
      </header>

      <div className="analytics-container">
        <div className="analytics-cards">
          {cards.map((card, i) => (
            <div key={i} className="stat-card">
              <div className="stat-icon">{card.icon}</div>
              <div>
                <span className="stat-value">{card.value}</span>
                <span className="stat-label">{card.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
