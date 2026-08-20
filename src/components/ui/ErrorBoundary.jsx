import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary atrapó un error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: 'var(--bg-primary, #f2f5f9)',
            fontFamily: 'var(--font-body, system-ui, sans-serif)',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.08)',
              border: '1px solid #dbe3ee',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(224, 15, 56, 0.1)',
                color: '#E00F38',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={28} />
            </div>
            <h2
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                color: '#182238',
                marginBottom: '8px',
              }}
            >
              Se presentó un inconveniente visual
            </h2>
            <p
              style={{
                fontSize: '0.9rem',
                color: '#4a5773',
                lineHeight: '1.5',
                marginBottom: '16px',
              }}
            >
              Ocurrió una interrupción al renderizar esta vista. Haz clic a continuación para recargar la aplicación limpiamente.
            </p>

            {this.state.error && (
              <div
                style={{
                  textAlign: 'left',
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '0.78rem',
                  color: '#9f1239',
                  marginBottom: '20px',
                  fontFamily: 'monospace',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <strong>Error: {this.state.error.message}</strong>
                {this.state.error.stack && `\n${this.state.error.stack}`}
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px 22px',
                background: 'linear-gradient(135deg, #1F5BA3 0%, #2C3967 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(31, 91, 163, 0.25)',
              }}
            >
              <RefreshCw size={16} /> Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
