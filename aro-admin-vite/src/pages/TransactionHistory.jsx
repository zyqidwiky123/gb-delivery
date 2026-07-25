import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs, updateDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useAdminStore } from '../store/adminStore';

function TransactionHistory() {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const { transactions, setTransactions, drivers, setDrivers } = useAdminStore();

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(list);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminCancelOrder = async (transaction) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;
    
    setLoading(true);
    try {
      const orderRef = doc(db, "orders", transaction.id);
      await updateDoc(orderRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: 'admin',
        cancelReason: 'Dibatalkan oleh Admin'
      });
      
      // Release driver if assigned
      if (transaction.driverId) {
        const driverRef = doc(db, "drivers", transaction.driverId);
        await updateDoc(driverRef, { status: "online" });
      }
      
      alert('Pesanan berhasil dibatalkan');
      setSelectedTransaction(null);
      fetchTransactions();
    } catch (error) {
      console.error("Error cancelling order:", error);
      alert('Gagal membatalkan pesanan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5">
        <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic mb-2 text-shadow-glow">Riwayat Transaksi</h3>
        <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant font-medium">
          <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-primary"></span> Completed</span>
          <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-yellow-500"></span> Pending / OntheWay</span>
          <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-error"></span> Cancelled</span>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                <th className="px-8 py-4">Order ID</th>
                <th className="px-4 py-4">Layanan</th>
                <th className="px-4 py-4">Customer</th>
                <th className="px-4 py-4">Driver</th>
                <th className="px-4 py-4">Total</th>
                <th className="px-8 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.filter(o => 
                o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                o.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
              ).map(order => (
                <tr key={order.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold font-headline">#{order.id.slice(-6).toUpperCase()}</p>
                    <p className="text-[10px] text-on-surface-variant">{order.createdAt?.toDate().toLocaleString('id-ID')}</p>
                  </td>
                  <td className="px-4 py-5 font-bold uppercase text-[10px]">{order.serviceType}</td>
                  <td className="px-4 py-5 text-xs font-medium">{order.customer?.name || 'Guest'}</td>
                  <td className="px-4 py-5 text-xs font-medium">{order.driverId?.slice(-6).toUpperCase() || '-'}</td>
                  <td className="px-4 py-5 text-sm font-bold text-primary">Rp {order.total?.toLocaleString('id-ID')}</td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => setSelectedTransaction(order)}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedTransaction(null)}></div>
          <div className="relative w-full max-w-2xl bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic mb-1">
                  Detail Transaksi #{selectedTransaction.id.slice(-6).toUpperCase()}
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">Layanan: <span className="text-primary uppercase font-bold">{selectedTransaction.serviceType}</span></p>
              </div>
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-white">close</span>
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Customer</p>
                    <p className="text-sm font-bold text-white">{selectedTransaction.customer?.name || 'Guest'}</p>
                    <p className="text-xs text-on-surface-variant">{selectedTransaction.customer?.wa || selectedTransaction.customer?.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Status</p>
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase">{selectedTransaction.status}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Pembayaran</p>
                    <p className="text-sm font-bold text-white">{selectedTransaction.paymentMethod}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Waktu Selesai</p>
                    <p className="text-sm font-bold text-white">{selectedTransaction.completedAt?.toDate().toLocaleString('id-ID') || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Items List (Food/Shop Specific) */}
              {(selectedTransaction.serviceType === 'food' || selectedTransaction.serviceType === 'shop') && (
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Daftar Item / Pesanan</p>
                  <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                    {selectedTransaction.items && Array.isArray(selectedTransaction.items) ? (
                      selectedTransaction.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div>
                            <p className="font-bold text-white">{item.name}</p>
                            <p className="text-[10px] text-on-surface-variant">Qty: {item.qty} | {item.merchantName}</p>
                          </div>
                          <p className="font-bold text-primary">Rp {(item.price * item.qty).toLocaleString('id-ID')}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-white italic">{selectedTransaction.items || "Tidak ada detail item"}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="pt-6 border-t border-white/5 space-y-3">
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Subtotal</span>
                  <span>Rp {selectedTransaction.subtotal?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Biaya Ongkir / Layanan</span>
                  <span>Rp {selectedTransaction.deliveryFee?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Biaya Jasa Admin (Fee)</span>
                  <span>Rp {selectedTransaction.serviceFee?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-lg font-black text-primary font-headline pt-2">
                  <span className="uppercase italic">Total Akhir</span>
                  <span>Rp {selectedTransaction.total?.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="p-8 bg-zinc-900/50 flex gap-4">
              {selectedTransaction.status !== 'completed' && selectedTransaction.status !== 'cancelled' && selectedTransaction.status !== 'canceled' && (
                <button 
                  onClick={() => handleAdminCancelOrder(selectedTransaction)}
                  className="flex-1 bg-red-500/10 text-red-500 font-bold py-4 rounded-2xl hover:bg-red-500/20 transition-all uppercase tracking-widest text-xs border border-red-500/20"
                >
                  Batal Pesan
                </button>
              )}
              <button className="flex-1 bg-white/5 text-white font-bold py-4 rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs">Print Struk</button>
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="flex-1 bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg hover:shadow-primary/20 active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionHistory;
