import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', color: '#f87171', backgroundColor: '#0f172a', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>Application UI Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', border: '1px solid #ef4444' }}>
            {this.state.error?.toString()}
          </pre>
          {this.state.errorInfo && (
            <pre style={{ whiteSpace: 'pre-wrap', backgroundColor: '#1e293b', padding: '12px', borderRadius: '8px', marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
