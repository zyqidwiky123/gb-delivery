import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useOrderStore } from '../store/orderStore';
import { useAdminStore } from '../store/adminStore';

const Welcome = () => {
  const navigate = useNavigate();
  const { setGuestMode } = useUserStore();
  const { 
    clearCart, clearRoute, clearShopLocations, 
    clearSendLocations, setFoodDelivery 
  } = useOrderStore();
  const { ui } = useAdminStore();
  const welcomeUI = ui.welcome || {
    title: 'ARO DRIVE',
    subtitle: 'Aplikasi layanan serba ada untuk kebutuhan sehari-hari Anda.',
    memberBtn: 'Masuk sbg Member',
    guestBtn: 'Lanjut sbg Guest',
    installBtn: 'Install Aplikasi ARO DRIVE',
    alreadyInstalled: 'Aplikasi Sudah Terpasang'
  };
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
    if (isStandalone) {
      alert("Anda sudah menginstall app ARO DRIVE");
      return;
    }

    if (!deferredPrompt) {
      if (isIOS) {
        alert("Untuk pengguna iOS: Klik tombol Share (kotak panah ke atas) lalu 'Add to Home Screen'");
      } else if (!window.isSecureContext) {
        alert("Instalasi hanya tersedia melalui koneksi aman (HTTPS).");
      } else {
        alert("Browser Anda belum siap untuk instalasi. Pastikan Anda menggunakan Chrome/Edge, tunggu beberapa detik, lalu refresh halaman dan coba lagi.");
        console.log("PWA: deferredPrompt is null. Possible reasons: app already installed, manifest issues, or lack of user engagement.");
      }
      return;
    }
    
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
          <img src="/logo.webp" alt="Aro Drive Logo" className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
          <div className="w-full h-full bg-surface-container rounded-full flex items-center justify-center -mt-32 border-2 border-primary-fixed opacity-20" style={{ zIndex: -1 }}>
             <span className="text-primary-fixed font-bold text-xl">ARO</span>
          </div>
        </div>
        
        <h1 className="text-3xl font-headline font-bold mb-2 text-center">
          Selamat Datang di
        </h1>
        <h2 className="text-4xl font-headline font-black text-primary-fixed mb-4 tracking-wider">
          {welcomeUI.title}
        </h2>
        <p className="text-textSecondary text-center max-w-xs text-sm">
          {welcomeUI.subtitle}
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
          className="w-full bg-primary-fixed text-surface-container-lowest font-bold py-4 px-6 rounded-xl text-lg shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 active:scale-95"
        >
          {welcomeUI.memberBtn}
        </button>

        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-outline-variant"></div>
            <span className="flex-shrink-0 mx-4 text-textSecondary text-xs">{welcomeUI.or}</span>
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
          className="w-full bg-transparent border-2 border-outline/30 text-textPrimary hover:border-primary/50 font-semibold py-4 px-6 rounded-xl text-lg transition-all transform hover:scale-105 active:scale-95 relative overflow-hidden group"
        >
          <span className="relative z-10">{welcomeUI.guestBtn}</span>
          <div className="absolute inset-0 bg-surface-container-high opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </button>

        {/* Install PWA Button - Always Visible */}
        <button 
          onClick={handleInstallClick}
          className="w-full mt-4 flex items-center justify-center gap-2 bg-primary-fixed/10 text-primary-fixed border border-primary-fixed/20 font-bold py-4 px-6 rounded-xl text-sm transition-all transform hover:scale-105 active:scale-95 shadow-lg"
        >
          <Download size={20} className={(!isStandalone && deferredPrompt) ? "animate-bounce" : ""} />
          <span>{isStandalone ? welcomeUI.alreadyInstalled : welcomeUI.installBtn}</span>
        </button>

        {isIOS && !isStandalone && (
          <p className="text-[10px] text-primary-fixed text-center mt-2 px-4 italic">
            Klik tombol Share (kotak panah atas) lalu pilih "Add to Home Screen"
          </p>
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
