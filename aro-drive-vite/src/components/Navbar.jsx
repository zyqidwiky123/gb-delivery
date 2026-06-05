import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Compass, Clock, User, QrCode } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';

const Navbar = () => {
  const { user, isGuestMode } = useUserStore();
  const { ui } = useAdminStore();
  
  const headerUI = ui.header || {
    loginBtn: 'Login / Daftar'
  };

  const navUI = ui.nav || {
    beranda: 'Beranda',
    aktivitas: 'Aktivitas',
    pay: 'Pay',
    lacak: 'Lacak',
    akun: 'Akun'
  };

  const navigate = useNavigate();
  const location = useLocation();

  // Hide navbar on certain pages
  const hiddenOnPaths = [
    '/welcome', 
    '/login', 
    '/register', 
    '/complete-profile',
    '/ride', 
    '/food', 
    '/send', 
    '/shop', 
    '/checkout', 
    '/tracking',
    '/admin'
  ];
  const isHidden = hiddenOnPaths.includes(location.pathname) || location.pathname.startsWith('/admin');

  if (isHidden) {
    return null;
  }

  const getNavItems = () => {
    if (user) {
      return [
        { path: '/member', icon: <Home size={22} />, label: navUI.beranda },
        { path: '/activity', icon: <Clock size={22} />, label: navUI.aktivitas },
        { path: '/checkout', icon: <QrCode size={24} />, label: navUI.pay, isMain: true },
        { path: '/tracking', icon: <Compass size={22} />, label: navUI.lacak },
        { path: '/profile', icon: <User size={22} />, label: navUI.akun },
      ];
    } else if (isGuestMode) {
      return [
        { path: '/', icon: <Home size={22} />, label: navUI.beranda },
        { path: '/tracking', icon: <Compass size={22} />, label: navUI.lacak },
      ];
    }
    return [];
  };

  const navItems = getNavItems();

  if (navItems.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-outline/10 pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-end justify-around px-2 py-2">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          
          if (item.isMain) {
            return (
              <button 
                key={index}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center justify-center -mt-6"
              >
                <div className="bg-primary text-on-primary w-14 h-14 rounded-full flex items-center justify-center border-4 border-background shadow-xl transform transition-transform hover:scale-105 active:scale-95">
                  {item.icon}
                </div>
                <span className="text-[10px] font-medium text-on-surface mt-1">{item.label}</span>
              </button>
            );
          }

          return (
            <button 
              key={index}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center w-16 p-2 rounded-xl transition-all ${
                isActive 
                  ? 'text-primary drop-shadow-[0_0_6px_rgba(var(--primary),0.5)]' 
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'
              }`}
            >
              <div className={`mb-1 transition-transform ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navbar;
