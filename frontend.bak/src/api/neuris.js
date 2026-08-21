/* ══════════════════════════════════════════════════════════════════════════════
   NEURIS API Client
   Handles all communication with the FastAPI backend
   ══════════════════════════════════════════════════════════════════════════════ */

const API_BASE = '/api/v1';

class NeurisAPI {
  /**
   * POST /conversations/ingest — send text to the memory pipeline
   */
  async ingestText(text) {
    const res = await fetch(`${API_BASE}/conversations/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Ingest failed: ${res.status}`);
    return res.json();
  }

  /**
   * GET /search/rag?q=... — semantic search across memory graph
   */
  async searchRAG(query) {
    const res = await fetch(`${API_BASE}/search/rag?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
  }

  /**
   * GET /memories — list stored memories
   */
  async getMemories() {
    const res = await fetch(`${API_BASE}/memories`);
    if (!res.ok) throw new Error(`Memories fetch failed: ${res.status}`);
    return res.json();
  }

  /**
   * GET /analytics/summary — analytics overview
   */
  async getAnalyticsSummary() {
    const res = await fetch(`${API_BASE}/analytics/summary`);
    if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`);
    return res.json();
  }

  /**
   * GET /health — backend health check (note: this is at root, not /v1)
   */
  async healthCheck() {
    const res = await fetch('/health');
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  }
}

export const api = new NeurisAPI();
