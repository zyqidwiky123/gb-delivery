import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { auth, db } from '../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

function CompleteProfile() {
  const navigate = useNavigate();
  const { login } = useUserStore();
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Determine the currently logged-in user from Firebase Auth
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
    } else {
      // If none, maybe they refreshed or aren't logged in. Redirect to login.
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      // Save data, including WhatsApp, to Firestore using the Google Auth uid
      await setDoc(doc(db, 'users', user.uid), {
        displayName: user.displayName || 'User Aro Drive',
        email: user.email,
        whatsapp: whatsapp,
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp()
      }, { merge: true });

      login({
        id: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
        whatsapp: whatsapp,
        isAdmin: false
      });
      
      navigate('/member');
    } catch (e) {
      console.error("Error saving profile: ", e);
      setError('Gagal menyimpan profil. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body selection:bg-primary selection:text-on-primary-fixed min-h-screen">
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[150px]"></div>

        {/* Header */}
        <header className="flex flex-col items-center mb-8 z-10 mt-8">
          <div className="bg-surface-container-highest p-4 rounded-xl mb-4 shadow-2xl">
            <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>contact_phone</span>
          </div>
          <h1 className="font-headline font-black italic tracking-tighter text-3xl text-primary text-center uppercase">Lengkapi Profil</h1>
          <p className="font-label text-on-surface-variant text-[10px] uppercase tracking-[0.2em] mt-1 font-medium text-center">
            Satu langkah lagi untuk mulai
          </p>
        </header>

        {/* Portal Container */}
        <section className="w-full max-w-[400px] z-10">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-surface-container-low p-4 rounded-xl mb-4 text-sm text-on-surface-variant text-center border border-white/5">
              Hai <strong>{user?.displayName || 'Boss'}</strong>, <br/>
              Silakan masukkan nomor WhatsApp Anda agar kami dapat menghubungi Anda terkait pesanan.
            </div>

            {/* Input WhatsApp */}
            <div className="space-y-1">
              <label className="font-label text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider ml-1">Nomor WhatsApp Aktif</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-md group-focus-within:text-primary transition-colors">call</span>
                </div>
                <input 
                  required 
                  autoFocus
                  className="w-full bg-surface-container-low border-none rounded-xl py-4 pl-12 pr-4 text-sm text-on-surface placeholder:text-outline focus:ring-0 focus:bg-surface-container-high transition-all" 
                  placeholder="081234567890" 
                  type="tel" 
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
            </div>

            {/* CTA Button */}
            <button 
              type="submit"
              disabled={loading || !whatsapp}
              className="w-full mt-4 kinetic-gradient text-on-primary-fixed font-headline font-extrabold py-4 rounded-full text-base shadow-[0_10px_20px_rgba(202,253,0,0.15)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:grayscale"
            >
              {loading ? 'MENYIMPAN...' : 'SELESAI'}
              {!loading && <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">check_circle</span>}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default CompleteProfile;
