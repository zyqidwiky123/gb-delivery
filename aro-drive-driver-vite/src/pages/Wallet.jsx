import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listenForCompletedOrders } from '../firebase/orderService';
import { useDriverStore } from '../store/useDriverStore';
import { observeDriverBalance, requestTopup } from '../firebase/walletService';

function Wallet() {
  const { user, profile } = useDriverStore();
  const [completedOrders, setCompletedOrders] = useState([]);
  const [balance, setBalance] = useState(0);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState(20000);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!user?.uid) return;
    
    // Listen for transaction history
    const unsubscribeOrders = listenForCompletedOrders(user.uid, (orders) => {
      setCompletedOrders(orders);
    });

    // Listen for real-time balance
    const unsubscribeBalance = observeDriverBalance(user.uid, (newBalance) => {
      setBalance(newBalance);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeBalance();
    };
  }, [user?.uid]);

  const totalEarnings = completedOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const totalDeductions = completedOrders.reduce((sum, order) => sum + (order.platformFee || 0), 0);
  const netEarnings = totalEarnings - totalDeductions;

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    if (topupAmount < 20000) {
      alert("Minimal top-up adalah Rp 20.000");
      return;
    }

    setLoading(true);
    try {
      const requestId = await requestTopup(user.uid, profile?.name || 'Driver', topupAmount, 'Manual Bank/QRIS');
      
      // WhatsApp Integration
      const waNumber = "6285748343842"; // Nomor Admin ARO DRIVE
      const message = encodeURIComponent(`Halo Admin ARO DRIVE, saya mau Top-up Saldo.\n\nID Driver: ${user.uid}\nNama: ${profile?.name || 'Driver'}\nNominal: Rp ${topupAmount.toLocaleString()}\nID Request: ${requestId}\n\nMohon bantuannya untuk verifikasi bukti transfer saya.`);
      const waLink = `https://wa.me/${waNumber}?text=${message}`;
      
      window.open(waLink, '_blank');
      setShowTopupModal(false);
      alert("Permintaan dikirim! Silakan kirim bukti transfer ke WhatsApp Admin yang baru saja terbuka.");
    } catch (error) {
      console.error("Topup Error:", error);
      alert(`Gagal mengirim permintaan top-up: ${error.message || 'Cek koneksi internet Anda.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-dim min-h-screen pb-40 text-white font-body">
      
      {/* Top Header */}
      <header className="bg-[#0e0e0e]/90 backdrop-blur-md sticky top-0 z-50 border-b border-white/5 py-5 px-6">
        <div className="w-full max-w-xl mx-auto flex items-center justify-between">
          <h1 className="font-headline font-bold text-2xl text-on-primary-fixed uppercase tracking-tighter italic">ARO Wallet</h1>
          <button className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center hover:bg-surface-container-high transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 mt-6 space-y-6">
        
        {/* Main Balance Card (Virtual Card Style) */}
        <div className="relative overflow-hidden rounded-[2rem] p-8 shadow-2xl">
          {/* Kinetic Gradient Background */}
          <div className="absolute inset-0 kinetic-gradient opacity-95"></div>
          
          {/* Grain Overlay */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          
          <div className="relative z-10 text-on-tertiary-fixed">
            <div className="flex justify-between items-start mb-10">
              <div>
                <p className="font-label text-[10px] uppercase tracking-[0.2em] font-black opacity-60 mix-blend-color-burn">Saldo ARO-Credit Aktif</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-xl font-bold opacity-70">Rp</span>
                  <span className="text-6xl font-headline font-black tracking-tighter mix-blend-color-burn">{(balance || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="w-14 h-14 bg-black/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                <span className="material-symbols-outlined text-4xl opacity-50 mix-blend-color-burn">payments</span>
              </div>
            </div>
            
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-[0.1em] opacity-50">Driver Identity</p>
                <p className="font-mono text-sm font-bold tracking-widest mix-blend-color-burn uppercase">{user.uid.slice(-10)}</p>
              </div>
              
              {balance <= 10000 && (
                <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-lg animate-pulse">
                  <span className="material-symbols-outlined text-red-700 text-sm">warning</span>
                  <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">Saldo Rendah</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button 
            onClick={() => setShowTopupModal(true)}
            className="flex-1 bg-surface-container-highest hover:bg-surface-container-high border border-white/5 py-5 rounded-[2rem] flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-xl group border-b-4 border-primary/20"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors border border-primary/20">
              <span className="material-symbols-outlined text-primary text-2xl">add_card</span>
            </div>
            <span className="font-black text-[10px] uppercase tracking-[0.2em] text-on-surface">Top Up Saldo</span>
          </button>
          
          <button className="flex-1 bg-surface-container-highest hover:bg-surface-container-high border border-white/5 py-5 rounded-[2rem] flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-xl group border-b-4 border-white/5 opacity-50">
            <div className="w-12 h-12 rounded-2xl bg-surface-container-low flex items-center justify-center group-hover:bg-[#262626] transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant text-2xl">account_balance</span>
            </div>
            <span className="font-black text-[10px] uppercase tracking-[0.2em] text-on-surface">Tarik Tunai</span>
          </button>
        </div>

        {/* Earnings Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface-container-highest/50 p-4 rounded-2xl border border-white/5 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant mb-1">Gross</p>
            <p className="text-sm font-bold text-white">Rp {totalEarnings.toLocaleString()}</p>
          </div>
          <div className="bg-surface-container-highest/50 p-4 rounded-2xl border border-white/5 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-error mb-1">Fee App</p>
            <p className="text-sm font-bold text-error">-Rp {totalDeductions.toLocaleString()}</p>
          </div>
          <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Net</p>
            <p className="text-sm font-bold text-primary">Rp {netEarnings.toLocaleString()}</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-primary/5 border border-primary/10 p-5 rounded-3xl flex gap-4 items-center">
            <span className="material-symbols-outlined text-primary">info</span>
            <p className="text-xs text-on-surface-variant font-medium">Saldo Wallet dikurangi otomatis setiap pesanan selesai sebagai <span className="text-white font-bold">biaya layanan platform</span>. Top-up saldo untuk terus menerima order.</p>
        </div>

        {/* Transaction History */}
        <section className="bg-surface-container-low rounded-[2.5rem] border border-white/5 p-8 shadow-inner mt-4">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-headline font-bold text-xl text-white uppercase italic tracking-tighter">Riwayat Transaksi</h2>
            <button className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline">Lihat Semua</button>
          </div>
          
          <div className="space-y-4">
            {completedOrders.length === 0 ? (
              <div className="text-center py-10 opacity-50">
                 <span className="material-symbols-outlined text-4xl mb-2">history</span>
                 <p className="text-on-surface-variant text-[10px] uppercase font-bold tracking-widest">Belum ada riwayat pendapatan.</p>
              </div>
            ) : (
              completedOrders.map((order, i) => (
                <React.Fragment key={order.id}>
                  {/* Earning Entry */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/10">
                        <span className="material-symbols-outlined text-lg">arrow_downward</span>
                      </div>
                      <div>
                        <h3 className="font-black text-xs text-white uppercase tracking-tight">Order {order.serviceType?.toUpperCase()}</h3>
                        <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">#ARO-{order.id.slice(-6).toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                        <span className="font-black text-sm text-green-400">+Rp {(order.total || 0).toLocaleString()}</span>
                        <p className="text-[10px] text-on-surface-variant opacity-50 uppercase font-bold">Pendapatan</p>
                    </div>
                  </div>
                  {/* Fee Deduction Entry */}
                  {(order.platformFee || 0) > 0 && (
                    <div className="flex items-center justify-between group ml-6 opacity-70">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center text-error border border-error/10">
                          <span className="material-symbols-outlined text-sm">arrow_upward</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-[10px] text-on-surface-variant uppercase tracking-tight">Biaya Layanan</h3>
                        </div>
                      </div>
                      <div className="text-right">
                          <span className="font-bold text-xs text-error">-Rp {(order.platformFee).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                  {i < completedOrders.length - 1 && <div className="w-full h-px bg-white/5"></div>}
                </React.Fragment>
              ))
            )}
          </div>
        </section>

      </main>

      {/* Top Up Modal */}
      {showTopupModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowTopupModal(false)}></div>
            <div className="relative w-full max-w-sm bg-surface-container-low rounded-[3rem] p-8 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-white font-headline uppercase italic italic tracking-tighter">Top Up Saldo</h3>
                        <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest">Konfirmasi via WhatsApp</p>
                    </div>
                    <button onClick={() => setShowTopupModal(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>

                <form onSubmit={handleTopupSubmit} className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nominal Top-up</label>
                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-primary font-headline">Rp</span>
                            <input 
                                type="number" 
                                value={topupAmount}
                                onChange={(e) => setTopupAmount(Number(e.target.value))}
                                className="w-full bg-[#161616] border-none rounded-2xl py-5 pl-14 pr-6 text-xl font-headline font-black text-white focus:ring-2 focus:ring-primary transition-all"
                                min="20000"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {[20000, 50000, 100000].map(amt => (
                                <button 
                                    key={amt} 
                                    type="button"
                                    onClick={() => setTopupAmount(amt)}
                                    className={`py-2 rounded-xl text-[10px] font-black border transition-all ${topupAmount === amt ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-transparent text-on-surface-variant'}`}
                                >
                                    {amt / 1000}k
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-zinc-900/50 p-4 rounded-2xl space-y-2 border border-white/5">
                        <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">warning</span> INFO PEMBAYARAN
                        </p>
                        <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">Setelah menekan tombol di bawah, Abang akan diarahkan ke WhatsApp Admin untuk mengirimkan bukti transfer manual.</p>
                    </div>

                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full kinetic-gradient text-black font-black py-5 rounded-2xl uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'MEMPROSES...' : (
                            <>
                                <span className="material-symbols-outlined text-sm">send</span>
                                Lanjut ke WhatsApp
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
      )}

    </div>
  );
}

export default Wallet;
