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
    let unsubscribe = null;

    const startListening = () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      console.log("DEBUG_ACTIVITY: Memulai kueri untuk user:", user.id);

      // Kueri utama (Butuh Indeks Komposit: customerId + createdAt)
      const q = query(
        collection(db, "orders"), 
        where("customerId", "==", user.id),
        orderBy("createdAt", "desc")
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        console.log("DEBUG_ACTIVITY: Data diterima, jumlah:", snapshot.size);
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrders(ordersData);
        setLoading(false);
      }, (error) => {
        console.warn("DEBUG_ACTIVITY: Kueri utama gagal (mungkin indeks). Mencoba fallback...", error.message);
        
        // Fallback: Tanpa orderBy (TIDAK butuh indeks tambahan)
        const fallbackQuery = query(
          collection(db, "orders"),
          where("customerId", "==", user.id)
        );
        
        onSnapshot(fallbackQuery, (snapshot) => {
          console.log("DEBUG_ACTIVITY: Data fallback diterima, jumlah:", snapshot.size);
          const ordersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })).sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });
          
          setOrders(ordersData);
          setLoading(false);
        });
      });
    };

    startListening();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id]);


  const historyOrders = orders.filter(o => 
    o.status === 'completed' || 
    o.status === 'cancelled' || 
    o.status === 'canceled'
  );
  
  const activeOrders = orders.filter(o => 
    !['completed', 'cancelled', 'canceled'].includes(o.status)
  );

  const renderOrderCard = (order) => (
    <div key={order.id} className={`p-5 rounded-2xl border transition-all mb-4 ${order.status === 'searching' ? 'bg-surface-container-low border-primary/20 shadow-lg' : 'bg-surface-container border-outline/10 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-4 border-b border-outline/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              {order.type === 'ride' ? 'two_wheeler' : order.type === 'food' ? 'restaurant' : 'local_shipping'}
            </span>
          </div>
          <div>
            <h3 className="font-headline font-bold text-lg text-on-surface uppercase">{order.type || 'ARO DRIVE'}</h3>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">#{order.id.slice(-5)}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full border flex items-center gap-1 ${order.status === 'searching' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-container-high text-on-surface-variant border-outline/20'}`}>
          {order.status === 'searching' && <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>}
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {order.status === 'searching' ? 'Mencari Driver' : 
             order.status === 'accepted' ? 'Driver Menuju Lokasi' : 
             order.status === 'picked_up' ? 'Driver Mengambil Pesanan' :
             order.status === 'on_route' ? 'Dalam Perjalanan' : 
             order.status === 'driver_arrived' ? 'Driver Tiba' :
             order.status === 'completed' ? 'Selesai' : 
             order.status === 'cancelled' || order.status === 'canceled' ? 'Dibatalkan' : order.status}
          </span>
        </div>
      </div>
      
      <div className="mb-5">
        <p className="font-medium text-sm text-on-surface mb-1">
          {order.items?.map(i => `${i.name} (x${i.qty})`).join(', ') || (order.type === 'ride' ? 'Layanan Ride' : 'Layanan Antar/Jemput')}
        </p>
        <p className="text-xs text-on-surface-variant">Total: Rp {order.total?.toLocaleString()}</p>
      </div>
      
      <div className="flex items-center justify-between mt-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Metode</span>
          <span className="text-sm font-bold text-on-surface italic">{order.paymentMethod || 'TUNAI'}</span>
        </div>
        {!['completed', 'cancelled', 'canceled'].includes(order.status) && (
          <button 
            onClick={() => navigate(`/tracking?id=${order.id}`)}
            className="bg-primary text-on-primary px-6 py-2 rounded-full font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
          >
            PANTAU
            <span className="material-symbols-outlined text-sm">my_location</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-background min-h-screen pb-40 text-on-background font-body">
      <main className="max-w-xl mx-auto px-6 mt-6">
        <h2 className="font-headline font-black text-xl text-primary mb-6 uppercase italic tracking-tight">Aktivitas Pesanan</h2>
        
        {/* Custom Tabs */}
        <div className="flex bg-surface-container-highest p-1 rounded-full relative mb-8">
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all z-10 ${activeTab === 'active' ? 'text-on-primary bg-primary' : 'text-on-surface-variant'}`}
          >
            Lagi Jalan
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all z-10 ${activeTab === 'history' ? 'text-on-primary bg-primary' : 'text-on-surface-variant'}`}
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
                  <div className="text-center py-20 bg-surface-container-low rounded-3xl border border-dashed border-outline">
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
                  <div className="text-center py-20 bg-surface-container-low rounded-3xl border border-dashed border-outline">
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
