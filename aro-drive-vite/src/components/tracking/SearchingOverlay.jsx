export default function SearchingOverlay({ order, onCancel }) {
  return (
    <div className="absolute inset-0 z-[1500] bg-background text-on-background flex flex-col justify-between p-6 overflow-hidden">
      <div className="absolute top-[-10%] left-[-20%] w-[300px] h-[300px] rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-20%] w-[300px] h-[300px] rounded-full bg-primary/5 blur-[100px] pointer-events-none" />

      <header className="flex justify-between items-center z-10 pt-4">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
          <span className="text-xs font-black tracking-[0.2em] uppercase text-primary">
            Mencari Driver Terdekat
          </span>
        </div>
        <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
          <span className="text-[9px] font-black text-primary uppercase tracking-widest animate-pulse">
            ARO-{order.serviceType?.toUpperCase()}
          </span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center z-10 my-8">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary/10 animate-ping duration-[3000ms]" />
          <div className="absolute inset-4 rounded-full border border-primary/20 animate-ping duration-[2000ms]" />
          <div className="absolute inset-8 rounded-full border border-primary/30 animate-pulse duration-[1500ms]" />
          <div
            className="absolute inset-0 rounded-full border border-primary/10 overflow-hidden animate-spin"
            style={{ animationDuration: '4s' }}
          >
            <div
              className="w-1/2 h-1/2 bg-gradient-to-tr from-primary/20 to-transparent origin-bottom-right"
              style={{
                position: 'absolute',
                right: '50%',
                bottom: '50%',
                transformOrigin: '100% 100%',
              }}
            />
          </div>
          <div className="w-32 h-32 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_50px_rgb(var(--primary)/0.15)] relative">
            <span className="material-symbols-outlined text-primary text-5xl animate-bounce">
              {order.serviceType === 'food'
                ? 'delivery_dining'
                : order.serviceType === 'ride'
                  ? 'directions_bike'
                  : 'package_2'}
            </span>
          </div>
        </div>

        <div className="text-center mt-8 space-y-2">
          <h2 className="font-headline font-black text-2xl text-on-background italic uppercase tracking-tight">
            Menghubungi Driver...
          </h2>
          <p className="text-xs text-[#A3A3A3] max-w-xs leading-relaxed animate-pulse">
            Memasangkan pesananmu dengan mitra ARO DRIVE di sekitar area penjemputan. Mohon tunggu
            sebentar.
          </p>
        </div>
      </div>

      <div className="z-10 space-y-4 pb-6">
        <div className="bg-surface/60 backdrop-blur-md p-5 rounded-[2rem] border border-on-background/5 space-y-3 shadow-2xl">
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-none mt-0.5 border border-primary/20">
              <span className="material-symbols-outlined text-primary text-xs">pin_drop</span>
            </div>
            <div className="flex-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-primary/60">
                Titik Jemput
              </p>
              <p className="text-xs font-bold text-on-background line-clamp-1">
                {order.pickupAddress || 'Lokasi Penjemputan'}
              </p>
            </div>
          </div>
          <div className="w-[1px] h-3 bg-primary/20 ml-3" />
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center flex-none mt-0.5 border border-red-500/20">
              <span className="material-symbols-outlined text-red-400 text-xs">location_on</span>
            </div>
            <div className="flex-1">
              <p className="text-[8px] font-black uppercase tracking-widest text-red-400/60">
                Tujuan
              </p>
              <p className="text-xs font-bold text-on-background line-clamp-1">
                {order.dropoffAddress || 'Lokasi Tujuan'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-headline font-black text-sm uppercase tracking-[0.2em] transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">cancel</span>
          Batalkan Pesanan
        </button>
      </div>
    </div>
  );
}
