import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useOrderStore } from '../store/orderStore';

const Welcome = () => {
  const navigate = useNavigate();
  const { setGuestMode } = useUserStore();
  const { 
    clearCart, clearRoute, clearShopLocations, 
    clearSendLocations, setFoodDelivery 
  } = useOrderStore();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
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

  // Reset guest mode and order data when on welcome page to ensure a fresh start
  useEffect(() => {
    setGuestMode(false);
    clearCart();
    clearRoute();
    clearShopLocations();
    clearSendLocations();
    setFoodDelivery(null);
  }, [setGuestMode, clearCart, clearRoute, clearShopLocations, clearSendLocations, setFoodDelivery]);

  return (
    <div className="min-h-screen bg-background text-textPrimary flex flex-col items-center justify-center p-6 font-sans">
      
      {/* Logo & Greetings */}
      <div className="flex flex-col items-center mb-12">
        <div className="w-32 h-32 mb-6 transition-transform hover:scale-105 duration-300">
          {/* User has provided the logo, assuming it will be saved as logo.png in the public folder */}
          <img src="/logo.png" alt="Aro Drive Logo" className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
          {/* Fallback box if image is not there yet */}
          <div className="w-full h-full bg-surface-container rounded-full flex items-center justify-center -mt-32 border-2 border-primary-fixed opacity-20" style={{ zIndex: -1 }}>
             <span className="text-primary-fixed font-bold text-xl">ARO</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-headline font-bold mb-2 text-center">
          Selamat Datang di
        </h1>
        <h2 className="text-4xl font-headline font-black text-primary-fixed mb-4 tracking-wider">
          ARO DRIVE
        </h2>
        <p className="text-textSecondary text-center max-w-xs text-sm">
          Aplikasi layanan serba ada untuk kebutuhan sehari-hari Anda.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="w-full max-w-sm space-y-4">
        <p className="text-center text-sm mb-4 font-medium text-textSecondary uppercase tracking-widest">
          Pilih cara masuk Anda:
        </p>

        {/* Member Button */}
        <button 
          onClick={() => navigate('/login', { replace: true })}
          className="w-full bg-primary-fixed text-surface-container-lowest font-bold py-4 px-6 rounded-xl text-lg shadow-[0_0_15px_rgba(202,253,0,0.4)] hover:shadow-[0_0_25px_rgba(202,253,0,0.6)] transition-all transform hover:scale-105 active:scale-95"
        >
          Masuk sbg Member
        </button>

        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-outline-variant"></div>
            <span className="flex-shrink-0 mx-4 text-textSecondary text-xs">ATAU</span>
            <div className="flex-grow border-t border-outline-variant"></div>
        </div>

        {/* Guest Button */}
        <button 
          onClick={() => {
            // Fresh Guest Session
            clearCart();
            clearRoute();
            clearShopLocations();
            clearSendLocations();
            setFoodDelivery(null);
            
            setGuestMode(true);
            navigate('/', { replace: true });
          }}
          className="w-full bg-transparent border-2 border-outline text-textPrimary hover:border-textPrimary font-semibold py-4 px-6 rounded-xl text-lg transition-all transform hover:scale-105 active:scale-95 relative overflow-hidden group"
        >
          <span className="relative z-10">Lanjut sbg Guest</span>
          <div className="absolute inset-0 bg-surface-container-high opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </button>

        {/* Install PWA Button */}
        {!isStandalone && (
          <>
            {deferredPrompt ? (
              <button 
                onClick={handleInstallClick}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-primary-fixed/10 text-primary-fixed border border-primary-fixed/30 font-bold py-4 px-6 rounded-xl text-sm transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_10px_rgba(202,253,0,0.2)]"
              >
                <Download size={20} className="animate-bounce" />
                <span>Install Aplikasi ARO DRIVE</span>
              </button>
            ) : isIOS ? (
              <div className="w-full mt-4 p-4 bg-surface-container-high rounded-xl border border-outline-variant text-center">
                <p className="text-xs text-textSecondary mb-2">
                  Untuk menginstall di iPhone/iPad:
                </p>
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-primary-fixed">
                  <span>Klik tombol</span>
                  <span className="bg-white/10 p-1 rounded">
                    <svg width="20" height="20" viewBox="0 0 50 50" fill="currentColor"><path d="M30.3,13.7L25,8.4l-5.3,5.3l-1.4-1.4L25,5.6l6.7,6.7L30.3,13.7z M24,30.3V10.7h2v19.7H24z M13,19h8v2h-8v21h24V21h-8v-2h8 c1.1,0,2,0.9,2,2v21c0,1.1-0.9,2-2,2H13c-1.1,0-2-0.9-2-2V21C11,19.9,11.9,19,13,19z"/></svg>
                  </span>
                  <span>lalu pilih "Add to Home Screen"</span>
                </div>
              </div>
            ) : (
              /* Fallback message if prompt not supported yet */
              <p className="text-[10px] text-textSecondary text-center mt-2 px-4 italic">
                Gunakan Chrome/Edge untuk pengalaman terbaik dan kemudahan instalasi.
              </p>
            )}
          </>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-auto pt-10 pb-4 text-center">
        <p className="text-xs text-textSecondary px-8 leading-relaxed">
          <span className="text-error">*</span> Guest memiliki akses fitur yang sangat terbatas dan tidak dapat mengumpulkan poin loyalitas.
        </p>
      </div>

    </div>
  );
};

export default Welcome;
