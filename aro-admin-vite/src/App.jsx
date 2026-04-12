import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { auth, db } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useAdminStore } from './store/adminStore';

function App() {
  const setAdminUser = useAdminStore((state) => state.setAdminUser);
  const setAuthLoading = useAdminStore((state) => state.setAuthLoading);

  useEffect(() => {
    // Diagnostic connection check
    const checkConnection = async () => {
      try {
        console.log("Memulai diagnostik koneksi Firebase...");
        const testDoc = await getDoc(doc(db, 'system', 'connection_test'));
        console.log("Firebase Terhubung! (Status Firestore: OK)");
      } catch (err) {
        if (err.code === 'permission-denied') {
          console.log("Firebase Terhubung! (Status Firestore: Terdeteksi tapi akses ditolak - ini normal jika belum login)");
        } else {
          console.error("Firebase Connection Error:", err.code, err.message);
        }
      }
    };
    checkConnection();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Verify role before setting admin user
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().role === 'admin') {
            setAdminUser({ ...user, role: 'admin' });
          } else {
            setAdminUser(null);
          }
        } catch (error) {
          console.error("Error fetching admin role:", error);
          setAdminUser(null);
        }
      } else {
        setAdminUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [setAdminUser, setAuthLoading]);

  return (
    <div className="min-h-screen bg-background text-textPrimary font-sans">
      <Routes>
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="/login" element={<Login />} />
      </Routes>
    </div>
  );
}

export default App;
