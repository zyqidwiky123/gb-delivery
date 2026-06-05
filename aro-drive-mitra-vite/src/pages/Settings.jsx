import React from 'react';
import { useMerchantStore } from '../store/useMerchantStore';
import { ChevronLeft, LogOut, Store, CreditCard, Shield, MapPin, ChevronRight, LayoutDashboard, ShoppingBag, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

function Settings() {
  const { merchant, logout } = useMerchantStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm("Keluar dari akun merchant?")) {
      logout();
      navigate('/login');
    }
  };

  const menuItems = [
    { icon: Store, label: 'Informasi Toko', desc: 'Nama, Deskripsi, Jam Operasional', path: '/store-info' },
    { icon: MapPin, label: 'Alamat & Lokasi', desc: 'Titik Map Pin, Alamat Lengkap', path: '/store-location' },
    { icon: CreditCard, label: 'Pembayaran', desc: 'QRIS, Rekening Bank', path: '/payment-info' },
  ];

  return (
    <div className="min-h-screen bg-dark pb-24">
      <header className="bg-surface/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="text-white/40 hover:text-white transition-colors"><ChevronLeft size={24} /></Link>
          <h2 className="font-headline font-bold text-lg">Pengaturan Toko</h2>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-6">
        {/* Profile Card */}
        <div className="card flex items-center gap-4 bg-gradient-to-br from-primary/10 to-transparent border-primary/10">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-primary/20 bg-primary/20 flex items-center justify-center text-primary shrink-0">
            {merchant?.logoUrl ? (
              <img src={merchant.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Store size={32} />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-headline font-bold text-xl truncate">{merchant?.name || 'Loading...'}</h3>
            <p className="text-sm text-white/40">{merchant?.category || 'Merchant'}</p>
            {merchant?.openTime && merchant?.closeTime && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-white/30">
                <Clock size={10} />
                <span>{merchant.openTime} - {merchant.closeTime}</span>
              </div>
            )}
          </div>
        </div>

        {/* Menu Options */}
        <div className="space-y-3">
          <div className="card p-0 overflow-hidden divide-y divide-white/5">
            {menuItems.map((item) => (
              <Link key={item.path} to={item.path} className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left group">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-primary transition-colors">
                  <item.icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm">{item.label}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">{item.desc}</p>
                </div>
                <ChevronRight size={16} className="text-white/10 group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>

          <div className="card p-0 overflow-hidden divide-y divide-white/5">
            <Link to="/security" className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-colors text-left group">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-primary transition-colors">
                <Shield size={20} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">Keamanan</p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest">Ganti Password</p>
              </div>
              <ChevronRight size={16} className="text-white/10 group-hover:text-primary transition-colors" />
            </Link>
          </div>

          <button onClick={handleLogout} className="w-full card border-red-500/10 hover:border-red-500/30 flex items-center gap-4 p-4 text-red-500 hover:bg-red-500/5 transition-all mt-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center"><LogOut size={20} /></div>
            <p className="font-bold text-sm uppercase tracking-widest">Keluar Akun</p>
          </button>
        </div>

        <p className="text-center text-[10px] text-white/20 uppercase tracking-[0.2em] pt-8">Aro Drive Merchant v2.0.0</p>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-2xl border-t border-white/5 pb-safe z-50">
        <div className="max-w-xl mx-auto flex justify-around p-3">
          <Link to="/" className="flex flex-col items-center gap-1 p-2 text-white/40 hover:text-white transition-colors">
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Beranda</span>
          </Link>
          <Link to="/menu" className="flex flex-col items-center gap-1 p-2 text-white/40 hover:text-white transition-colors">
            <ShoppingBag size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Menu</span>
          </Link>
          <Link to="/settings" className="flex flex-col items-center gap-1 p-2 text-primary">
            <Store size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Toko</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default Settings;
