import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Compass, Clock, User, QrCode } from 'lucide-react';
import { useUserStore } from '../store/userStore';

const Navbar = () => {
  const { user, isGuestMode } = useUserStore();
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
        { path: '/member', icon: <Home size={22} />, label: 'Beranda' },
        { path: '/activity', icon: <Clock size={22} />, label: 'Aktivitas' },
        { path: '/checkout', icon: <QrCode size={24} />, label: 'Pay', isMain: true },
        { path: '/tracking', icon: <Compass size={22} />, label: 'Lacak' },
        { path: '/profile', icon: <User size={22} />, label: 'Akun' },
      ];
    } else if (isGuestMode) {
      return [
        { path: '/', icon: <Home size={22} />, label: 'Beranda' },
        { path: '/tracking', icon: <Compass size={22} />, label: 'Lacak' },
      ];
    }
    return [];
  };

  const navItems = getNavItems();

  if (navItems.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-surface-variant pb-safe">
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
                <div className="bg-primary-fixed text-background w-14 h-14 rounded-full flex items-center justify-center border-4 border-background shadow-[0_0_15px_rgba(202,253,0,0.5)] transform transition-transform hover:scale-105 active:scale-95">
                  {item.icon}
                </div>
                <span className="text-[10px] font-medium text-textPrimary mt-1">{item.label}</span>
              </button>
            );
          }

          return (
            <button 
              key={index}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center w-16 p-2 rounded-xl transition-all ${
                isActive 
                  ? 'text-primary-fixed drop-shadow-[0_0_10px_rgba(202,253,0,0.8)]' 
                  : 'text-textSecondary hover:text-textPrimary hover:bg-surface-container'
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
