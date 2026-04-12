import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { auth, googleProvider, db } from '../firebase/config';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function Login() {
  const navigate = useNavigate();
  const { login } = useUserStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user is an admin
      let isAdmin = false;
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        isAdmin = adminDoc.exists();
      } catch (adminErr) {
        console.warn("Failed to check admin status, defaulting to false:", adminErr);
      }

      // Check if user exists in the system with whatsapp
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      console.log("Logged in with Google:", user.email, "Admin:", isAdmin);
      
      if (isAdmin) {
        login({
          id: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
          isAdmin: true
        });
        navigate('/admin');
        return;
      }

      
      if (userDoc.exists() && userDoc.data().whatsapp) {
        const userData = userDoc.data();
        login({
          id: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
          whatsapp: userData.whatsapp,
          isAdmin: false
        });
        // Update other states in store
        useUserStore.setState({ 
          savedAddresses: userData.savedAddresses || [],
          loyaltyPoints: userData.loyaltyPoints || 0
        });
        navigate('/member', { replace: true });
      } else {
        navigate('/complete-profile');
      }
    } catch (e) {
      console.error("Error logging in with Google: ", e);
      if (e.code === 'auth/unauthorized-domain') {
        setError('Domain ini belum didaftarkan di Firebase Console. Harap hubungi admin.');
      } else if (e.code === 'auth/popup-closed-by-user') {
        setError('Jendela login ditutup sebelum selesai.');
      } else {
        setError(`Gagal login dengan Google (${e.code || 'UNKNOWN'}). Silakan coba lagi.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
      // Check if user is an admin
      let isAdmin = false;
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        isAdmin = adminDoc.exists();
      } catch (adminErr) {
        console.warn("Failed to check admin status, defaulting to false:", adminErr);
      }


      login({
        id: user.uid,
        displayName: user.displayName || 'User Aro Drive',
        photoURL: user.photoURL || 'https://via.placeholder.com/150',
        email: user.email,
        isAdmin: isAdmin
      });
      
      console.log("Logged in with Email:", user.email, "Admin:", isAdmin);
      
      if (isAdmin) {
        navigate('/admin');
      } else {
        // Fetch extra data for regular members
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          login({
            id: user.uid,
            displayName: user.displayName || 'User Aro Drive',
            photoURL: user.photoURL || 'https://via.placeholder.com/150',
            email: user.email,
            whatsapp: userData.whatsapp,
            isAdmin: false
          });
          useUserStore.setState({ 
            savedAddresses: userData.savedAddresses || [],
            loyaltyPoints: userData.loyaltyPoints || 0
          });
        }
        navigate('/member', { replace: true });
      }
    } catch (e) {
      console.error("Error logging in with Email: ", e);
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        setError('Email atau Password salah.');
      } else if (e.code === 'auth/too-many-requests') {
        setError('Terlalu banyak percobaan login. Silakan coba lagi nanti.');
      } else {
        setError(`Gagal masuk (${e.code || 'UNKNOWN'}). Periksa koneksi internet Anda.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body selection:bg-primary selection:text-on-primary-fixed min-h-screen">
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate('/welcome', { replace: true })}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-medium text-sm"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Kembali</span>
        </button>

        {/* Background Ambient Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[150px]"></div>

        {/* Brand Anchor Header */}
        <header className="flex flex-col items-center mb-12 z-10">
          <div className="bg-surface-container-highest p-4 rounded-xl mb-6 shadow-2xl">
            <span className="material-symbols-outlined text-primary text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>person_heart</span>
          </div>
          <h1 className="font-headline font-black italic tracking-tighter text-4xl text-primary text-center uppercase">ARO DRIVE</h1>
          <p className="font-label text-on-surface-variant text-[10px] uppercase tracking-[0.2em] mt-2 font-medium">
            Member Portal
          </p>
        </header>

        {/* Login Portal Container */}
        <section className="w-full max-w-[400px] z-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-6">
            {/* Input 1 */}
            <div className="space-y-2">
              <label className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">person</span>
                </div>
                <input 
                  required 
                  className="w-full bg-surface-container-low border-none rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-0 focus:bg-surface-container-high transition-all" 
                  placeholder="name@example.com" 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary transition-all duration-300 group-focus-within:w-full"></div>
              </div>
            </div>

            {/* Input 2 */}
            <div className="space-y-2">
              <label className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Kata Sandi</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">lock</span>
                </div>
                <input 
                  required 
                  className="w-full bg-surface-container-low border-none rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-0 focus:bg-surface-container-high transition-all" 
                  placeholder="••••••••" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="absolute bottom-0 left-0 h-[1px] w-0 bg-primary transition-all duration-300 group-focus-within:w-full"></div>
              </div>
            </div>

            {/* Google Login Divider */}
            <div className="flex items-center gap-4 py-2">
              <div className="h-[1px] flex-1 bg-outline-variant/20"></div>
              <span className="text-[10px] font-black text-outline uppercase tracking-widest">Atau</span>
              <div className="h-[1px] flex-1 bg-outline-variant/20"></div>
            </div>

            {/* Google CTA */}
            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white text-black font-headline font-bold py-4 rounded-full shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 border border-zinc-200 disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google Logo" />
              Lanjutkan dengan Google
            </button>

            {/* CTA Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full kinetic-gradient text-on-primary-fixed font-headline font-extrabold py-5 rounded-full text-lg shadow-[0_20px_40px_rgba(202,253,0,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:grayscale"
            >
              {loading ? 'MEMPROSES...' : 'MASUK (LOGIN)'}
              {!loading && <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>}
            </button>

            {/* Auxiliary Links */}
            <div className="flex items-center justify-between px-2 text-sm font-medium">
              <button type="button" className="text-on-surface-variant hover:text-primary transition-colors">Lupa Kata Sandi?</button>
              <div className="h-1 w-1 bg-outline-variant rounded-full"></div>
              <button type="button" className="text-on-surface-variant hover:text-primary transition-colors">Butuh Bantuan?</button>
            </div>
          </form>
        </section>

        {/* Footer Call to Action */}
        <footer className="mt-auto pt-16 z-10 w-full flex flex-col items-center">
          <button onClick={() => navigate('/register')} className="group flex items-center justify-center gap-3 bg-surface-container-low py-3 px-6 rounded-full border border-outline-variant/10 hover:border-primary/20 transition-all cursor-pointer">
            <span className="text-on-surface-variant font-medium text-sm">Belum Punya Akun? <span className="text-on-surface font-bold">Daftar</span></span>
            <div className="bg-primary p-1 rounded-full flex items-center justify-center text-on-primary-fixed group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </div>
          </button>
          <p className="text-[10px] text-outline text-center mt-12 font-label uppercase tracking-widest opacity-40">
            © 2024 ARO DRIVE BLITAR
          </p>
        </footer>
      </main>
    </div>
  );
}

export default Login;
