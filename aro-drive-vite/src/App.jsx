import React, { useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Welcome from './pages/Welcome'
import Home from './pages/Home'
import MemberHome from './pages/MemberHome'
import AroFood from './pages/AroFood'
import AroRide from './pages/AroRide'
import AroSend from './pages/AroSend'
import AroShop from './pages/AroShop'
import Activity from './pages/Activity'
import Profile from './pages/Profile'
import EditProfile from './pages/EditProfile'
import Tracking from './pages/Tracking'
import Login from './pages/Login'
import Register from './pages/Register'
import CompleteProfile from './pages/CompleteProfile'
import Checkout from './pages/Checkout'
import LocationPicker from './pages/LocationPicker'
import SavedAddresses from './pages/SavedAddresses'
import DriverHome from './pages/DriverHome'
import DriverOrder from './pages/DriverOrder'
import { useAdminStore } from './store/adminStore'
import { useOrderStore } from './store/orderStore'
import { useUserStore } from './store/userStore'

import ProtectedRoute from './components/ProtectedRoute'
import AdminDashboard from './pages/AdminDashboard'
import AdminOrders from './pages/AdminOrders'
import AdminSettings from './pages/AdminSettings'

import Header from './components/Header'
import Navbar from './components/Navbar'
import PageTransition from './components/PageTransition'

import { requestPermissionAndGetToken, onMessageListener } from './firebase/messagingService';

function App() {
  const { initSettings } = useAdminStore();
  const { initPricing } = useOrderStore();
  const { user, isGuestMode } = useUserStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      requestPermissionAndGetToken(user.id);
      onMessageListener().then(payload => {
        console.log("Notifikasi diterima:", payload);
        // Bisa tambah toast di sini jika mau
        alert(`${payload.notification.title}\n${payload.notification.body}`);
      });
    }
  }, [user]);

  useEffect(() => {
    // Redirect to welcome page if not a guest and not logged in, and not on auth pages
    if (!user && !isGuestMode && !['/welcome', '/login', '/register'].includes(location.pathname)) {
      navigate('/welcome', { replace: true });
    }
    // Redirect logged in user from root or welcome to member home
    if (user && ['/', '/welcome', '/login', '/register'].includes(location.pathname)) {
      navigate('/member', { replace: true });
    }
  }, [user, isGuestMode, location.pathname, navigate]);

  useEffect(() => {
    const unsub1 = initSettings();
    const unsub2 = initPricing();
    return () => {
      unsub1();
      unsub2();
    };
  }, [initSettings, initPricing]);

  const isNavbarHidden = [
    '/welcome', '/login', '/register', '/complete-profile',
    '/ride', '/food', '/send', '/shop', '/checkout', '/tracking', '/location-picker', '/saved-addresses', '/edit-profile'
  ].includes(location.pathname) || location.pathname.startsWith('/admin');

  return (
    <div className={`min-h-screen bg-background text-textPrimary font-sans ${!isNavbarHidden ? 'pb-20' : ''}`}>
      <Header />
      <PageTransition>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/" element={<Home />} />
        <Route path="/member" element={<MemberHome />} />
        <Route path="/food" element={<AroFood />} />
        <Route path="/ride" element={<AroRide />} />
        <Route path="/send" element={<AroSend />} />
        <Route path="/shop" element={<AroShop />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/edit-profile" element={<EditProfile />} />
        <Route path="/tracking" element={<Tracking />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/location-picker" element={<LocationPicker />} />
        <Route path="/saved-addresses" element={<SavedAddresses />} />
        <Route path="/driver" element={<DriverHome />} />
        <Route path="/driver/order/:orderId" element={<DriverOrder />} />
        
        {/* Admin Routes (Secured) */}
        <Route path="/admin" element={
          <ProtectedRoute adminOnly={true}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/orders" element={
          <ProtectedRoute adminOnly={true}>
            <AdminOrders />
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute adminOnly={true}>
            <AdminSettings />
          </ProtectedRoute>
        } />
      </Routes>
      </PageTransition>
      {!isNavbarHidden && <Navbar />}
    </div>
  )
}


export default App
