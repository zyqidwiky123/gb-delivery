import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, updatePassword } from 'firebase/auth';
import { useAdminStore } from '../store/adminStore';

function PricingSettings() {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const {
    pricing, setServicePricing, setAllPricing,
    platformFeePercent, setPlatformFee,
    adminUser,
    pointsPerTenk, setPointsPerTenk,
    pointsToRedeem, setPointsToRedeem
  } = useAdminStore();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const pricingDoc = await getDoc(doc(db, "settings", "pricing"));
        if (pricingDoc.exists()) {
          setAllPricing(pricingDoc.data());
        }
        const platformDoc = await getDoc(doc(db, "settings", "platform"));
        if (platformDoc.exists()) {
          const data = platformDoc.data();
          setPlatformFee(data.platformFeePercent);
          setPointsPerTenk(data.pointsPerTenk);
          setPointsToRedeem(data.pointsToRedeem);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, [setAllPricing, setPlatformFee, setPointsPerTenk, setPointsToRedeem]);

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert("Isi kedua field password!");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Password tidak cocok!");
      return;
    }
    if (newPassword.length < 6) {
      alert("Password minimal 6 karakter!");
      return;
    }

    setPasswordLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, newPassword);
        alert("Password berhasil diperbarui!");
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert("Sesi berakhir, silakan login ulang.");
      }
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        alert("Sesi keamanan berakhir. Silakan Logout lalu Login kembali untuk mengganti password.");
      } else {
        alert("Gagal ganti password: " + error.message);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* SETTINGS SECTION */}
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-surface-container-low rounded-3xl p-8 space-y-8 border border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase">Pengaturan Akun</h3>
              <p className="text-sm text-on-surface-variant font-medium">Kelola keamanan akses dashboard admin</p>
            </div>
            <span className="material-symbols-outlined text-secondary text-4xl">manage_accounts</span>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email Admin</label>
              <div className="bg-surface-container-highest/50 p-4 rounded-2xl text-white font-bold border border-white/5">
                {adminUser?.email || 'Admin ARO-DRIVE'}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Password Baru</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-4 text-on-surface font-bold focus:ring-2 focus:ring-secondary transition-all"
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Konfirmasi Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-4 text-on-surface font-bold focus:ring-2 focus:ring-secondary transition-all"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex flex-wrap gap-4">
              <button
                onClick={handleUpdatePassword}
                disabled={passwordLoading}
                className="kinetic-gradient bg-secondary text-black font-black px-8 py-4 rounded-2xl active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-secondary/20 uppercase tracking-widest text-sm"
              >
                {passwordLoading ? 'Memproses...' : 'Ganti Password Sekarang'}
              </button>

              <button
                onClick={async () => {
                  try {
                    const auth = getAuth();
                    if (auth.currentUser?.email) {
                      alert("Fitur Bantuan Keamanan sedang disiapkan. Sementara pakai ganti password langsung di atas ya Bang.");
                    }
                  } catch (err) {}
                }}
                className="bg-white/5 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-[10px] border border-white/10"
              >
                Bantuan Keamanan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TARIF SECTION */}
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5">
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">Manajemen Tarif</h3>
            <p className="text-sm text-on-surface-variant font-medium">Atur biaya dasar dan tarif per KM</p>
          </div>
          <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl md:rounded-3xl flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl md:text-3xl">payments</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ARO JEK */}
          <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#f3ffca]/10 rounded-2xl flex items-center justify-center text-[#f3ffca]">
                <span className="material-symbols-outlined">moped</span>
              </div>
              <div>
                <h4 className="text-xl font-black text-white font-headline uppercase italic">Aro Jek</h4>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Layanan Transport Motor</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Dasar</label>
                  <input
                    type="number"
                    value={pricing?.jek?.baseFare || 0}
                    onChange={(e) => setServicePricing('jek', 'baseFare', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min Distance (KM)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={pricing?.jek?.minDistance || 0}
                    onChange={(e) => setServicePricing('jek', 'minDistance', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Per KM</label>
                  <input
                    type="number"
                    value={pricing?.jek?.ratePerKm || 0}
                    onChange={(e) => setServicePricing('jek', 'ratePerKm', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#f3ffca]">Bagi Hasil Admin (%)</label>
                  <input
                    type="number"
                    value={pricing?.jek?.commission || 0}
                    onChange={(e) => setServicePricing('jek', 'commission', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-primary font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ARO CAR */}
          <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">directions_car</span>
              </div>
              <div>
                <h4 className="text-xl font-black text-white font-headline uppercase italic">Aro Car</h4>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Layanan Transport Mobil</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Dasar</label>
                  <input
                    type="number"
                    value={pricing?.car?.baseFare || 0}
                    onChange={(e) => setServicePricing('car', 'baseFare', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min Distance (KM)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={pricing?.car?.minDistance || 0}
                    onChange={(e) => setServicePricing('car', 'minDistance', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Per KM</label>
                  <input
                    type="number"
                    value={pricing?.car?.ratePerKm || 0}
                    onChange={(e) => setServicePricing('car', 'ratePerKm', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Bagi Hasil Admin (%)</label>
                  <input
                    type="number"
                    value={pricing?.car?.commission || 0}
                    onChange={(e) => setServicePricing('car', 'commission', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-secondary font-bold focus:ring-2 focus:ring-secondary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ARO FOOD */}
          <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">restaurant</span>
              </div>
              <div>
                <h4 className="text-xl font-black text-white font-headline uppercase italic">Aro Food</h4>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Pengantaran Makanan</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Biaya Antar Dasar</label>
                  <input
                    type="number"
                    value={pricing?.food?.baseFare || 0}
                    onChange={(e) => setServicePricing('food', 'baseFare', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min Distance (KM)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={pricing?.food?.minDistance || 0}
                    onChange={(e) => setServicePricing('food', 'minDistance', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Per KM</label>
                  <input
                    type="number"
                    value={pricing?.food?.ratePerKm || 0}
                    onChange={(e) => setServicePricing('food', 'ratePerKm', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary">Bagi Hasil Admin (%)</label>
                  <input
                    type="number"
                    value={pricing?.food?.commission || 0}
                    onChange={(e) => setServicePricing('food', 'commission', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-primary font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ARO SEND */}
          <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined">package_2</span>
              </div>
              <div>
                <h4 className="text-xl font-black text-white font-headline uppercase italic">Aro Send</h4>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Kirim Barang / Paket</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Dasar</label>
                <input
                  type="number"
                  value={pricing?.send?.baseFare || 0}
                  onChange={(e) => setServicePricing('send', 'baseFare', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif /KM</label>
                <input
                  type="number"
                  value={pricing?.send?.ratePerKm || 0}
                  onChange={(e) => setServicePricing('send', 'ratePerKm', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Fee Admin (%)</label>
                <input
                  type="number"
                  value={pricing?.send?.commission || 0}
                  onChange={(e) => setServicePricing('send', 'commission', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-secondary font-bold focus:ring-2 focus:ring-secondary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min Distance (KM)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pricing?.send?.minDistance || 0}
                  onChange={(e) => setServicePricing('send', 'minDistance', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Biaya Berat (+ per 2KG)</label>
                <input
                  type="number"
                  value={pricing?.send?.weightFareRate || 0}
                  onChange={(e) => setServicePricing('send', 'weightFareRate', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* ARO SHOP (TIP) */}
          <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">shopping_cart</span>
              </div>
              <div>
                <h4 className="text-xl font-black text-white font-headline uppercase italic">Aro Tip</h4>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Belanja Titip / Jastip</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Biaya Jasa (Service Fee)</label>
                <input
                  type="number"
                  value={pricing?.tip?.serviceFee || 0}
                  onChange={(e) => setServicePricing('tip', 'serviceFee', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Per KM</label>
                <input
                  type="number"
                  value={pricing?.tip?.ratePerKm || 0}
                  onChange={(e) => setServicePricing('tip', 'ratePerKm', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Berat (Per 2 KG)</label>
                  <input
                    type="number"
                    value={pricing?.tip?.weightFareRate || 0}
                    onChange={(e) => setServicePricing('tip', 'weightFareRate', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-primary">Fee Admin (%)</label>
                  <input
                    type="number"
                    value={pricing?.tip?.commission || 0}
                    onChange={(e) => setServicePricing('tip', 'commission', Number(e.target.value))}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-primary font-bold focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BIAYA LAYANAN APLIKASI */}
          <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">settings_suggest</span>
              </div>
              <div>
                <h4 className="text-xl font-black text-white font-headline uppercase italic">Biaya Layanan</h4>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Biaya Platform (Per Jarak)</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Jarak per Blok (KM)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pricing?.appServiceFee?.blockDistance || 0}
                  onChange={(e) => setServicePricing('appServiceFee', 'blockDistance', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-on-surface-variant/60 italic">Contoh: 3 = per 3 KM</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Biaya per Blok (Rp)</label>
                <input
                  type="number"
                  value={pricing?.appServiceFee?.feePerBlock || 0}
                  onChange={(e) => setServicePricing('appServiceFee', 'feePerBlock', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-on-surface-variant/60 italic">Contoh: 1000 = Rp 1.000 per blok</p>
              </div>
            </div>
          </div>

          {/* BIAYA PENJEMPUTAN (PICKUP DISTANCE SURCHARGE) */}
          <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center text-yellow-500">
                <span className="material-symbols-outlined">map</span>
              </div>
              <div>
                <h4 className="text-xl font-black text-white font-headline uppercase italic">Biaya Penjemputan</h4>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Kompensasi Jarak Jemput Driver</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Radius Gratis Penjemputan (KM)</label>
                <input
                  type="number"
                  step="0.1"
                  value={pricing?.pickupSurcharge?.freePickupRadius ?? 3}
                  onChange={(e) => setServicePricing('pickupSurcharge', 'freePickupRadius', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-on-surface-variant/60 italic">Batas jarak jemput tanpa biaya tambahan (Contoh: 3 = 3 KM)</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif per KM Surcharge (Rp)</label>
                <input
                  type="number"
                  value={pricing?.pickupSurcharge?.ratePerKm ?? 2000}
                  onChange={(e) => setServicePricing('pickupSurcharge', 'ratePerKm', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-on-surface-variant/60 italic">Tarif tambahan per KM melebihi batas radius (Contoh: 2000 = Rp 2.000 / KM)</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Biaya Maksimal Surcharge (Rp)</label>
                <input
                  type="number"
                  value={pricing?.pickupSurcharge?.maxFee ?? 15000}
                  onChange={(e) => setServicePricing('pickupSurcharge', 'maxFee', Number(e.target.value))}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-on-surface-variant/60 italic">Batas atas total biaya penjemputan (Contoh: 15000 = Rp 15.000)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={async () => {
              try {
                setLoading(true);
                const pricingRef = doc(db, 'settings', 'pricing');
                await setDoc(pricingRef, pricing, { merge: true });
                alert('🔥 Berhasil! Semua tarif layanan sudah diperbarui.');
              } catch (err) {
                console.error(err);
                alert('Gagal simpan tarif ke database: ' + err.message);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full md:w-auto bg-primary text-black font-black px-12 py-5 rounded-2xl active:scale-95 transition-all shadow-2xl shadow-primary/30 uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3"
          >
            <span className="material-symbols-outlined">{loading ? 'sync' : 'done_all'}</span>
            {loading ? 'MENYIMPAN...' : 'SIMPAN SEMUA TARIF'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PricingSettings;
