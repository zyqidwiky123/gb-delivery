export default function DriverInfoCard({ driverProfile, order, onContactDriver }) {
  const isSearching = order?.status === 'searching';

  return (
    <div className="flex items-center justify-between mb-4 bg-on-surface/[0.03] p-3 rounded-2xl border border-outline backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-12 h-12 rounded-2xl bg-surface-container-highest border border-outline overflow-hidden shadow-xl relative z-10">
            <img
              src={
                driverProfile?.photoUrl ||
                order?.driver?.photoUrl ||
                'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop&q=80'
              }
              alt="Driver"
              className="w-full h-full object-cover"
            />
          </div>
          {!isSearching && (
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-[#131313] rounded-full z-20"></div>
          )}
        </div>

        <div className="flex flex-col">
          <h3 className="font-headline font-black text-base text-on-surface tracking-tight leading-none uppercase italic">
            {driverProfile?.name || order?.driver?.name || (isSearching ? 'Mencari...' : 'Driver')}
          </h3>

          {!isSearching && (
            <div className="flex gap-2 items-center mt-1">
              <span className="text-[9px] font-mono font-bold text-on-surface-variant">
                {driverProfile?.plateNumber || order?.driver?.plate || 'AG ---- ---'}
              </span>
              <div className="w-1 h-1 rounded-full bg-on-surface/10"></div>
              <span className="text-[9px] font-black uppercase text-primary tracking-widest">
                {driverProfile?.vehicleType || 'Motor'}
              </span>
            </div>
          )}
        </div>
      </div>

      {!isSearching && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContactDriver?.();
          }}
          className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center border border-[#25D366]/20 shadow-lg"
        >
          <span className="material-symbols-outlined text-[18px]">chat</span>
        </button>
      )}
    </div>
  );
}
