import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useAdminStore } from '../store/adminStore';

function PromotionManagement() {
  const [loading, setLoading] = useState(false);
  const [showAddBentoModal, setShowAddBentoModal] = useState(false);
  const [editingBento, setEditingBento] = useState(null);
  const [newBento, setNewBento] = useState({
    title: '',
    subtitle: '',
    icon: 'star',
    color: 'primary',
    link: ''
  });
  const [showAddVoucherModal, setShowAddVoucherModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [newVoucher, setNewVoucher] = useState({
    code: '',
    title: '',
    type: 'FREE_DELIVERY',
    value: 0,
    minOrder: 0,
    expiryDays: 30,
    active: true
  });
  const [isSavingUser, setIsSavingUser] = useState(false);

  const {
    pointsPerTenk, setPointsPerTenk,
    pointsToRedeem, setPointsToRedeem,
    bentoPromos, setBentoPromos,
    vouchers, setVouchers
  } = useAdminStore();

  useEffect(() => {
    const unsubPricing = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.pointsPerTenk !== undefined) setPointsPerTenk(data.pointsPerTenk);
        if (data.pointsToRedeem !== undefined) setPointsToRedeem(data.pointsToRedeem);
      }
    });
    const unsubPlatform = onSnapshot(doc(db, 'settings', 'platform'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBentoPromos(data.bentoPromos || []);
        setVouchers(data.vouchers || []);
      }
    });
    return () => { unsubPricing(); unsubPlatform(); };
  }, []);

  const handleSaveBento = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      let newList;
      if (editingBento !== null) {
        newList = [...bentoPromos];
        newList[editingBento] = newBento;
      } else {
        newList = [...bentoPromos, newBento];
      }
      
      await updateDoc(doc(db, 'settings', 'platform'), {
        bentoPromos: newList
      });
      
      setShowAddBentoModal(false);
      alert('Bento Promo Berhasil Disimpan!');
    } catch (err) {
      console.error(err);
      alert('Gagal simpan bento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVoucher = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      let newList;
      if (editingVoucher !== null) {
        newList = [...vouchers];
        newList[editingVoucher] = newVoucher;
      } else {
        newList = [...vouchers, { ...newVoucher, id: Date.now().toString() }];
      }
      
      await updateDoc(doc(db, 'settings', 'platform'), {
        vouchers: newList
      });
      
      setShowAddVoucherModal(false);
      alert('Template Voucher Berhasil Disimpan!');
    } catch (err) {
      console.error(err);
      alert('Gagal simpan voucher: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucher = async (index) => {
    if (!window.confirm('Hapus template voucher ini?')) return;
    try {
      setLoading(true);
      const newList = vouchers.filter((_, i) => i !== index);
      await updateDoc(doc(db, 'settings', 'platform'), {
        vouchers: newList
      });
      alert('Voucher berhasil dihapus');
    } catch (err) {
      console.error(err);
      alert('Gagal hapus voucher: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       {/* Loyalty & Points Section */}
       <div className="bg-surface-container-low rounded-3xl p-8 space-y-8 border border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase">Program Loyalty</h3>
            <p className="text-sm text-on-surface-variant font-medium">Atur bagi hasil admin dan poin member</p>
          </div>
          <span className="material-symbols-outlined text-primary text-4xl">loyalty</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-[#f3ffca]">Dapat 1 Poin Setiap Belanja (Rp)</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-primary font-bold">1 Poin / </span>
              </div>
              <input 
                type="number" 
                value={pointsPerTenk}
                onChange={(e) => setPointsPerTenk(Number(e.target.value))}
                className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-24 pr-4 text-on-surface font-bold focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-[#f3ffca]">Poin Dibutuhkan Untuk Voucher</label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <span className="text-primary font-bold">Poin</span>
              </div>
              <input 
                type="number" 
                value={pointsToRedeem}
                onChange={(e) => setPointsToRedeem(Number(e.target.value))}
                className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-4 pr-16 text-on-surface font-bold focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <button 
            onClick={async () => {
              try {
                const settingsRef = doc(db, 'settings', 'platform');
                await setDoc(settingsRef, {
                  pointsPerTenk,
                  pointsToRedeem
                }, { merge: true });
                alert('Settings Loyalty Berhasil Disimpan!');
              } catch (err) {
                console.error(err);
                alert('Gagal simpan settings: ' + err.message);
              }
            }}
            className="kinetic-gradient bg-primary text-black font-black px-8 py-4 rounded-2xl active:scale-95 transition-all shadow-xl shadow-primary/20 uppercase tracking-widest text-sm"
          >
            Simpan Settings Loyalty
          </button>
        </div>
      </div>

      {/* Bento Promos Section */}
      <div className="bg-surface-container-low rounded-3xl p-8 space-y-8 border border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase">Bento Promo Grid</h3>
            <p className="text-sm text-on-surface-variant font-medium">Kelola kotak promo yang tampil di home user</p>
          </div>
          <button 
            onClick={() => {
              setNewBento({ title: '', subtitle: '', icon: 'star', color: 'primary', link: '' });
              setEditingBento(null);
              setShowAddBentoModal(true);
            }}
            className="bg-primary text-black font-black px-6 py-3 rounded-xl flex items-center gap-2 hover:shadow-lg active:scale-95 transition-all text-[10px] uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Tambah Bento
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bentoPromos.map((promo, idx) => promo && (
            <div key={idx} className="bg-surface-container-highest/30 rounded-2xl p-6 border border-white/5 group relative overflow-hidden">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setEditingBento(idx);
                    setNewBento(promo);
                    setShowAddBentoModal(true);
                  }}
                  className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                <button 
                  onClick={async () => {
                    if (!window.confirm('Hapus promo ini?')) return;
                    const newList = bentoPromos.filter((_, i) => i !== idx);
                    try {
                      await updateDoc(doc(db, 'settings', 'platform'), { bentoPromos: newList });
                      alert('Promo dihapus!');
                    } catch (e) { alert(e.message); }
                  }}
                  className="w-8 h-8 bg-error/10 text-error rounded-full flex items-center justify-center hover:bg-error hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>

              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className={`text-${promo.color} text-[10px] font-black tracking-widest uppercase`}>{promo.subtitle}</p>
                  <h4 className="text-lg font-bold text-white whitespace-pre-line">{promo.title}</h4>
                  {promo.link && (
                    <p className="text-[9px] text-on-surface-variant font-medium mt-2 italic">Link: {promo.link}</p>
                  )}
                </div>
                <span className={`material-symbols-outlined text-4xl text-${promo.color}/30`}>{promo.icon}</span>
              </div>
            </div>
          ))}
          {bentoPromos.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-white/5 rounded-3xl">
              <span className="material-symbols-outlined text-4xl mb-2">grid_view</span>
              <p className="text-xs font-bold uppercase tracking-widest">Belum ada promo bento</p>
            </div>
          )}
        </div>
      </div>

      {/* Vouchers & Discounts Section */}
      <div className="bg-surface-container-low rounded-3xl p-8 space-y-8 border border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">Voucher Templates</h3>
            <p className="text-sm text-on-surface-variant font-medium">Kelola template voucher yang bisa dibagikan ke user</p>
          </div>
          <button 
            onClick={() => {
              setNewVoucher({
                code: '',
                title: '',
                type: 'FREE_DELIVERY',
                value: 0,
                minOrder: 0,
                expiryDays: 30,
                active: true
              });
              setEditingVoucher(null);
              setShowAddVoucherModal(true);
            }}
            className=" kinetic-gradient bg-secondary text-black font-black px-6 py-3 rounded-xl flex items-center gap-2 hover:shadow-lg active:scale-95 transition-all text-[10px] uppercase tracking-widest"
          >
            <span className="material-symbols-outlined text-sm">confirmation_number</span>
            Buat Voucher Baru
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vouchers.map((v, idx) => v && (
            <div key={idx} className="bg-surface-container-highest/30 rounded-2xl p-6 border border-white/5 group relative overflow-hidden">
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setEditingVoucher(idx);
                    setNewVoucher(v);
                    setShowAddVoucherModal(true);
                  }}
                  className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                <button 
                  onClick={() => handleDeleteVoucher(idx)}
                  className="w-8 h-8 bg-error/10 text-error rounded-full flex items-center justify-center hover:bg-error hover:text-white transition-all"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary">local_activity</span>
                </div>
                <div>
                  <p className="text-xs font-black text-white">{v.code || 'NO CODE'}</p>
                  <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">{(v.type || 'FREE_DELIVERY').replace('_', ' ')}</p>
                </div>
              </div>

              <h4 className="text-lg font-bold text-white mb-2">{v.title || 'Voucher Tanpa Judul'}</h4>
              
              <div className="flex flex-wrap gap-2 mt-4">
                <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                  <p className="text-[8px] text-on-surface-variant font-black uppercase">Min. Order</p>
                  <p className="text-xs font-bold text-white">Rp {(v.minOrder || 0).toLocaleString()}</p>
                </div>
                <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                  <p className="text-[8px] text-on-surface-variant font-black uppercase">Expiry</p>
                  <p className="text-xs font-bold text-white">{v.expiryDays || 30} Hari</p>
                </div>
                {(v.value || 0) > 0 && (
                  <div className="px-3 py-1 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-[8px] text-primary font-black uppercase">Value</p>
                    <p className="text-xs font-bold text-primary">{v.type === 'PERCENTAGE' ? `${v.value}%` : `Rp ${(v.value || 0).toLocaleString()}`}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
          {vouchers.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-white/5 rounded-3xl">
              <span className="material-symbols-outlined text-4xl mb-2">confirmation_number</span>
              <p className="text-xs font-bold uppercase tracking-widest">Belum ada template voucher</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Voucher Modal */}
      {showAddVoucherModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddVoucherModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-white/5 flex justify-between items-start flex-shrink-0">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">{editingVoucher !== null ? 'Edit Voucher' : 'Buat Voucher Baru'}</h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Template Promosi Platform</p>
              </div>
              <button onClick={() => setShowAddVoucherModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white">close</span></button>
            </div>

            <form onSubmit={handleSaveVoucher} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Kode Voucher (Opsional)</label>
                  <input type="text" value={newVoucher.code} onChange={e => setNewVoucher({...newVoucher, code: e.target.value.toUpperCase()})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="PROMO2024" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tipe Diskon</label>
                  <select value={newVoucher.type} onChange={e => setNewVoucher({...newVoucher, type: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white appearance-none">
                    <option value="FREE_DELIVERY">Gratis Ongkir</option>
                    <option value="PERCENTAGE">Persentase (%)</option>
                    <option value="FLAT">Potongan Harga (Rp)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Judul Voucher</label>
                <input required type="text" value={newVoucher.title} onChange={e => setNewVoucher({...newVoucher, title: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Potongan Spesial 10rb" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nilai Diskon</label>
                  <input required type="number" value={newVoucher.value} onChange={e => setNewVoucher({...newVoucher, value: Number(e.target.value)})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min. Order (Rp)</label>
                  <input required type="number" value={newVoucher.minOrder} onChange={e => setNewVoucher({...newVoucher, minOrder: Number(e.target.value)})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Masa Berlaku (Hari)</label>
                  <input required type="number" value={newVoucher.expiryDays} onChange={e => setNewVoucher({...newVoucher, expiryDays: Number(e.target.value)})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input type="checkbox" checked={newVoucher.active} onChange={e => setNewVoucher({...newVoucher, active: e.target.checked})} className="w-5 h-5 rounded bg-surface-container-highest border-none text-primary focus:ring-0" />
                  <label className="text-xs font-bold text-white uppercase tracking-widest">Aktif</label>
                </div>
              </div>

              <div className="pt-6">
                <button disabled={loading} type="submit" className="w-full kinetic-gradient bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                  {loading ? 'Menyimpan...' : 'Simpan Template Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Bento Modal */}
      {showAddBentoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddBentoModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-white/5 flex justify-between items-start flex-shrink-0">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">{editingBento !== null ? 'Edit Bento Promo' : 'Tambah Bento Promo'}</h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Grid Promo Home User</p>
              </div>
              <button onClick={() => setShowAddBentoModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white">close</span></button>
            </div>

            <form onSubmit={handleSaveBento} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Judul Utama</label>
                <input required type="text" value={newBento.title} onChange={e => setNewBento({...newBento, title: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Contoh: Diskon Makan Siang" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Subtitle (Atas)</label>
                <input required type="text" value={newBento.subtitle} onChange={e => setNewBento({...newBento, subtitle: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Contoh: HEMAT 50%" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Icon (Material Symbol)</label>
                  <input required type="text" value={newBento.icon} onChange={e => setNewBento({...newBento, icon: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="star, restaurant, etc" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Warna Tema</label>
                  <select value={newBento.color} onChange={e => setNewBento({...newBento, color: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white appearance-none">
                    <option value="primary">Neon Lime (Primary)</option>
                    <option value="secondary">Soft Yellow (Secondary)</option>
                    <option value="error">Bright Red (Error)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Deep Link (Optional)</label>
                <input type="text" value={newBento.link} onChange={e => setNewBento({...newBento, link: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="/promo/detail-123" />
              </div>

              <div className="pt-6">
                <button disabled={loading} type="submit" className="w-full bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                  {loading ? 'Menyimpan...' : 'Simpan Bento Promo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PromotionManagement;
