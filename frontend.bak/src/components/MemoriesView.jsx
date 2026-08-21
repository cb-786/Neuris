import { useState, useEffect } from 'react';
import { api } from '../api/neuris';

export default function MemoriesView() {
  const [memories, setMemories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadMemories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getMemories();
      setMemories(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  return (
    <div className="memories-view">
      <header className="view-header">
        <div>
          <h1 className="view-title">Stored Memories</h1>
          <p className="view-subtitle">Browse your persistent memory store</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadMemories} disabled={isLoading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          Refresh
        </button>
      </header>

      <div className="memories-container">
        {isLoading && (
          <div className="loading-state">
            <div className="spinner" />
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading memories...</p>
          </div>
        )}

        {error && (
          <div className="empty-state">
            <p style={{ color: 'var(--error)' }}>Error: {error}</p>
          </div>
        )}

        {!isLoading && !error && memories.length === 0 && (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <p>No memories stored yet. Start a conversation to build your knowledge graph.</p>
          </div>
        )}

        {!isLoading && memories.length > 0 && (
          <div className="memories-grid">
            {memories.map((mem) => (
              <div key={mem.id} className="memory-card">
                <div className="memory-card-header">
                  <div className="memory-card-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    </svg>
                  </div>
                  <span className="memory-card-id">{mem.id}</span>
                </div>
                <p className="memory-card-summary">{mem.summary}</p>
                <p className="memory-card-content">{mem.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
