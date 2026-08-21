import { Component } from 'react';
import { AlertOctagon } from 'lucide-react';

/**
 * Last-resort guard so a render error in one page shows a recoverable screen
 * instead of a blank document.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="page">
        <div className="container container--narrow">
          <div className="card">
            <div className="empty">
              <div className="empty__icon" style={{ color: 'var(--red-500)' }}>
                <AlertOctagon size={20} strokeWidth={1.75} />
              </div>
              <div className="empty__title">Something broke in the interface</div>
              <p className="empty__text">
                {this.state.error?.message || 'An unexpected rendering error occurred.'}
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => window.location.reload()}
              >
                Reload the console
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
