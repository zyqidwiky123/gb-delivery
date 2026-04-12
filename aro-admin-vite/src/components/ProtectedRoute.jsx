import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';

const ProtectedRoute = ({ children }) => {
  const adminUser = useAdminStore((state) => state.adminUser);
  const authLoading = useAdminStore((state) => state.authLoading);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-[#ccff00]/20 border-t-[#ccff00] rounded-full animate-spin"></div>
        <p className="text-[#f3ffca] font-label text-xs uppercase tracking-[0.3em] font-black animate-pulse">Initializing Terminal...</p>
      </div>
    );
  }

  if (!adminUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
