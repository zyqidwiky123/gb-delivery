import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';

function AdminSettings() {
  const navigate = useNavigate();
  const { baseFare, ratePerKm, weightFareRate, serviceFeePercent, updatePricing, isLoading } = useAdminStore();
  
  const [newBaseFare, setNewBaseFare] = useState(baseFare);
  const [newRatePerKm, setNewRatePerKm] = useState(ratePerKm);
  const [newWeightFareRate, setNewWeightFareRate] = useState(weightFareRate);
  const [newServiceFeePercent, setNewServiceFeePercent] = useState(serviceFeePercent);
  const [saved, setSaved] = useState(false);

  // Sync local state when store values change (from Firestore)
  useEffect(() => {
    setNewBaseFare(baseFare);
    setNewRatePerKm(ratePerKm);
    setNewWeightFareRate(weightFareRate);
    setNewServiceFeePercent(serviceFeePercent);
  }, [baseFare, ratePerKm, weightFareRate, serviceFeePercent]);

  const handleSave = async () => {
    try {
      await updatePricing(
        Number(newBaseFare), 
        Number(newRatePerKm), 
        Number(newServiceFeePercent),
        Number(newWeightFareRate)
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert("Gagal menyimpan data ke database. Pastikan Anda punya akses Admin.");
    }
  };


  return (
    <div className="flex min-h-screen bg-[#080808] text-white font-body">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#111] border-r border-white/5 hidden md:flex flex-col">
        <div className="p-8">
           <h1 className="font-['Plus_Jakarta_Sans'] font-black text-2xl italic text-primary tracking-tighter">ARO ADMIN</h1>
        </div>
        
        <nav className="flex-grow px-4 space-y-2">
           <Link to="/admin" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">dashboard</span>
              <span className="font-bold text-sm">Dashboard</span>
           </Link>
           <Link to="/admin/orders" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-white/5 hover:text-white transition-all">
              <span className="material-symbols-outlined text-xl">list_alt</span>
              <span className="font-bold text-sm">Semua Pesanan</span>
           </Link>
           <Link to="/admin/settings" className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 text-primary group border border-primary/20">
              <span className="material-symbols-outlined text-xl">settings</span>
              <span className="font-bold text-sm">Pengaturan Tarif</span>
           </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-8 md:p-12 overflow-y-auto">
        <header className="mb-12">
            <h2 className="text-3xl font-headline font-black italic tracking-tight mb-1 uppercase">Pengaturan Tarif Sistem</h2>
            <p className="text-zinc-500 text-sm font-medium">Ubah logika biaya layanan secara global dari sini.</p>
        </header>

        <section className="max-w-2xl bg-[#111] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-8">
           <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                 <h3 className="text-sm font-black uppercase tracking-widest text-[#f3ffca]">Parameter Tarif Dasar</h3>
                 <span className="material-symbols-outlined text-zinc-600">help</span>
              </div>
              <div className="relative group">
                 <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <span className="text-zinc-500 font-bold text-sm tracking-widest">Rp</span>
                 </div>
                 <input 
                    type="number" 
                    value={newBaseFare} 
                    onChange={e => setNewBaseFare(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-3xl py-6 pl-14 pr-6 font-headline font-black text-2xl italic text-white focus:border-primary/50 focus:ring-0 transition-all" 
                    placeholder="10000"
                 />
              </div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2 leading-relaxed">Dikenakan untuk 3.5 KM pertama perjalanan.</p>
           </div>

           <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center px-2">
                 <h3 className="text-sm font-black uppercase tracking-widest text-[#f3ffca]">Tarif Tambahan / KM</h3>
                 <span className="material-symbols-outlined text-zinc-600">trending_up</span>
              </div>
              <div className="relative group">
                 <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <span className="text-zinc-500 font-bold text-sm tracking-widest">Rp</span>
                 </div>
                 <input 
                    type="number" 
                    value={newRatePerKm} 
                    onChange={e => setNewRatePerKm(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-3xl py-6 pl-14 pr-6 font-headline font-black text-2xl italic text-white focus:border-primary/50 focus:ring-0 transition-all" 
                    placeholder="2500"
                 />
              </div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2 leading-relaxed">Dikenakan untuk setiap kilometer tambahan setelah 3.5 KM pertama.</p>
           </div>

           <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center px-2">
                 <h3 className="text-sm font-black uppercase tracking-widest text-[#f3ffca]">Tarif Tambahan / 2 KG</h3>
                 <span className="material-symbols-outlined text-zinc-600">fitness_center</span>
              </div>
              <div className="relative group">
                 <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <span className="text-zinc-500 font-bold text-sm tracking-widest">Rp</span>
                 </div>
                 <input 
                    type="number" 
                    value={newWeightFareRate} 
                    onChange={e => setNewWeightFareRate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-3xl py-6 pl-14 pr-6 font-headline font-black text-2xl italic text-white focus:border-primary/50 focus:ring-0 transition-all" 
                    placeholder="2000"
                 />
              </div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2 leading-relaxed">Dikenakan untuk setiap kelipatan 2 KG setelah 1 KG pertama gratis.</p>
           </div>

           <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center px-2">
                 <h3 className="text-sm font-black uppercase tracking-widest text-[#f3ffca]">Biaya Layanan (%)</h3>
                 <span className="material-symbols-outlined text-zinc-600">percent</span>
              </div>
              <div className="relative group">
                 <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                    <span className="text-zinc-500 font-bold text-sm tracking-widest">%</span>
                 </div>
                 <input 
                    type="number" 
                    value={newServiceFeePercent} 
                    onChange={e => setNewServiceFeePercent(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-3xl py-6 pl-14 pr-6 font-headline font-black text-2xl italic text-white focus:border-primary/50 focus:ring-0 transition-all" 
                    placeholder="10"
                 />
              </div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest px-2 leading-relaxed">Persentase dari total biaya (Subtotal + Biaya Kirim) yang ditarifkan sebagai biaya operasional.</p>
           </div>

           <div className="pt-8 space-y-4">
              <button 
                onClick={handleSave}
                disabled={isLoading}
                className={`w-full kinetic-gradient py-6 rounded-3xl text-black font-headline font-black text-xl uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(202,253,0,0.2)] active:scale-95 transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'MENYIMPAN...' : 'SIMPAN PERUBAHAN'}
              </button>

              {saved && (
                <div className="flex items-center justify-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest animate-bounce px-2">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>Tarif berhasil diperbarui secara global</span>
                </div>
              )}
           </div>
        </section>

        {/* Live Preview */}
        <section className="max-w-2xl mt-8 bg-primary/5 p-8 rounded-[2rem] border border-primary/20">
           <h4 className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">calculate</span>
              Simulasi Biaya Baru
           </h4>
           <div className="flex justify-between items-center">
              <div>
                 <p className="text-xs text-white/60 font-bold">Simulasi 10 KM:</p>
                 <div className="space-y-1">
                   <p className="text-[10px] text-zinc-500 font-bold uppercase">Subtotal + Ongkir: Rp {(Number(newBaseFare) + (10 - 3.5) * Number(newRatePerKm)).toLocaleString()}</p>
                   <p className="text-[10px] text-zinc-500 font-bold uppercase">Biaya Layanan ({newServiceFeePercent}%): Rp {Math.round(((Number(newBaseFare) + (10 - 3.5) * Number(newRatePerKm)) * (Number(newServiceFeePercent) / 100)) / 1000) * 1000}</p>
                   <p className="text-xl font-headline font-black italic text-white">TOTAL: Rp {( (Number(newBaseFare) + (10 - 3.5) * Number(newRatePerKm)) + Math.round(((Number(newBaseFare) + (10 - 3.5) * Number(newRatePerKm)) * (Number(newServiceFeePercent) / 100)) / 1000) * 1000 ).toLocaleString()}</p>
                 </div>
              </div>
              <div className="bg-primary px-4 py-1.5 rounded-lg text-black font-black text-[10px] tracking-widest uppercase">
                 Tarif Aktif
              </div>
           </div>
        </section>
      </main>
    </div>
  );
}

export default AdminSettings;
