import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { auth } from './firebase/config'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { useDriverStore } from './store/useDriverStore'
import { getDriverProfile } from './firebase/driverService'

import Home from './pages/Home'
import Login from './pages/Login'
import Wallet from './pages/Wallet'
import Profile from './pages/Profile'
import EditProfile from './pages/EditProfile'
import Orders from './pages/Orders'
import BottomNav from './components/BottomNav'

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

import { requestPermissionAndGetToken, onMessageListener } from './firebase/messagingService';

function App() {
  const { setUser, setProfile, setLoading, user, profile, clearData } = useDriverStore();
  const navigate = useNavigate();
  const logoutTimerRef = useRef(null);

  useEffect(() => {
    if (user) {
      requestPermissionAndGetToken(user.uid);
      onMessageListener().then(payload => {
        console.log("Driver: Notifikasi diterima:", payload);
        // Alert will show up, and sound is played inside onMessageListener
        alert(`${payload.notification.title}\n${payload.notification.body}`);
      });
    }
  }, [user]);

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
          const profileData = await getDriverProfile(currentUser.uid);
          if (profileData) {
            setUser(currentUser);
            setProfile(profileData);
          } else {
            // If logged in but no driver profile found, it's likely a non-driver account
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
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        {/* Catch-all route to redirect back to home/login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {/* Show BottomNav only if user is logged in */}
      {user && <BottomNav />}
    </div>
  )
}

export default App
