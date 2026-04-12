import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, orderBy, or } from 'firebase/firestore';
import { useUserStore } from '../store/userStore';

function Activity() {
  const [activeTab, setActiveTab] = useState('active');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useUserStore();

  useEffect(() => {
    // Tunggu sampai user diinisialisasi untuk mencegah tampilan "Kosong" sekilas saat refresh
    if (!user) {
      // Jika setelah 2 detik masih kustomer, baru set loading false (mungkin guest)
      const timer = setTimeout(() => {
        if (!user) setLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }

    // Filter orders where user is either the customer or the driver
    const q = query(
      collection(db, "orders"), 
      where("customerId", "==", user.id),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching activity:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);


  const activeOrders = orders.filter(o => 
    o.status === 'searching' || 
    o.status === 'accepted' || 
    o.status === 'on_route' || 
    o.status === 'picked_up' ||
    o.status === 'driver_arrived'
  );
  const historyOrders = orders.filter(o => o.status === 'completed' || o.status === 'cancelled' || o.status === 'canceled');

  const renderOrderCard = (order) => (
    <div key={order.id} className={`p-5 rounded-2xl border transition-all mb-4 ${order.status === 'searching' ? 'bg-surface-container-low border-primary/20 shadow-lg' : 'bg-surface-container-highest/40 border-white/5'}`}>
      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              {order.type === 'ride' ? 'two_wheeler' : order.type === 'food' ? 'restaurant' : 'local_shipping'}
            </span>
          </div>
          <div>
            <h3 className="font-headline font-bold text-lg text-white uppercase">{order.type || 'ARO DRIVE'}</h3>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">#{order.id.slice(-5)}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border flex items-center gap-1 ${order.status === 'searching' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-white/5 text-on-surface-variant border-white/10'}`}>
          {order.status === 'searching' && <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>}
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {order.status === 'searching' ? 'Mencari Driver' : 
             order.status === 'accepted' ? 'Driver Menuju Lokasi' : 
             order.status === 'on_route' ? 'Dalam Perjalanan' : 
             order.status === 'driver_arrived' ? 'Driver Tiba' :
             order.status === 'completed' ? 'Selesai' : order.status}
          </span>
        </div>
      </div>
      
      <div className="mb-5">
        <p className="font-medium text-sm text-on-surface mb-1">
          {order.items?.map(i => `${i.name} (x${i.qty})`).join(', ') || 'Layanan Antar/Jemput'}
        </p>
        <p className="text-xs text-on-surface-variant">Total: Rp {order.total?.toLocaleString()}</p>
      </div>
      
      <div className="flex items-center justify-between mt-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Metode</span>
          <span className="text-sm font-bold text-white italic">{order.paymentMethod || 'TUNAI'}</span>
        </div>
        {(order.status === 'searching' || order.status === 'accepted') && (
          <button 
            onClick={() => navigate(`/tracking?id=${order.id}`)}
            className="bg-primary text-black px-6 py-2 rounded-full font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
          >
            PANTAU
            <span className="material-symbols-outlined text-sm">my_location</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-background min-h-screen pb-40 text-white font-body">
      <main className="max-w-xl mx-auto px-6 mt-6">
        <h2 className="font-headline font-black text-xl text-primary mb-6 uppercase italic tracking-tight">Aktivitas Pesanan</h2>
        
        {/* Custom Tabs */}
        <div className="flex bg-surface-container-highest p-1 rounded-full relative mb-8">
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all z-10 ${activeTab === 'active' ? 'text-black bg-primary' : 'text-on-surface-variant'}`}
          >
            Lagi Jalan
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all z-10 ${activeTab === 'history' ? 'text-black bg-primary' : 'text-on-surface-variant'}`}
          >
            Selesai
          </button>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             <p className="text-sm text-on-surface-variant animate-pulse font-bold tracking-widest uppercase">Sinkronisasi...</p>
          </div>
        ) : (
          <>
            {activeTab === 'active' ? (
              <div className="space-y-2">
                {activeOrders.length === 0 ? (
                  <div className="text-center py-20 bg-surface-container-low rounded-3xl border border-dashed border-white/5">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">history</span>
                    <p className="text-sm text-on-surface-variant">Belum ada pesanan aktif nih.</p>
                  </div>
                ) : (
                  activeOrders.map(order => renderOrderCard(order))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {historyOrders.length === 0 ? (
                  <div className="text-center py-20 bg-surface-container-low rounded-3xl border border-dashed border-white/5">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">archive</span>
                    <p className="text-sm text-on-surface-variant">Belum ada riwayat pesanan.</p>
                  </div>
                ) : (
                  historyOrders.map(order => renderOrderCard(order))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Activity;
