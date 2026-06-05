import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark flex flex-col items-center justify-center gap-6 p-6">
          <div className="w-20 h-20 border-4 border-destructive border-t-transparent rounded-full animate-spin"></div>
          <h2 className="text-xl font-bold text-destructive">Terjadi Kesalahan</h2>
          <p className="text-white/60 text-center max-w-md">
            Maaf, ada sesuatu yang tidak berjalan seperti yang diharapkan. Silakan muat ulang halaman ini atau kembali ke beranda.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            Muat Ulang Halaman
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-surface text-white/hover rounded-md hover:bg-surface/80 transition-colors font-medium border border-white/20"
          >
            Kembali ke Beranda
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;