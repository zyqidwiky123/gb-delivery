import React, { useEffect, lazy, Suspense } from 'react'
import { LazyMotion } from 'framer-motion'

const loadFeatures = () => import('./framer-features.js').then(res => res.default)
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'

// Lazy load pages
const Welcome = lazy(() => import('./pages/Welcome'))
const Home = lazy(() => import('./pages/Home'))
const MemberHome = lazy(() => import('./pages/MemberHome'))
const AroFood = lazy(() => import('./pages/AroFood'))
const AroRide = lazy(() => import('./pages/AroRide'))
const AroSend = lazy(() => import('./pages/AroSend'))
const AroSendDetails = lazy(() => import('./pages/AroSendDetails'))
const AroShop = lazy(() => import('./pages/AroShop'))
const Activity = lazy(() => import('./pages/Activity'))
const Profile = lazy(() => import('./pages/Profile'))
const EditProfile = lazy(() => import('./pages/EditProfile'))
const Tracking = lazy(() => import('./pages/Tracking'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'))
const Checkout = lazy(() => import('./pages/Checkout'))
const LocationPicker = lazy(() => import('./pages/LocationPicker'))
const SavedAddresses = lazy(() => import('./pages/SavedAddresses'))
const DriverHome = lazy(() => import('./pages/DriverHome'))
const DriverOrder = lazy(() => import('./pages/DriverOrder'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminOrders = lazy(() => import('./pages/AdminOrders'))
const AdminMerchants = lazy(() => import('./pages/AdminMerchants'))
const AdminSettings = lazy(() => import('./pages/AdminSettings'))

import { useAdminStore } from './store/adminStore'
import { useOrderStore } from './store/orderStore'
import { useUserStore } from './store/userStore'
import { useThemeStore } from './store/themeStore'

import ProtectedRoute from './components/ProtectedRoute'

import Header from './components/Header'
import Navbar from './components/Navbar'
import PageTransition from './components/PageTransition'

import { requestPermissionAndGetToken, onMessageListener } from './firebase/messagingService';

import ChatAdminButton from './components/ChatAdminButton'

function App() {
  const { initSettings } = useAdminStore();
  const { initPricing } = useOrderStore();
  const { user, isGuestMode } = useUserStore();
  const { initTheme } = useThemeStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  useEffect(() => {
    if (user) {
      requestPermissionAndGetToken(user.id);
      const unsubscribe = onMessageListener((payload) => {
        if (payload?.notification) {
          alert(`${payload.notification.title}\n${payload.notification.body}`);
        }
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [user]);

  useEffect(() => {
    // Redirect to welcome page if not a guest and not logged in, and not on auth pages
    if (!user && !isGuestMode && !['/welcome', '/login', '/register', '/complete-profile'].includes(location.pathname)) {
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
    '/ride', '/food', '/send', '/send/details', '/shop', '/checkout', 
    '/tracking', '/location-picker', '/saved-addresses', '/edit-profile'
  ].includes(location.pathname) || location.pathname.startsWith('/admin');

  // Show Chat Admin Button ONLY on Home and MemberHome
  const showChatBtn = ['/', '/member'].includes(location.pathname);

  return (
    <LazyMotion features={loadFeatures} strict>
    <div className={`min-h-screen bg-background text-textPrimary font-sans ${!isNavbarHidden ? 'pb-20' : ''}`}>
      <Header />
      <PageTransition>
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/" element={<Home />} />
        <Route path="/member" element={<MemberHome />} />
        <Route path="/food" element={<AroFood />} />
        <Route path="/ride" element={<AroRide />} />
        <Route path="/send" element={<AroSend />} />
        <Route path="/send/details" element={<AroSendDetails />} />
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
        <Route path="/admin/merchants" element={
          <ProtectedRoute adminOnly={true}>
            <AdminMerchants />
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute adminOnly={true}>
            <AdminSettings />
          </ProtectedRoute>
        } />
      </Routes>
      </Suspense>
      </PageTransition>
      {!isNavbarHidden && <Navbar />}
      {showChatBtn && <ChatAdminButton />}
    </div>
    </LazyMotion>
  )
}


export default App
