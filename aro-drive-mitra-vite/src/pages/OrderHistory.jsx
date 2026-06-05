import React, { useEffect, useState } from 'react';
import { useMerchantStore } from '../store/useMerchantStore';
import { useOrderStore } from '../store/useOrderStore';
import { ChevronLeft, Calendar, TrendingUp, CheckCircle, XCircle, LayoutDashboard, ShoppingBag, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

function OrderHistory() {
  const { user } = useMerchantStore();
  const { historyOrders, fetchHistory, isLoadingHistory, historyHasMore } = useOrderStore();
  const [filter, setFilter] = useState('all'); // all, completed, cancelled

  useEffect(() => {
    if (user?.uid) {
      fetchHistory(user.uid, true);
    }
  }, [user]);

  const filteredOrders = historyOrders.filter(o => {
    if (filter === 'completed') return o.status === 'completed';
    if (filter === 'cancelled') return o.status === 'cancelled';
    return true;
  });

  const totalRevenue = historyOrders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (o.subtotal || 0), 0);

  const totalCompleted = historyOrders.filter(o => o.status === 'completed').length;
  const totalCancelled = historyOrders.filter(o => o.status === 'cancelled').length;

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-dark pb-24">
      <header className="bg-surface/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="text-white/40 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </Link>
          <h2 className="font-headline font-bold text-lg">Riwayat Pesanan</h2>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Revenue Summary */}
        <div className="card bg-gradient-to-br from-primary/10 to-transparent border-primary/10">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="text-primary" size={24} />
            <h3 className="font-headline font-bold text-lg">Ringkasan</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-headline font-bold text-primary">{totalCompleted}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Selesai</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-headline font-bold text-red-400">{totalCancelled}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Batal</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-headline font-bold text-white">Rp {totalRevenue.toLocaleString()}</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Pendapatan</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'Semua' },
            { key: 'completed', label: 'Selesai' },
            { key: 'cancelled', label: 'Batal' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                filter === f.key
                  ? 'bg-primary/20 text-primary border border-primary/20'
                  : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Order List */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="card text-center py-16 text-white/20">
              <Calendar size={48} className="mx-auto mb-4 opacity-10" />
              <p className="font-medium">Belum ada riwayat pesanan</p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} className="card">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-mono text-sm text-primary font-bold">#{order.id.slice(-6).toUpperCase()}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${
                    order.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                  }`}>
                    {order.status === 'completed' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {order.status === 'completed' ? 'Selesai' : 'Batal'}
                  </div>
                </div>

                {/* Items Summary */}
                <div className="space-y-1 mb-3">
                  {order.items?.map?.((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-white/60">x{item.qty || item.quantity} {item.name}</span>
                      <span className="text-white/30">Rp {(item.price * (item.qty || item.quantity || 1)).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                  <span className="text-xs text-white/30">{order.customer?.name || 'Guest'}</span>
                  <span className="font-bold">Rp {(order.subtotal || order.total || 0).toLocaleString()}</span>
                </div>

                {order.cancelReason && (
                  <div className="mt-3 bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                    <p className="text-xs text-red-400">Alasan: {order.cancelReason}</p>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Load More */}
          {historyHasMore && (
            <button
              onClick={() => fetchHistory(user.uid, false)}
              disabled={isLoadingHistory}
              className="w-full card text-center py-4 text-primary font-bold text-sm hover:bg-primary/5 transition-colors"
            >
              {isLoadingHistory ? (
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              ) : (
                'Muat Lebih Banyak'
              )}
            </button>
          )}
        </div>
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
          <Link to="/settings" className="flex flex-col items-center gap-1 p-2 text-white/40 hover:text-white transition-colors">
            <Store size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Toko</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default OrderHistory;
