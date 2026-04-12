import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  // CSS classes for active vs inactive tabs
  const activeClass = "flex flex-col items-center justify-center bg-gradient-to-br from-[#cafd00] to-[#f3ffca] text-black rounded-full p-3 mb-2 scale-110 shadow-[0_0_20px_rgba(243,255,202,0.3)] duration-150 active:scale-90";
  const inactiveClass = "flex flex-col items-center justify-center text-zinc-500 p-2 hover:text-[#f3ffca] transition-colors duration-150 active:scale-90 cursor-pointer";

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
      <div className="max-w-xl mx-auto flex justify-around items-center px-4 pb-6 pt-2 bg-[#0e0e0e]/80 backdrop-blur-2xl rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.4)] pointer-events-auto border-t border-white/5">
        
        {/* Dashboard */}
        <Link to="/" className={currentPath === '/' ? activeClass : inactiveClass}>
          <span className="material-symbols-outlined" style={currentPath === '/' ? { fontVariationSettings: "'FILL' 1" } : {}}>speed</span>
          {currentPath === '/' ? <span className="hidden">DASHBOARD</span> : <span className="font-['Inter'] text-[10px] uppercase tracking-[0.05em] font-bold mt-1">DASHBOARD</span>}
        </Link>
        
        {/* Orders */}
        <Link to="/orders" className={currentPath === '/orders' ? activeClass : inactiveClass}>
          <span className="material-symbols-outlined" style={currentPath === '/orders' ? { fontVariationSettings: "'FILL' 1" } : {}}>local_shipping</span>
          {currentPath === '/orders' ? <span className="hidden">ORDERS</span> : <span className="font-['Inter'] text-[10px] uppercase tracking-[0.05em] font-bold mt-1">ORDERS</span>}
        </Link>
        
        {/* Earnings */}
        <Link to="/wallet" className={currentPath === '/wallet' ? activeClass : inactiveClass}>
          <span className="material-symbols-outlined" style={currentPath === '/wallet' ? { fontVariationSettings: "'FILL' 1" } : {}}>payments</span>
          {currentPath === '/wallet' ? <span className="hidden">EARNINGS</span> : <span className="font-['Inter'] text-[10px] uppercase tracking-[0.05em] font-bold mt-1">EARNINGS</span>}
        </Link>
        
        {/* Profile */}
        <Link to="/profile" className={currentPath === '/profile' ? activeClass : inactiveClass}>
          <span className="material-symbols-outlined" style={currentPath === '/profile' ? { fontVariationSettings: "'FILL' 1" } : {}}>account_circle</span>
          {currentPath === '/profile' ? <span className="hidden">PROFILE</span> : <span className="font-['Inter'] text-[10px] uppercase tracking-[0.05em] font-bold mt-1">PROFILE</span>}
        </Link>
        
      </div>
    </nav>
  );
}

export default BottomNav;
