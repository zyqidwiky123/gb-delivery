import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';

function SavedAddresses() {
  const navigate = useNavigate();
  const { savedAddresses, removeSavedAddress } = useUserStore();

  const handleAddAddress = () => {
    // Navigate to location picker with a special mode
    navigate('/location-picker?mode=saveUserAddress');
  };

  return (
    <div className="bg-background min-h-screen pb-40 text-white font-body">
      <header className="px-6 pt-8 pb-6 bg-surface-container-low border-b border-white/5 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-primary active:scale-95 transition-transform">
             <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline font-black text-xl italic uppercase tracking-tight text-primary">Alamat Tersimpan</h1>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 mt-8 space-y-6">
        <div className="space-y-4">
          {savedAddresses.length === 0 ? (
            <div className="text-center py-20 bg-surface-container-low rounded-[2.5rem] border border-dashed border-white/10">
               <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-primary text-3xl">home_pin</span>
               </div>
               <p className="text-sm text-on-surface-variant font-medium">Belum ada alamat yang disimpan.</p>
               <p className="text-[10px] uppercase font-bold tracking-widest text-[#f3ffca]/40 mt-1">Simpan Lokasi Rumah atau Kantor Anda</p>
            </div>
          ) : (
            savedAddresses.map(addr => (
              <div key={addr.id} className="bg-surface-container-low p-5 rounded-[2rem] border border-white/5 flex items-center justify-between group">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                    <span className="material-symbols-outlined">
                      {addr.label?.toLowerCase() === 'rumah' ? 'home' : addr.label?.toLowerCase() === 'kantor' ? 'work' : 'push_pin'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-white uppercase tracking-tight">{addr.label || 'Lokasi'}</h3>
                    <p className="text-xs text-on-surface-variant line-clamp-1 italic">{addr.address}</p>
                  </div>
                </div>
                <button 
                  onClick={() => removeSavedAddress(addr.id)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-error hover:bg-error/10 transition-all ml-2"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            ))
          )}
        </div>

        <button 
          onClick={handleAddAddress}
          className="w-full py-5 rounded-[2rem] bg-gradient-to-br from-[#cafd00] to-[#f3ffca] text-black font-headline font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
        >
          <span className="material-symbols-outlined font-black group-hover:rotate-90 transition-transform">add_circle</span>
          Tambah Alamat Baru
        </button>
      </main>

      <footer className="mt-12 px-8 text-center text-[10px] text-on-surface-variant/40 italic">
        * Alamat tersimpan memudahkan Anda menentukan titik jemput atau tujuan secara cepat.
      </footer>
    </div>
  );
}

export default SavedAddresses;
