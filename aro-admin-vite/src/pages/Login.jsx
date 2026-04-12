import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase/config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAdminStore } from '../store/adminStore';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAdminUser = useAdminStore((state) => state.setAdminUser);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 1. Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Check for 'admin' role in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        setAdminUser({ ...user, role: 'admin' });
        navigate('/');
      } else {
        // Fallback: Jika ini email admin khusus dan data belum ada di Firestore
        if (email === 'zyqidwiky@gmail.com') {
          await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            role: 'admin',
            createdAt: new Date().toISOString()
          });
          setAdminUser({ ...user, role: 'admin' });
          navigate('/');
        } else {
          await auth.signOut();
          setError('Akses Ditolak: Akun Anda tidak memiliki hak akses Admin.');
        }
      }
    } catch (err) {
      console.error("Firebase Auth Error:", err);
      
      // Kasus khusus: Jika akun belum ada di Auth, kita coba daftarkan otomatis (hanya untuk email ini)
      if ((err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') && email === 'zyqidwiky@gmail.com') {
        try {
          const newCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = newCredential.user;
          await setDoc(doc(db, 'users', newUser.uid), {
            email: newUser.email,
            role: 'admin',
            createdAt: new Date().toISOString()
          });
          setAdminUser({ ...newUser, role: 'admin' });
          navigate('/');
          return;
        } catch (createErr) {
          console.error("Registry Error:", createErr);
          if (createErr.code === 'auth/operation-not-allowed') {
            setError('Error: Metode Email/Password belum diaktifkan di Firebase Console.');
          } else {
            setError('Gagal membuat akun Admin: ' + createErr.message);
          }
        }
      } else if (err.code === 'auth/invalid-credential') {
        setError('Email atau Password salah.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Metode Login Email/Password belum diaktifkan di Firebase Console.');
      } else {
        setError(`Terjadi Error (${err.code}): ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen flex items-center justify-center overflow-hidden relative w-full">
      {/* Abstract Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-pattern opacity-40"></div>
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px]"></div>
        {/* Abstract "Neon Nocturne" Map Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <path d="M-100 200 L400 600 L1200 100" fill="none" stroke="#f3ffca" strokeWidth="2" />
          <path d="M1400 800 L800 400 L200 900" fill="none" stroke="#f3ffca" strokeWidth="1" />
          <circle cx="400" cy="600" fill="#f3ffca" r="4" />
          <circle cx="800" cy="400" fill="#f3ffca" r="4" />
        </svg>
      </div>

      {/* Login Container */}
      <main className="relative z-10 w-full max-w-md px-6">
        {/* Brand Identity */}
        <div className="text-center mb-12">
          <h1 className="font-headline font-black text-4xl tracking-tighter text-primary-container mb-2 text-[#f3ffca]">ARO DRIVE</h1>
          <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">
            SUPER ADMIN DASHBOARD
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface-container-low rounded-xl p-8 shadow-2xl backdrop-blur-md border border-white/5 neon-glow-primary">
          <div className="mb-8">
            <h2 className="font-headline font-bold text-2xl text-on-surface">Admin Terminal</h2>
            <p className="text-on-surface-variant text-sm mt-1">Authorized access only.</p>
          </div>

          <form 
            className="space-y-6" 
            onSubmit={handleLogin}
          >
            {error && (
              <div className="bg-error/10 text-error p-3 rounded-lg text-xs font-bold border border-error/20 animate-pulse">
                {error}
              </div>
            )}

            {/* Username/Email Field */}
            <div className="space-y-2">
              <label className="font-label text-xs uppercase tracking-wider text-on-surface-variant block ml-1" htmlFor="identifier">
                Email Address
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
                  alternate_email
                </span>
                <input 
                  className="w-full bg-[#1e1e1e] border-none rounded-lg py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary transition-all duration-300" 
                  id="identifier" 
                  placeholder="admin@arodrive.id" 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="font-label text-xs uppercase tracking-wider text-on-surface-variant block" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
                  lock
                </span>
                <input 
                  className="w-full bg-[#1e1e1e] border-none rounded-lg py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary transition-all duration-300" 
                  id="password" 
                  placeholder="••••••••••••" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* CTA Button */}
            <button 
              disabled={isLoading}
              className={`w-full bg-gradient-to-br from-[#ccff00] to-[#f3ffca] text-black font-headline font-extrabold text-sm tracking-widest py-5 rounded-full shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              type="submit"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin w-4 h-4 border-2 border-black/20 border-t-black rounded-full"></span>
                  AUTHENTICATING...
                </>
              ) : (
                'SECURE LOGIN'
              )}
            </button>
          </form>

          {/* Security Footer */}
          <div className="mt-8 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] text-on-surface-variant uppercase tracking-widest">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              End-to-End Encrypted Terminal
            </div>
            <div className="flex gap-6">
              <div className="h-10 w-10 bg-surface-container-highest rounded-full flex items-center justify-center hover:bg-surface-container-high cursor-pointer transition-colors" title="Biometric Unlock">
                <span className="material-symbols-outlined text-on-surface-variant">fingerprint</span>
              </div>
              <div className="h-10 w-10 bg-surface-container-highest rounded-full flex items-center justify-center hover:bg-surface-container-high cursor-pointer transition-colors" title="Hardware Token">
                <span className="material-symbols-outlined text-on-surface-variant">key</span>
              </div>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8 flex justify-center items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">System Online</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-outline-variant"></div>
          <span className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">v4.2.0-Stable</span>
        </div>
      </main>

      {/* Visual Polish: Floating Element */}
      <div className="fixed top-12 right-12 hidden lg:block opacity-20 pointer-events-none">
        <div className="p-4 border border-primary/20 rounded-xl bg-surface-container-low/40 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-xs">location_on</span>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 w-16 bg-primary/30 rounded-full"></div>
              <div className="h-1.5 w-10 bg-primary/10 rounded-full"></div>
            </div>
          </div>
          <div className="h-20 w-32 bg-surface-container-highest rounded-lg overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent"></div>
            <div className="absolute top-4 left-4 w-1 h-1 bg-primary rounded-full animate-pulse"></div>
            <div className="absolute top-10 left-16 w-1 h-1 bg-primary rounded-full"></div>
            <div className="absolute top-14 left-8 w-1 h-1 bg-primary rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
