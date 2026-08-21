import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui';
import { Recall } from './pages/Recall';
import { Capture } from './pages/Capture';
import { MemorySpace } from './pages/MemorySpace';
import { Timeline } from './pages/Timeline';
import { People } from './pages/People';
import { Insights } from './pages/Insights';
import { Privacy } from './pages/Privacy';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ErrorBoundary>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Recall />} />
              <Route path="/capture" element={<Capture />} />
              <Route path="/space" element={<MemorySpace />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/people" element={<People />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/settings" element={<Settings />} />

              {/* Routes from the previous build, kept so old links still land. */}
              <Route path="/search" element={<Navigate to="/" replace />} />
              <Route path="/memories" element={<Navigate to="/timeline" replace />} />
              <Route path="/analytics" element={<Navigate to="/insights" replace />} />
              <Route path="/index.html" element={<Navigate to="/" replace />} />

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  );
}
