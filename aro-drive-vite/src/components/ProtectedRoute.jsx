import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../store/userStore';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isAdmin } = useUserStore();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return children;
};

export default ProtectedRoute;
