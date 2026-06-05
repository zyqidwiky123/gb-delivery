import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <span className="material-symbols-outlined text-red-500 text-6xl mb-4">error</span>
          <h1 className="text-xl font-bold text-on-background mb-2">Oops! Terjadi Kesalahan</h1>
          <p className="text-on-background/50 text-sm mb-6">Aplikasi mengalami kendala teknis.</p>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 w-full text-left overflow-auto max-h-64">
            <p className="text-red-400 font-mono text-xs">{this.state.error && this.state.error.toString()}</p>
            <p className="text-on-background/30 font-mono text-[10px] mt-2 whitespace-pre-wrap">
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-3 bg-primary text-black font-bold rounded-xl"
          >
            Muat Ulang Aplikasi
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
