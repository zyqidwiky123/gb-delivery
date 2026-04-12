import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useUserStore } from '../store/userStore';

const Header = () => {
  const { user, isGuestMode } = useUserStore();
  const navigate = useNavigate();

  // Hide header on certain pages like welcome, login, register
  const hiddenOnPaths = ['/welcome', '/login', '/register', '/ride', '/food', '/send', '/shop', '/driver'];
  if (hiddenOnPaths.includes(window.location.pathname) || window.location.pathname.startsWith('/driver')) return null;

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-surface-variant p-4 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(user ? '/member' : '/')}>
        <img src="/logo.png" alt="ARO DRIVE" className="w-8 h-8 object-contain" />
        <span className="font-headline font-black italic tracking-tighter text-primary text-xl uppercase">ARO DRIVE</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {user ? (
          <button className="relative text-textSecondary hover:text-primary-fixed transition-colors">
            <Bell size={22} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full outline outline-2 outline-background"></span>
          </button>
        ) : (
          isGuestMode && (
            <button 
              onClick={() => navigate('/login')}
              className="text-xs font-bold bg-surface-container border border-primary-fixed text-primary-fixed px-4 py-2 rounded-full hover:bg-primary-fixed hover:text-background shadow-[0_0_10px_rgba(202,253,0,0.3)] transition-all"
            >
              Login / Daftar
            </button>
          )
        )}
      </div>
    </header>
  );
};

export default Header;
