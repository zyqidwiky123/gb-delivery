export default function NoDriverModal({ show, onClose, onRetry, adminWhatsApp }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[2001] bg-background/95 backdrop-blur-xl flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface rounded-[2.5rem] border border-outline shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-orange-400 to-red-600" />

        <div className="p-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-[2rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.15)] rotate-3">
                <span className="material-symbols-outlined text-red-400 text-5xl">
                  sentiment_dissatisfied
                </span>
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-on-background text-[12px]">
                  close
                </span>
              </div>
            </div>

            <div className="text-center">
              <h2 className="font-headline font-black text-2xl text-on-surface italic uppercase tracking-tight">
                Driver Tidak Tersedia
              </h2>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 mt-1">
                Tidak ada mitra di area kamu
              </p>
            </div>
          </div>

          <div className="bg-surface-container rounded-2xl border border-outline p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-none mt-0.5">
                <span className="material-symbols-outlined text-orange-400 text-sm">info</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Semua driver mitra ARO DRIVE sedang sibuk atau belum ada driver yang tersedia di
                area kamu saat ini.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-none mt-0.5">
                <span className="material-symbols-outlined text-primary text-sm">schedule</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Pesanan ini dibatalkan otomatis. Coba lagi beberapa menit ke depan.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onRetry}
              className="w-full py-4 bg-primary text-primary-fg font-headline font-black rounded-2xl uppercase tracking-[0.2em] text-sm active:scale-95 transition-all shadow-[0_8px_24px_rgb(var(--primary)/0.2)] flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Pesan Ulang
            </button>

            <button
              onClick={() => {
                const wa = adminWhatsApp || '6285157517798';
                const msg = encodeURIComponent(
                  'Halo Admin ARO DRIVE, saya tidak dapat menemukan driver. Mohon bantuan 🙏'
                );
                window.open(`https://wa.me/${wa}?text=${msg}`, '_blank');
              }}
              className="w-full py-4 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 font-headline font-black rounded-2xl uppercase tracking-[0.2em] text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">chat</span>
              Hubungi Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
