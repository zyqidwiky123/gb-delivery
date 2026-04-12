import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getDriverProfile, createDriverProfile } from '../firebase/driverService';
import { useDriverStore } from '../store/useDriverStore';
import { db } from '../firebase/config';
import { doc, setDoc } from 'firebase/firestore';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const handleAuth = async (e) => {
    e?.preventDefault();
    if (!email || !password) {
      setErrorMsg("Harap masukkan email dan kata sandi.");
      return;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      // Attempt login
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (authError) {
        // If user not found, auto-provision
        if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } else {
          throw authError; // rethrow other errors
        }
      }

      const user = userCredential.user;
      
      // Ensure profile exists
      let profile = await getDriverProfile(user.uid);
      if (!profile) {
        profile = await createDriverProfile(user.uid, user.email);
      } else {
        // Ensure role is still set in 'users' collection even for existing drivers
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { role: 'driver' }, { merge: true });
      }
      
      // We don't setStore here, App.jsx's onAuthStateChanged will handle it
      navigate('/');
    } catch (err) {
      console.error(err);
      setErrorMsg("Akses ditolak: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body selection:bg-primary selection:text-on-primary-fixed min-h-screen">
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[150px]"></div>

        {/* Brand Anchor Header */}
        <header className="flex flex-col items-center mb-12 z-10">
          <div className="bg-surface-container-highest p-4 rounded-xl mb-6 shadow-2xl">
            <span className="material-symbols-outlined text-primary text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>delivery_dining</span>
          </div>
          <h1 className="font-headline font-black italic tracking-tighter text-4xl text-primary text-center">ARO DRIVE</h1>
          <p className="font-label text-on-surface-variant text-[10px] uppercase tracking-[0.2em] mt-2 font-medium">
            Portal Pengemudi
          </p>
        </header>

        {/* Login Portal Container */}
        <section className="w-full max-w-[400px] z-10">
          <div className="space-y-6">
            <form onSubmit={handleAuth} className="space-y-6">
              {errorMsg && (
                <div className="bg-error/10 border border-error text-error text-xs p-3 rounded-lg text-center font-bold">
                  {errorMsg}
                </div>
              )}
            
              {/* Input 1 */}
              <div className="space-y-2">
                <label className="font-label text-xs font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Email Mitra</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-outline text-lg group-focus-within:text-primary transition-colors">person</span>
                  </div>
                  <input 
                    className="w-full bg-surface-container-low border-none rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-0 focus:bg-surface-container-high transition-all" 
                    placeholder="Masukkan email Anda" 
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
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
                    className="w-full bg-surface-container-low border-none rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-outline focus:ring-0 focus:bg-surface-container-high transition-all" 
                    placeholder="••••••••" 
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
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
              onClick={() => navigate('/')}
              className="w-full bg-white text-black font-headline font-bold py-4 rounded-full shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 border border-zinc-200"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google Logo" />
              Lanjutkan dengan Google
            </button>

            {/* CTA Button */}
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full kinetic-gradient text-on-primary-fixed font-headline font-extrabold py-5 rounded-full text-lg shadow-[0_20px_40px_rgba(202,253,0,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {isLoading ? "MEMPROSES..." : "MASUK (LOGIN)"}
              {!isLoading && <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>}
            </button>
            </form>
          </div>
        </section>

        {/* Footer Call to Action */}
        <footer className="mt-auto pt-16 z-10 w-full flex flex-col items-center">
          <a className="group flex items-center justify-center gap-3 bg-surface-container-low py-3 px-6 rounded-full border border-outline-variant/10 hover:border-primary/20 transition-all cursor-pointer" href="#">
            <span className="text-on-surface-variant font-medium text-sm">Belum Gabung? <span className="text-on-surface font-bold">Daftar</span></span>
            <div className="bg-primary p-1 rounded-full flex items-center justify-center text-on-primary-fixed group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </div>
          </a>
          <p className="text-[10px] text-outline text-center mt-12 font-label uppercase tracking-widest opacity-40">
            © 2024 NEON NOCTURNE DELIVERY
          </p>
        </footer>

        {/* Decorative Elements for Midnight Aesthetic */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-10 right-10 w-24 h-24 border border-outline-variant/20 rounded-full flex items-center justify-center opacity-20">
            <div className="w-16 h-16 border border-outline-variant/20 rounded-full"></div>
          </div>
          <div className="absolute bottom-1/4 left-5 opacity-10">
            <div className="w-[1px] h-32 bg-gradient-to-b from-transparent via-primary to-transparent"></div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Login;
