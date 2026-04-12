import React, { useEffect, useState } from 'react';
import { listenForAllDriverOrders } from '../firebase/orderService';
import { useDriverStore } from '../store/useDriverStore';

function Orders() {
  const { user } = useDriverStore();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = listenForAllDriverOrders(user.uid, (fetchedOrders) => {
      setOrders(fetchedOrders);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-primary bg-primary/10 border-primary/20';
      case 'accepted': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      default: return 'text-on-surface-variant bg-surface-container-highest border-white/5';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Selesai';
      case 'accepted': return 'Sedang Berjalan';
      default: return status.toUpperCase();
    }
  };

  return (
    <div className="bg-surface-dim min-h-screen text-white font-body pb-32">
      {/* Header */}
      <header className="bg-[#0e0e0e]/90 backdrop-blur-md sticky top-0 z-50 border-b border-white/5 py-5 px-6">
        <div className="w-full max-w-xl mx-auto flex items-center justify-between">
          <h1 className="font-headline font-bold text-2xl text-on-primary-fixed">Riwayat Orders</h1>
          <div className="bg-surface-container-highest px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">TOTAL:</span>
            <span className="text-sm font-black text-white">{orders.length}</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto w-full p-4 space-y-4">
        {orders.length === 0 ? (
          <div className="bg-surface-container-low p-8 rounded-xl border border-dashed border-white/10 text-center mt-6">
             <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">history</span>
             <p className="text-sm text-on-surface-variant">Belum ada riwayat pesanan yang terdata.</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-surface-container-low p-5 rounded-2xl border border-white/5 shadow-sm group hover:border-primary/20 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">local_mall</span>
                  <span className="font-headline font-bold text-sm text-white">#ARO-{order.id.slice(-5).toUpperCase()}</span>
                </div>
                <div className={`px-2 py-1 rounded font-bold text-[10px] uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                  {getStatusText(order.status)}
                </div>
              </div>
              
              <div className="space-y-1 mb-4">
                <p className="text-[11px] font-label uppercase tracking-widest text-outline">Detail Kustomer</p>
                <p className="text-sm font-bold">{order.customer?.name} {order.customer?.isGuest ? '(Guest)' : ''}</p>
                {order.customer?.phone && (
                   <p className="text-xs text-on-surface-variant">{order.customer.phone}</p>
                )}
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div>
                   <p className="text-[10px] font-label uppercase tracking-widest text-outline">Total Biaya</p>
                   <p className="text-lg font-headline font-black text-white mt-0.5">Rp {(order.total || 0).toLocaleString()}</p>
                </div>
                {order.status === 'completed' && (
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-highest">
                    <span className="material-symbols-outlined text-primary text-xl">check_circle</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

export default Orders;
