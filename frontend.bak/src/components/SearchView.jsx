import { useState } from 'react';
import { api } from '../api/neuris';

export default function SearchView() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.searchRAG(trimmed);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="search-view">
      <header className="view-header">
        <div>
          <h1 className="view-title">Search Memories</h1>
          <p className="view-subtitle">Semantic search across your knowledge graph</p>
        </div>
      </header>

      <div className="search-container">
        <div className="search-bar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search your memories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="btn btn-accent btn-sm" onClick={handleSearch} disabled={isLoading}>
            {isLoading ? <span className="spinner" /> : 'Search'}
          </button>
        </div>

        <div className="search-results">
          {error && (
            <div className="result-card" style={{ borderColor: 'var(--error)' }}>
              <p className="result-response" style={{ color: 'var(--error)' }}>
                Error: {error}. Make sure the backend is running.
              </p>
            </div>
          )}

          {result && result.data && (
            <div className="result-card">
              <p className="result-response">
                {result.data.response || 'No response generated.'}
              </p>
              {result.data.entities && result.data.entities.length > 0 && (
                <div className="message-entities" style={{ marginTop: '12px' }}>
                  {result.data.entities.map((e, i) => (
                    <span key={i} className="entity-tag">{e}</span>
                  ))}
                </div>
              )}
              <div className="result-meta">
                <span className="result-meta-item">
                  ⏱ {result.latency_ms?.toFixed(0) || '—'}ms
                </span>
                <span className="result-meta-item">
                  {result.cached ? '✓ Cached' : '○ Fresh'}
                </span>
                {result.data.context_used && (
                  <span className="result-meta-item">
                    {result.data.context_used.length} entities matched
                  </span>
                )}
              </div>
            </div>
          )}

          {!result && !error && !isLoading && (
            <div className="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <p>Search your memory graph using natural language</p>
            </div>
          )}

          {isLoading && (
            <div className="loading-state">
              <div className="spinner" />
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Searching memory graph...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
