import { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import SearchView from './components/SearchView';
import MemoriesView from './components/MemoriesView';
import AnalyticsView from './components/AnalyticsView';

const VIEWS = {
  chat: ChatView,
  search: SearchView,
  memories: MemoriesView,
  analytics: AnalyticsView,
};

export default function App() {
  const [activeView, setActiveView] = useState('chat');
  const ActiveViewComponent = VIEWS[activeView];

  return (
    <>
      {/* Ambient background orbs */}
      <div className="ambient-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="app-shell">
        <Sidebar activeView={activeView} onNavigate={setActiveView} />
        <main className="main-content">
          <ActiveViewComponent />
        </main>
      </div>
    </>
  );
}
