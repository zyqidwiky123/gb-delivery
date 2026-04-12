import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';

function Profile() {
  const navigate = useNavigate();
  const { user, loyaltyPoints, redeemVoucher, vouchers, logout } = useUserStore();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  React.useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsStandalone(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Points needed to redeem voucher (default 100 points)
  const pointsToRedeem = 100;

  const handleRedeem = () => {
    if (loyaltyPoints >= pointsToRedeem) {
      redeemVoucher(pointsToRedeem);
      alert("Tukar Poin Berhasil! Voucher Gratis Ongkir sudah masuk ke koleksi Anda.");
    } else {
      alert(`Poin belum cukup, Boss! Butuh ${pointsToRedeem} poin.`);
    }
  };

  const handleCareCenterClick = () => {
    console.log('Chat with Admin...');
    window.location.href = 'https://wa.me/6285748343842?text=Halo%20Admin%20Aro%20Drive,%20saya%20butuh%20bantuan.';
  };

  const handleLogout = () => {
    if (window.confirm('Apakah Anda yakin ingin keluar?')) {
      logout();
      navigate('/welcome');
    }
  };

  return (
    <div className="bg-background min-h-screen pb-40 text-white font-body py-8">
      <main className="max-w-xl mx-auto px-6 space-y-6">
        
        <div className="flex items-center gap-5 p-2 mb-2">
          <div className="relative group">
            <div className="w-16 h-16 rounded-full border-2 border-primary overflow-hidden shadow-lg shadow-primary/10">
              <img 
                src={user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAr5XAajWHWnCVcEoi2VhomU2RRi1oJj14RBhltVEwmTbfEKW_i84dn2BDkUz9qAQj07nsW1VB0znDXOW5qiwlc18aHqhw7Gb53jOgqu22HqidGCHExwD202ID9AIWBaNt6MkzajfHVnmrUTACMJknmlViLwxT-oUuNyAm-gWNyh8y73S-6_JDv5sLo-ZwmgEHwjPyTeaqbJyqf_UDWD4h30dkfYwiVwaVX5dP2bncVn6yn1IfcqPjFpKBz4VY49nkar4KuReEa7jY"} 
                alt="Profile" 
                className="w-full h-full object-cover"
              />
            </div>
            <button 
              onClick={() => navigate('/edit-profile')}
              className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-black rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-xs font-bold">edit</span>
            </button>
          </div>
          <div>
            <h1 className="font-headline font-bold text-lg text-white">{user?.displayName || 'User ARO'}</h1>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{user?.email || 'Bukan Member'}</p>
          </div>
        </div>
        
        {/* Loyalty Points Summary */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-6 rounded-[2rem] border border-primary/20 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-primary text-black w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined font-black">loyalty</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">Loyalty Points</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-headline font-black text-white italic">{loyaltyPoints}</span>
                  <span className="text-xs font-bold text-primary">PTS</span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Tingkat: {loyaltyPoints > 500 ? 'Platinum' : loyaltyPoints > 100 ? 'Gold' : 'Basic'}</span>
            </div>
          </div>

          <div className="space-y-4">
             <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-primary h-full transition-all duration-700" 
                  style={{
                    width: `${Math.min((loyaltyPoints / pointsToRedeem) * 100, 100)}%`,
                    boxShadow: '0 0 10px #cafd00'
                  }}
                ></div>
             </div>
             <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-on-surface-variant italic">
                  {loyaltyPoints >= pointsToRedeem 
                    ? 'Poin sudah cukup! Tukar sekarang.' 
                    : `${pointsToRedeem - loyaltyPoints} pts lagi untuk tukar Voucher`}
                </p>
                <button 
                  onClick={handleRedeem}
                  disabled={loyaltyPoints < pointsToRedeem}
                  className={`px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg transition-all ${loyaltyPoints >= pointsToRedeem ? 'bg-primary text-black shadow-primary/20 active:scale-95' : 'bg-white/10 text-on-surface-variant grayscale cursor-not-allowed'}`}
                >
                  Tukar Poin
                </button>
             </div>
          </div>
        </div>

        {/* Voucher Collection Row */}
        {vouchers.length > 0 && (
          <div className="px-2">
             <h2 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
               <span className="material-symbols-outlined text-sm">confirmation_number</span>
               Voucher Saya ({vouchers.length})
             </h2>
             <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {vouchers.map(v => (
                  <div key={v.id} className="flex-shrink-0 bg-surface-container-high border border-white/5 p-4 rounded-2xl flex items-center gap-4 w-48 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-primary/5 rounded-full -mr-6 -mt-6"></div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                      <span className="material-symbols-outlined text-sm">local_shipping</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white uppercase tracking-tighter">{v.title}</p>
                      <p className="text-[9px] text-[#f3ffca] font-bold">Berlaku Se-Blitar</p>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Account Menus */}
        <section className="space-y-3">
          <h2 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-2 mb-2">My Account</h2>
          
          <div className="bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden">
            <div 
              onClick={() => navigate('/saved-addresses')}
              className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-primary">home_pin</span>
                <span className="font-semibold text-sm">Alamat Tersimpan</span>
              </div>
              <span className="material-symbols-outlined text-outline text-sm">chevron_right</span>
            </div>
            
            <div className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-surface-container-highest transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-secondary">payments</span>
                <span className="font-semibold text-sm">Metode Pembayaran</span>
              </div>
              <span className="material-symbols-outlined text-outline text-sm">chevron_right</span>
            </div>

            <div 
              onClick={() => navigate('/edit-profile')}
              className="flex items-center justify-between p-4 hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-primary">manage_accounts</span>
                <span className="font-semibold text-sm">Pengaturan Akun</span>
              </div>
              <span className="material-symbols-outlined text-outline text-sm">chevron_right</span>
            </div>
          </div>
        </section>

        {/* Support & Settings */}
        <section className="space-y-3">
          <h2 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-2 mb-2">Help & Settings</h2>
          
          <div className="bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden">
            {/* CARE CENTER - Call To Action */}
            <div 
              onClick={handleCareCenterClick}
              className="flex items-center justify-between p-5 border-b border-white/5 hover:bg-[#262626] transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <span className="material-symbols-outlined text-primary">support_agent</span>
                </div>
                <div>
                  <span className="block font-bold text-sm text-primary mb-0.5">CARE CENTER</span>
                  <span className="block text-xs text-on-surface-variant">Hubungi Admin (WhatsApp)</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">open_in_new</span>
            </div>

            <div 
              onClick={handleLogout}
              className="flex items-center justify-between p-5 hover:bg-surface-container-highest transition-colors cursor-pointer text-error"
            >  
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined">logout</span>
                <span className="font-bold text-sm">Keluar (Log Out)</span>
              </div>
            </div>
          </div>

          {/* PWA Install Option in Profile */}
          {!isStandalone && (
            <div className="mt-4">
              {deferredPrompt ? (
                <button 
                  onClick={handleInstallClick}
                  className="w-full flex items-center justify-between p-5 bg-primary/10 border border-primary/20 rounded-2xl hover:bg-primary/20 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary animate-bounce">download_for_offline</span>
                    </div>
                    <div className="text-left">
                      <span className="block font-bold text-sm text-primary">Install Aplikasi</span>
                      <span className="block text-[10px] text-primary/70">Akses lebih cepat & offline</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-primary">chevron_right</span>
                </button>
              ) : isIOS ? (
                <div className="p-5 bg-surface-container-low border border-white/5 rounded-2xl">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2 text-center">Install di iPhone</p>
                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-textSecondary">
                    <span>Klik</span>
                    <span className="bg-white/10 p-1 rounded">
                      <svg width="16" height="16" viewBox="0 0 50 50" fill="currentColor" className="inline"><path d="M30.3,13.7L25,8.4l-5.3,5.3l-1.4-1.4L25,5.6l6.7,6.7L30.3,13.7z M24,30.3V10.7h2v19.7H24z M13,19h8v2h-8v21h24V21h-8v-2h8 c1.1,0,2,0.9,2,2v21c0,1.1-0.9,2-2,2H13c-1.1,0-2-0.9-2-2V21C11,19.9,11.9,19,13,19z"/></svg>
                    </span>
                    <span>lalu "Add to Home Screen"</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

export default Profile;
