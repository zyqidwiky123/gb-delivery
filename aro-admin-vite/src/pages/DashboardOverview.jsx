import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAdminStore } from '../store/adminStore';

function DashboardOverview({ onNavigate }) {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState({ revenue: 0, drivers: 0, orders: 0 });
  const { transactions } = useAdminStore();

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filteredToday = orders.filter(o => o.createdAt?.toDate() >= startOfToday);
      const todayTotal = filteredToday
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.serviceFee || 0), 0);
      const activeDriversCount = (await getDocs(query(collection(db, "drivers"), orderBy("isOnline", "desc"))))
        .docs.filter(d => d.data().isOnline).length;
      useAdminStore.getState().updateMetrics(activeDriversCount, filteredToday.length);
      setMetrics({ revenue: todayTotal, drivers: activeDriversCount, orders: filteredToday.length });
    } catch (error) {
      console.error("Error fetching overview:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 bg-surface-container-low rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between min-h-[240px]">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant font-label">Total Pendapatan Fee (Hari Ini)</span>
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full font-bold">REAL-TIME</span>
            </div>
            <h3 className="text-6xl font-black text-primary font-headline tracking-tighter mb-2">
              Rp {metrics.revenue.toLocaleString('id-ID')}
            </h3>
            <p className="text-on-surface-variant text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-primary text-sm">trending_up</span>
              <span className="font-bold text-primary">+12.5%</span> dari hari sebelumnya
            </p>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-container-highest rounded-3xl p-6 flex flex-col justify-between">
            <span className="material-symbols-outlined text-primary">electric_bolt</span>
            <div>
              <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-1">Active Drivers</p>
              <p className="text-3xl font-bold font-headline">{metrics.drivers}</p>
            </div>
          </div>
          <div className="bg-surface-container-highest rounded-3xl p-6 flex flex-col justify-between">
            <span className="material-symbols-outlined text-secondary">restaurant_menu</span>
            <div>
              <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-1">Orders Today</p>
              <p className="text-3xl font-bold font-headline">{metrics.orders}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-3xl overflow-hidden border border-white/5">
        <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center">
          <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Transaksi Terbaru</h4>
          <button onClick={() => onNavigate('Transactions')} className="text-primary text-xs font-bold hover:underline">Lihat Semua</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                <th className="px-8 py-4">Order ID</th>
                <th className="px-4 py-4">Layanan</th>
                <th className="px-4 py-4">Total</th>
                <th className="px-8 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.slice(0, 5).map(order => (
                <tr key={order.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => onNavigate('Transactions')}>
                  <td className="px-8 py-5 text-sm font-bold font-headline">#{order.id.slice(-6).toUpperCase()}</td>
                  <td className="px-4 py-5 text-xs font-medium uppercase">{order.serviceType}</td>
                  <td className="px-4 py-5 text-sm font-bold">Rp {order.total?.toLocaleString('id-ID')}</td>
                  <td className="px-8 py-5 text-right">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      order.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
