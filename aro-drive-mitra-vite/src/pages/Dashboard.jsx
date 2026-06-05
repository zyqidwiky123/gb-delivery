import React, { useEffect, useState } from 'react';
import { useMerchantStore } from '../store/useMerchantStore';
import { useOrderStore } from '../store/useOrderStore';
import { 
  LayoutDashboard, ShoppingBag, Clock, CheckCircle, Store, Power, 
  TrendingUp, XCircle, Package, ChevronRight, History, MessageSquare
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { requestPermissionAndGetToken, onMessageListener } from '../firebase/messagingService';

function Dashboard() {
  const { merchant, user, updateMerchant } = useMerchantStore();
  const { 
    orders, listenToOrders, stopListening,
    acceptOrder, rejectOrder, markReady, updateManualPrice,
    getActiveOrders, getPendingOrders, getConfirmedOrders,
    getTodayCompleted, getTodayRevenue
  } = useOrderStore();

  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [manualPrices, setManualPrices] = useState({});

  const formatWA = (phone) => {
    if (!phone) return "";
    let p = phone.replace(/\D/g, "");
    if (p.startsWith("0")) p = "62" + p.slice(1);
    return p;
  };

  const handleContact = (phone, name, orderId, role) => {
    const wa = formatWA(phone);
    if (!wa) return alert("Nomor WA tidak tersedia");
    const merchantName = merchant?.name || "Merchant ARO DRIVE";
    const text = `Halo ${name}, saya dari ${merchantName}. Mengenai pesanan #${orderId.slice(-6).toUpperCase()}...`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank');
  };

  useEffect(() => {
    if (!user?.uid) return;

    listenToOrders(user.uid);
    requestPermissionAndGetToken(user.uid);

    onMessageListener().then(payload => {
      console.log("Notif received in dashboard:", payload);
    });

    // Handle tab visibility change to refresh listener (fix for mobile browsers killing websockets)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        listenToOrders(user.uid);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopListening();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  const toggleShopStatus = () => {
    const newStatus = !merchant?.isOpen;
    updateMerchant({ isOpen: newStatus });
  };

  const handleAccept = async (orderId) => {
    setActionLoading(orderId);
    try {
      await acceptOrder(orderId);
    } catch (err) {
      alert("Gagal menerima pesanan.");
    }
    setActionLoading(null);
  };

  const handleReject = async (orderId) => {
    setActionLoading(orderId);
    try {
      await rejectOrder(orderId, rejectReason);
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      alert("Gagal menolak pesanan.");
    }
    setActionLoading(null);
  };

  const handleMarkReady = async (orderId) => {
    setActionLoading(orderId);
    try {
      await markReady(orderId);
    } catch (err) {
      alert("Gagal mengupdate status.");
    }
    setActionLoading(null);
  };

  const handleUpdatePrice = async (orderId) => {
    const price = manualPrices[orderId];
    if (!price || isNaN(price) || Number(price) <= 0) {
      alert("Masukkan harga yang valid");
      return;
    }
    setActionLoading(orderId + '_price');
    try {
      await updateManualPrice(orderId, price);
      // clear the input after success
      setManualPrices(prev => ({ ...prev, [orderId]: '' }));
    } catch (err) {
      alert("Gagal mengupdate harga.");
    }
    setActionLoading(null);
  };

  const activeOrders = getActiveOrders();
  const pendingOrders = getPendingOrders();
  const confirmedOrders = getConfirmedOrders();
  const todayCompleted = getTodayCompleted();
  const todayRevenue = getTodayRevenue();

  const getStatusBadge = (order) => {
    if (order.status === 'cancelled') {
      return { text: 'Dibatalkan', color: 'bg-red-500/10 text-red-500 border-red-500/20' };
    }
    if (order.status === 'completed') {
      return { text: 'Selesai', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    }
    if (order.status === 'searching' && !order.merchantConfirmed) {
      return { text: 'Menunggu Konfirmasi', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse' };
    }
    if (order.merchantConfirmed && !order.merchantReady) {
      if (order.status === 'accepted' || order.status === 'searching') {
        return { text: 'Sedang Disiapkan', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
      }
    }
    if (order.merchantReady && order.status !== 'picked_up') {
      return { text: 'Siap Diambil', color: 'bg-primary/10 text-primary border-primary/20' };
    }
    if (order.status === 'picked_up' || order.status === 'on_route') {
      return { text: 'Dalam Pengantaran', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
    }
    return { text: order.status, color: 'bg-white/5 text-white/40 border-white/10' };
  };

  return (
    <div className="min-h-screen bg-dark pb-24">
      {/* Header */}
      <header className="bg-surface/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Store className="text-primary w-6 h-6" />
            </div>
            <div>
              <h2 className="font-headline font-bold text-lg leading-none">{merchant?.name || 'Toko Saya'}</h2>
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Aro Drive Merchant</span>
            </div>
          </div>
          <button 
            onClick={toggleShopStatus}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${merchant?.isOpen ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}
          >
            <Power size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">{merchant?.isOpen ? 'Buka' : 'Tutup'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card flex flex-col items-center justify-center p-4">
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Menunggu</span>
            <span className="text-3xl font-headline font-bold text-amber-500">{pendingOrders.length}</span>
          </div>
          <div className="card flex flex-col items-center justify-center p-4">
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Diproses</span>
            <span className="text-3xl font-headline font-bold text-blue-400">{confirmedOrders.length}</span>
          </div>
          <div className="card flex flex-col items-center justify-center p-4">
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Selesai Hari Ini</span>
            <span className="text-3xl font-headline font-bold text-primary">{todayCompleted.length}</span>
          </div>
          <div className="card flex flex-col items-center justify-center p-4">
            <span className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Pendapatan</span>
            <span className="text-xl font-headline font-bold text-white">
              Rp {todayRevenue.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Pending Orders (Need Confirmation) */}
        {pendingOrders.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-headline font-bold text-xl flex items-center gap-2">
                <Clock className="text-amber-500" size={20} />
                Pesanan Baru
              </h3>
              <span className="bg-amber-500/20 text-amber-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                {pendingOrders.length} Menunggu
              </span>
            </div>

            <div className="space-y-4">
              {pendingOrders.map(order => (
                <div key={order.id} className="card border-amber-500/20 hover:border-amber-500/40 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-bold text-white/40 uppercase tracking-widest">ID Pesanan</span>
                      <p className="font-mono text-sm text-primary font-bold">#{order.id.slice(-6).toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Waktu</span>
                      <p className="text-sm font-medium">
                        {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="bg-white/5 rounded-xl p-3 mb-4">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Pelanggan</span>
                    <p className="text-sm font-medium">{order.customer?.name || 'Guest'}</p>
                  </div>

                  {/* Items */}
                  <div className="space-y-2 mb-4">
                    {order.items?.map?.((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-white/80 font-medium">x{item.qty || item.quantity} {item.name}</span>
                        <span className="text-white/40">Rp {(item.price * (item.qty || item.quantity || 1)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest block">Total Produk</span>
                        <span className="text-lg font-bold">Rp {(order.subtotal || order.actualShoppingCost || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Reject Reason Modal */}
                    {rejectingId === order.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="Alasan penolakan (opsional)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="input-field w-full text-sm"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold text-sm"
                          >
                            Batal
                          </button>
                          <button
                            onClick={() => handleReject(order.id)}
                            disabled={actionLoading === order.id}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm transition-all"
                          >
                            {actionLoading === order.id ? 'Memproses...' : 'Konfirmasi Tolak'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleContact(order.customer?.wa, order.customer?.name, order.id, 'pelanggan')}
                          className="p-3 bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500/20 transition-colors"
                          title="Chat Pelanggan"
                        >
                          <MessageSquare size={20} />
                        </button>
                        <button
                          onClick={() => setRejectingId(order.id)}
                          className="flex-1 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                        >
                          <XCircle size={16} />
                          Tolak
                        </button>
                        <button
                          onClick={() => handleAccept(order.id)}
                          disabled={actionLoading === order.id}
                          className="flex-1 btn-primary py-3 text-sm"
                        >
                          {actionLoading === order.id ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <CheckCircle size={16} />
                              Terima Pesanan
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active/Confirmed Orders */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-headline font-bold text-xl flex items-center gap-2">
              <Package className="text-blue-400" size={20} />
              Pesanan Aktif
            </h3>
            {confirmedOrders.length > 0 && (
              <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                {confirmedOrders.length} Aktif
              </span>
            )}
          </div>

          <div className="space-y-4">
            {confirmedOrders.length === 0 ? (
              <div className="card border-dashed border-white/10 bg-transparent flex flex-col items-center justify-center py-12 text-white/30">
                <ShoppingBag size={40} className="mb-4 opacity-20" />
                <p className="font-medium">Tidak ada pesanan aktif</p>
                <p className="text-xs">Pesanan yang dikonfirmasi akan muncul di sini</p>
              </div>
            ) : (
              confirmedOrders.map(order => {
                const badge = getStatusBadge(order);
                return (
                  <div key={order.id} className="card hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest">ID Pesanan</span>
                        <p className="font-mono text-sm text-primary font-bold">#{order.id.slice(-6).toUpperCase()}</p>
                      </div>
                      <div className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${badge.color}`}>
                        {badge.text}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {order.items?.map?.((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-white/80 font-medium">x{item.qty || item.quantity} {item.name}</span>
                          <span className="text-white/40">Rp {(item.price * (item.qty || item.quantity || 1)).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest block">Total Produk</span>
                        <span className="text-lg font-bold">Rp {(order.subtotal || order.actualShoppingCost || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Manual Price Input */}
                    {order.items?.some(i => i.isManual) && (order.subtotal === 0 || !order.subtotal) && order.status !== 'completed' && order.status !== 'cancelled' && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <span className="text-xs font-bold text-amber-500 uppercase tracking-widest block mb-2">Input Harga Produk</span>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="Rp 0"
                            value={manualPrices[order.id] || ''}
                            onChange={(e) => setManualPrices({ ...manualPrices, [order.id]: e.target.value })}
                            className="input-field flex-1 text-sm bg-white/5 border border-white/10"
                          />
                          <button
                            onClick={() => handleUpdatePrice(order.id)}
                            disabled={actionLoading === order.id + '_price' || !manualPrices[order.id]}
                            className="bg-amber-500 text-dark px-4 rounded-xl font-bold text-sm transition-all hover:bg-amber-400 disabled:opacity-50"
                          >
                            {actionLoading === order.id + '_price' ? '...' : 'Update'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex gap-2">
                        {order.customer?.wa && (
                          <button
                            onClick={() => handleContact(order.customer.wa, order.customer.name, order.id, 'pelanggan')}
                            className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center hover:bg-green-500/20 transition-all border border-green-500/20"
                            title="Chat Pelanggan"
                          >
                            <MessageSquare size={18} />
                          </button>
                        )}
                        {order.driverPhone && (
                          <button
                            onClick={() => handleContact(order.driverPhone, order.driverName, order.id, 'driver')}
                            className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center hover:bg-blue-500/20 transition-all border border-blue-500/20"
                            title="Chat Driver"
                          >
                            <MessageSquare size={18} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Mark Ready Button */}
                        {order.merchantConfirmed && !order.merchantReady && order.status !== 'picked_up' && order.status !== 'completed' && (
                          <button
                            onClick={() => handleMarkReady(order.id)}
                            disabled={actionLoading === order.id}
                            className="btn-primary py-2.5 px-6 text-xs shadow-lg shadow-primary/20"
                          >
                            {actionLoading === order.id ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <Package size={14} />
                                Pesanan Siap
                              </>
                            )}
                          </button>
                        )}
                        {order.merchantReady && order.status !== 'picked_up' && order.status !== 'completed' && (
                          <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">
                            ✓ Menunggu Driver
                          </span>
                        )}
                        {(order.status === 'picked_up' || order.status === 'on_route') && (
                          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest bg-purple-500/10 px-4 py-2 rounded-xl border border-purple-500/20">
                            ✓ Diambil Driver
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Quick Link to History */}
        <Link to="/order-history" className="card flex items-center justify-between hover:border-primary/30 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
              <History size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">Riwayat Pesanan</p>
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Lihat semua pesanan selesai</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-white/20 group-hover:text-primary transition-colors" />
        </Link>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-2xl border-t border-white/5 pb-safe z-50">
        <div className="max-w-xl mx-auto flex justify-around p-3">
          <Link to="/" className="flex flex-col items-center gap-1 p-2 text-primary">
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

export default Dashboard;
