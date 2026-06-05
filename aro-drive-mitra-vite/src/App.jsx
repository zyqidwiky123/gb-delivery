import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { useMerchantStore } from './store/useMerchantStore';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import Settings from './pages/Settings';
import StoreInfo from './pages/StoreInfo';
import StoreLocation from './pages/StoreLocation';
import PaymentInfo from './pages/PaymentInfo';
import Security from './pages/Security';
import OrderHistory from './pages/OrderHistory';

function App() {
  const { user, setUser, fetchMerchant, isLoading, setLoading } = useMerchantStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchMerchant(currentUser.uid);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setUser, fetchMerchant, setLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Aro Drive Merchant</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/menu" element={user ? <MenuManagement /> : <Navigate to="/login" />} />
      <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
      <Route path="/store-info" element={user ? <StoreInfo /> : <Navigate to="/login" />} />
      <Route path="/store-location" element={user ? <StoreLocation /> : <Navigate to="/login" />} />
      <Route path="/payment-info" element={user ? <PaymentInfo /> : <Navigate to="/login" />} />
      <Route path="/security" element={user ? <Security /> : <Navigate to="/login" />} />
      <Route path="/order-history" element={user ? <OrderHistory /> : <Navigate to="/login" />} />
    </Routes>
  );
}

export default App;
