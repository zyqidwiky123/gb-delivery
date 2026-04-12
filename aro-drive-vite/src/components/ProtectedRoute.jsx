import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isAdmin } = useUserStore();

  if (!user) {
    // Redirect to login if not logged in
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    // Redirect to home if not an admin
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
