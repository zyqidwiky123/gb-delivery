import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
          <span className="material-symbols-outlined text-6xl text-error mb-4">error_outline</span>
          <h1 className="text-xl font-bold text-on-surface mb-2">Ada yang error, Boss!</h1>
          <p className="text-sm text-on-surface-variant mb-6 max-w-md">
            Aplikasi mengalami masalah. Coba refresh halaman atau hubungi Admin.
          </p>
          <p className="text-xs text-on-surface-variant/60 mb-6 font-mono bg-surface-container p-3 rounded-xl max-w-md break-all">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-black font-bold px-8 py-3 rounded-full shadow-lg active:scale-95 transition-transform"
          >
            Refresh Halaman
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
