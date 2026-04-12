import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { auth, googleProvider, db } from '../firebase/config';
import { signInWithPopup, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

function Register() {
  const navigate = useNavigate();
  const { login } = useUserStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleRegister = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if user has an existing record
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      let isAdmin = false;
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        isAdmin = adminDoc.exists();
      } catch (adminErr) {
        console.warn("Failed to check admin status for Google user:", adminErr);
      }


      if (userDoc.exists() && userDoc.data().whatsapp) {
        // User exists and has WhatsApp
        login({
          id: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          email: user.email,
          isAdmin: isAdmin
        });
        navigate(isAdmin ? '/admin' : '/member');
      } else {
        // User is new or doesn't have WhatsApp, redirect to complete profile
        navigate('/complete-profile');
      }
    } catch (e) {
      console.error("Error with Google: ", e);
      if (e.code === 'auth/unauthorized-domain') {
        setError('Domain ini belum didaftarkan di Firebase Console. Harap hubungi admin.');
      } else if (e.code === 'auth/popup-closed-by-user') {
        setError('Jendela login ditutup sebelum selesai.');
      } else {
        setError(`Gagal masuk dengan Google (${e.code || 'UNKNOWN'}).`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
      await updateProfile(user, { displayName: name });

      // Save user to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        displayName: name,
        email: email,
        whatsapp: whatsapp,
        photoURL: '',
        createdAt: serverTimestamp()
      });

      // Show alert and redirect to login instead of auto-login
      alert("Pendaftaran berhasil! Silakan login dengan akun Anda.");
      navigate('/login');
    } catch (e) {
      console.error("Error registering: ", e);
      if (e.code === 'auth/email-already-in-use') {
        setError('Email ini sudah terdaftar. Silakan login.');
      } else if (e.code === 'auth/weak-password') {
        setError('Kata sandi terlalu lemah. Gunakan minimal 6 karakter.');
      } else if (e.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else if (e.code === 'auth/operation-not-allowed') {
        setError('Metode login Email belum diaktifkan di Firebase Console.');
      } else {
        setError(`Gagal mendaftar (${e.code || 'UNKNOWN'}). Periksa form anda.`);
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
          onClick={() => navigate('/login', { replace: true })}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-medium text-sm"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Kembali</span>
        </button>

        {/* Background Ambient Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[150px]"></div>

        {/* Brand Anchor Header */}
        <header className="flex flex-col items-center mb-8 z-10 mt-8">
          <div className="bg-surface-container-highest p-4 rounded-xl mb-4 shadow-2xl">
            <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>app_registration</span>
          </div>
          <h1 className="font-headline font-black italic tracking-tighter text-3xl text-primary text-center uppercase">ARO DRIVE</h1>
          <p className="font-label text-on-surface-variant text-[10px] uppercase tracking-[0.2em] mt-1 font-medium">
            Daftar Member Baru
          </p>
        </header>

        {/* Registration Portal Container */}
        <section className="w-full max-w-[400px] z-10">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailRegister} className="space-y-4">
            {/* Input Name */}
            <div className="space-y-1">
              <label className="font-label text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Nama Lengkap</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-md group-focus-within:text-primary transition-colors">badge</span>
                </div>
                <input 
                  required 
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline focus:ring-0 focus:bg-surface-container-high transition-all" 
                  placeholder="Budi Santoso" 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            {/* Input Email */}
            <div className="space-y-1">
              <label className="font-label text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-md group-focus-within:text-primary transition-colors">email</span>
                </div>
                <input 
                  required 
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline focus:ring-0 focus:bg-surface-container-high transition-all" 
                  placeholder="nama@email.com" 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Input WhatsApp */}
            <div className="space-y-1">
              <label className="font-label text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Nomor WhatsApp</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-md group-focus-within:text-primary transition-colors">call</span>
                </div>
                <input 
                  required 
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline focus:ring-0 focus:bg-surface-container-high transition-all" 
                  placeholder="081234567890" 
                  type="tel" 
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
            </div>

            {/* Input Password */}
            <div className="space-y-1">
              <label className="font-label text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Kata Sandi</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-md group-focus-within:text-primary transition-colors">lock</span>
                </div>
                <input 
                  required 
                  minLength={6}
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline focus:ring-0 focus:bg-surface-container-high transition-all" 
                  placeholder="Minimal 6 karakter" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Google Login Divider */}
            <div className="flex items-center gap-4 py-2 opacity-80">
              <div className="h-[1px] flex-1 bg-outline-variant/20"></div>
              <span className="text-[9px] font-black text-outline uppercase tracking-widest">Atau</span>
              <div className="h-[1px] flex-1 bg-outline-variant/20"></div>
            </div>

            {/* Google CTA */}
            <button 
              type="button"
              onClick={handleGoogleRegister}
              disabled={loading}
              className="w-full bg-white text-black font-headline font-bold py-3 rounded-full shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 border border-zinc-200 disabled:opacity-50 text-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google Logo" />
              Daftar dengan Google
            </button>

            {/* CTA Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full mt-2 kinetic-gradient text-on-primary-fixed font-headline font-extrabold py-4 rounded-full text-base shadow-[0_10px_20px_rgba(202,253,0,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:grayscale"
            >
              {loading ? 'MEMPROSES...' : 'DAFTAR SEKARANG'}
              {!loading && <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">person_add</span>}
            </button>
          </form>
        </section>

        {/* Footer Call to Action */}
        <footer className="mt-8 mb-4 z-10 w-full flex flex-col items-center">
          <Link to="/login" className="group flex items-center justify-center gap-2 bg-surface-container-low py-2 px-5 rounded-full border border-outline-variant/10 hover:border-primary/20 transition-all cursor-pointer">
            <span className="text-on-surface-variant font-medium text-xs">Sudah Punya Akun? <span className="text-on-surface font-bold">Login</span></span>
            <div className="bg-primary p-1 rounded-full flex items-center justify-center text-on-primary-fixed group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </div>
          </Link>
        </footer>
      </main>
    </div>
  );
}

export default Register;
