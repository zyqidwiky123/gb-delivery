import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { auth, db } from './firebase/config'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { useDriverStore } from './store/useDriverStore'
import { getDriverProfile, observeDriverProfile, updateDriverStatus } from './firebase/driverService'

import Home from './pages/Home'
import Login from './pages/Login'
import Wallet from './pages/Wallet'
import Profile from './pages/Profile'
import Account from './pages/Account'
import EditProfile from './pages/EditProfile'
import Orders from './pages/Orders'
import BottomNav from './components/BottomNav'

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, profile, isLoading } = useDriverStore();
  
  if (isLoading) return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center gap-4">
      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 animate-bounce">
         <span className="material-symbols-outlined text-primary text-3xl">delivery_dining</span>
      </div>
      <div className="flex flex-col items-center">
        <h1 className="text-white font-headline font-black italic tracking-tighter text-xl">ARO DRIVE</h1>
        <div className="w-32 h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-primary animate-[loading_1.5s_infinite]"></div>
        </div>
      </div>
    </div>
  );

  if (!user || !profile) return <Navigate to="/login" replace />;
  return children;
};

// Public Route Component (redirect to home if logged in)
const PublicRoute = ({ children }) => {
  const { user, isLoading } = useDriverStore();
  if (isLoading) return <div className="min-h-screen bg-background flex justify-center items-center"><span className="text-primary font-bold animate-pulse">MEMUAT...</span></div>;
  if (user) return <Navigate to="/" replace />;
  return children;
};

import { requestPermissionAndGetToken, registerOnMessageListener } from './firebase/messagingService';

function App() {
  const { setUser, setProfile, setLoading, user, profile, clearData } = useDriverStore();
  const navigate = useNavigate();
  const logoutTimerRef = useRef(null);
  const autoOfflineHandledRef = useRef(null);

  useEffect(() => {
    if (user) {
      requestPermissionAndGetToken(user.uid);
      const unsubscribeMessaging = registerOnMessageListener((payload) => {
        console.log("Driver: Notifikasi diterima:", payload);
        alert(`${payload.notification.title}\n${payload.notification.body}`);
      });
      return () => unsubscribeMessaging();
    }
  }, [user]);

  // Periodic watcher: cek inactivity (2 jam) + daily limit (12 jam)
  useEffect(() => {
    if (!user?.uid || !profile?.isOnline) {
      autoOfflineHandledRef.current = null;
      return;
    }

    const interval = setInterval(async () => {
      try {
        const freshProfile = await getDriverProfile(user.uid);
        if (!freshProfile || !freshProfile.isOnline) return;

        const now = Date.now();

        // Inactivity check (>2 jam tanpa lastActive)
        const lastActive = toMillis(freshProfile.lastActive)
          || toMillis(freshProfile.lastLocationUpdate)
          || toMillis(freshProfile.updatedAt);
        if (lastActive && (now - lastActive) > 2 * 60 * 60 * 1000) {
          await updateDriverStatus(user.uid, false);
          alert("Kamu otomatis offline karena tidak ada aktivitas selama 2 jam.");
          return;
        }

        // Daily limit check (>=12 jam hari ini)
        if ((freshProfile.todayOnlineMs || 0) >= 12 * 60 * 60 * 1000) {
          await updateDriverStatus(user.uid, false);
          alert("Batas online 12 jam hari ini sudah tercapai. Silakan lanjut besok!");
          return;
        }
      } catch (err) {
        console.error("Gagal cek status driver:", err);
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [user?.uid, profile?.isOnline]);

  // Real-time Profile Listener
  useEffect(() => {
    let unsubscribeProfile = () => {};
    
    if (user?.uid) {
      unsubscribeProfile = observeDriverProfile(user.uid, (data) => {
        if (data) {
          setProfile(data);
        } else {
          // Jika profil tidak ada (kemungkinan akun didelete), paksa logout
          signOut(auth);
          clearData();
          navigate('/login');
        }
      });
    }

    return () => unsubscribeProfile();
  }, [user?.uid, setProfile, clearData, navigate]);

  // Auto-logout if OFFLINE for 10 minutes
  useEffect(() => {
    if (user && profile && profile.isOnline === false) {
      console.log("Status OFFLINE terdeteksi. Memulai perhitungan mundur 10 menit untuk logout otomatis...");
      
      // Clear existing timer if any
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      
      // Set new timer (10 minutes = 600,000 ms)
      logoutTimerRef.current = setTimeout(async () => {
        console.log("Batas waktu 10 menit tercapai. Otomatis logout...");
        await signOut(auth);
        clearData();
        alert("Sesi berakhir: Anda otomatis keluar karena status OFFLINE lebih dari 10 menit.");
        navigate('/login');
      }, 10 * 60 * 1000); 

    } else {
      // If user goes ONLINE or logs out manually, clear the timer
      if (logoutTimerRef.current) {
        console.log("Status ONLINE atau Sesi Berakhir. Membatalkan logout otomatis.");
        clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
    }

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [user, profile?.isOnline, clearData, navigate]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        try {
          // Load profile once at start to verify identity
          const profileData = await getDriverProfile(currentUser.uid);
          if (profileData) {
            setUser(currentUser);
            setProfile(profileData);

            // Proactively ensure their role is set in both 'users' and 'drivers'
            try {
              const userRef = doc(db, 'users', currentUser.uid);
              await setDoc(userRef, { role: 'driver' }, { merge: true });
              
              if (profileData.role !== 'driver') {
                const driverRef = doc(db, 'drivers', currentUser.uid);
                await setDoc(driverRef, { role: 'driver' }, { merge: true });
              }
            } catch (roleErr) {
              console.warn("Gagal sinkronisasi role di database:", roleErr);
            }
          } else {
            console.warn("Akses ditolak: Akun bukan mitra driver.");
            await signOut(auth);
            setUser(null);
            setProfile(null);
          }
        } catch (err) {
          console.error("Auth sync error:", err);
          setUser(null);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setProfile, setLoading]);

  return (
    <div className="min-h-screen bg-background text-textPrimary font-sans relative">
      <Routes>
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
        {/* Catch-all route to redirect back to home/login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Show BottomNav only if user is logged in */}
      {user && <BottomNav />}
    </div>
  )
}

export default App
