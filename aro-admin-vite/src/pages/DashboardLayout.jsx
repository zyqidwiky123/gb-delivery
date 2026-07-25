import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const menuItems = [
  { id: 'Overview', icon: 'dashboard', label: 'Overview' },
  { id: 'Drivers', icon: 'local_shipping', label: 'Drivers' },
  { id: 'Users', icon: 'group', label: 'Users' },
  { id: 'Food', icon: 'restaurant', label: 'Kelola Merchant' },
  { id: 'Transactions', icon: 'payments', label: 'Transactions' },
  { id: 'Topups', icon: 'account_balance_wallet', label: 'Topups' },
  { id: 'Banners', icon: 'ads_click', label: 'Banners' },
  { id: 'Promos', icon: 'loyalty', label: 'Promos' },
  { id: 'Tarif', icon: 'sell', label: 'Tarif' },
  { id: 'Settings', icon: 'settings', label: 'Settings' },
];

function DashboardLayout({ activeTab, setActiveTab, children }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const navigate = useNavigate();

  return (
    <div className="bg-background text-on-surface antialiased overflow-x-hidden min-h-screen relative">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      <aside className={`h-screen w-64 fixed left-0 top-0 flex flex-col bg-[#0e0e0e] border-r border-white/5 z-50 transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex flex-col h-full py-6">
          <div className="px-6 mb-10">
            <h1 className="text-2xl font-black text-[#f3ffca] tracking-tighter font-headline">Aro Drive</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-medium mt-1">Admin Terminal</p>
          </div>
          <nav className="flex-1 space-y-1">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-6 py-3 transition-all duration-200 active:scale-95 ${
                  activeTab === item.id
                    ? 'text-[#f3ffca] bg-[#262626] rounded-r-full font-bold border-l-4 border-[#f3ffca]'
                    : 'text-gray-500 hover:text-[#f3ffca] hover:bg-[#131313] border-l-4 border-transparent'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-headline tracking-tight">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="px-6 mt-auto space-y-3">
            <Link
              to="/admin/orders/create"
              onClick={() => setIsSidebarOpen(false)}
              className="w-full bg-[#f3ffca] text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:shadow-[0_0_20px_rgba(243,255,202,0.3)] transition-all active:scale-95 group"
            >
              <span className="material-symbols-outlined text-xl group-hover:rotate-12 transition-transform">add_circle</span>
              <span className="font-headline tracking-tighter uppercase italic">Buat Pesanan</span>
            </Link>
            <button className="w-full bg-white/5 text-on-surface-variant font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors border border-white/5">
              <span className="material-symbols-outlined text-sm">campaign</span>
              Broadcast Alert
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-error/10 text-error font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-error/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Keluar
            </button>
          </div>
        </div>
      </aside>

      <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] h-16 z-40 bg-[#0e0e0e]/60 backdrop-blur-xl border-b border-white/5">
        <div className="flex justify-between items-center px-4 md:px-8 h-full">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-white p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="text-lg font-bold text-white font-headline">Admin Portal</h2>
            <div className="h-4 w-px bg-white/10"></div>
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="text-xs font-medium uppercase tracking-widest font-label">Status:</span>
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-xs font-bold text-primary">Live</span>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden lg:relative lg:group lg:block">
              <input className="bg-surface-container-low border-none rounded-full px-4 py-1.5 text-sm w-64 focus:ring-1 focus:ring-[#f3ffca] text-on-surface placeholder:text-gray-600 transition-all" placeholder="Search operations..." type="text" />
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">search</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-gray-400 hover:text-[#f3ffca] transition-colors relative">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-0 right-0 h-2 w-2 bg-error rounded-full border border-background"></span>
              </button>
              <button className="text-gray-400 hover:text-[#f3ffca] transition-colors">
                <span className="material-symbols-outlined">help_outline</span>
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-white leading-none">Super Admin</p>
                  <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-tighter">Master Access</p>
                </div>
                <img alt="Super Admin" className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/10 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCxcz1taIWZuXhNzE4Kk8oX_K9kT3igqduygNAUgv7_mTFp-ymwFm4L7ke1X76c_myYezYuZT9zekztDR3w5IV4Lgug2NioMihbUn5oQ-zEWNovvdARWlUM-meti753-l48VVcuClnG81nXwpnYadPnldhulNhPKo6MBKQcNG_mtAOs5Hz7k0ch-FbGfdgDxPLJ1GvQlQJB6eYPHC6Ni-X7we4GomSYlkde5kTLUHJMvCa-IknsHAV3RuT4ANIU5qG82r3eByVnFWA" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="ml-0 md:ml-64 pt-24 pb-12 px-4 md:px-8 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      <button className="fixed bottom-8 right-8 h-16 w-16 bg-[rgba(38,38,38,0.6)] backdrop-blur-[24px] rounded-full shadow-2xl shadow-black flex items-center justify-center border border-white/10 group active:scale-90 transition-transform z-50">
        <span className="material-symbols-outlined text-primary text-3xl group-hover:rotate-12 transition-transform">bolt</span>
      </button>
    </div>
  );
}

export default DashboardLayout;
