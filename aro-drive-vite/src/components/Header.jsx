import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Sun, Moon } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { useThemeStore } from '../store/themeStore';

const Header = () => {
  const { user, isGuestMode } = useUserStore();
  const { ui } = useAdminStore();
  const { theme, toggleTheme } = useThemeStore();
  const headerUI = ui.header || {
    loginBtn: 'Login / Daftar'
  };
  const navigate = useNavigate();

  // Hide header on certain pages like welcome, login, register
  const hiddenOnPaths = ['/welcome', '/login', '/register', '/ride', '/food', '/send', '/shop'];
  if (hiddenOnPaths.includes(window.location.pathname)) return null;

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-outline/10 p-4 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(user ? '/member' : '/')}>
        <img src="/logo.webp" alt="ARO DRIVE" className="w-8 h-8 object-contain" />
        <span className="font-headline font-black tracking-tighter text-primary text-xl uppercase">ARO DRIVE</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme}
          className="text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center w-8 h-8 rounded-full bg-surface-container border border-outline/20 shadow-sm"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {user ? (
          <button className="relative text-on-surface-variant hover:text-primary transition-colors">
            <Bell size={22} />
            <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full outline outline-2 outline-background"></span>
          </button>
        ) : (
          isGuestMode && (
            <button 
              onClick={() => navigate('/login')}
              className="text-xs font-bold bg-surface-container border border-primary/30 text-primary px-4 py-2 rounded-full hover:bg-primary hover:text-on-primary shadow-lg transition-all"
            >
              {headerUI.loginBtn}
            </button>
          )
        )}
      </div>
    </header>
  );
};

export default Header;
