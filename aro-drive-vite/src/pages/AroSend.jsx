import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';

function AroSend() {
  const navigate = useNavigate();
  const { sendPickup, sendDropoff, setSendPickup, setSendDropoff } = useOrderStore();
  const { savedAddresses } = useUserStore();

  const handlePickLocation = (mode) => {
    navigate(`/location-picker?mode=${mode}`);
  };

  const handleSwap = () => {
    const temp = sendPickup;
    setSendPickup(sendDropoff);
    setSendDropoff(temp);
  };

  const handleQuickAddress = (addr) => {
    // Fill the destination
    setSendDropoff({
      address: addr.address,
      lat: addr.lat,
      lng: addr.lng
    });
  };

  const isReadyToContinue = sendPickup?.lat && sendDropoff?.lat;

  return (
    <div className="bg-background min-h-screen text-on-background font-body relative pb-32">
      {/* Header & Hero Section */}
      <div className="bg-gradient-to-b from-primary-container/80 to-background pt-6 pb-24 px-6 relative overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <button onClick={() => navigate('/')} className="w-10 h-10 bg-surface/50 backdrop-blur-sm rounded-full flex items-center justify-center text-on-surface shadow-sm border border-outline/50 hover:bg-surface/80 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline font-black text-xl tracking-tight text-primary uppercase italic">Aro Send</h1>
          <div className="ml-auto w-10 h-10 bg-surface/50 backdrop-blur-sm rounded-full flex items-center justify-center text-on-surface shadow-sm border border-outline/50 cursor-pointer">
            <span className="material-symbols-outlined">receipt_long</span>
          </div>
        </div>

        {/* Hero Text */}
        <div className="relative z-10 space-y-1">
          <h2 className="text-2xl font-headline font-extrabold text-on-surface">Kirim apa saja</h2>
          <p className="text-sm font-medium text-on-surface-variant">Diskon s.d. 5rb</p>
        </div>

        {/* Hero Illustration */}
        <div className="absolute right-0 top-16 w-32 h-32 opacity-80 pointer-events-none">
          <span className="material-symbols-outlined text-[100px] text-primary/30">package_2</span>
        </div>
      </div>

      {/* Main Content Area (Pulled up to overlap hero) */}
      <main className="px-6 -mt-16 space-y-8 relative z-20">

        {/* Route Card */}
        <div className="bg-surface-container-highest rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-outline/30 relative">

          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center mt-1.5 gap-1 w-6">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
              </div>
              <div className="w-[2px] h-8 bg-outline-variant/50"></div>
              <div className="w-5 h-5 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500 text-lg">location_on</span>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div
                className="pb-3 border-b border-outline-variant/30 cursor-pointer group"
                onClick={() => handlePickLocation('sendPickup')}
              >
                <p className={`font-bold text-base line-clamp-1 group-hover:text-primary transition-colors ${sendPickup ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                  {sendPickup ? sendPickup.address : 'Lokasi Jemput?'}
                </p>
              </div>
              <div
                className="cursor-pointer group"
                onClick={() => handlePickLocation('sendDropoff')}
              >
                <p className={`font-bold text-base line-clamp-1 group-hover:text-primary transition-colors ${sendDropoff ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                  {sendDropoff ? sendDropoff.address : 'Antar ke?'}
                </p>
              </div>
            </div>

            <button
              onClick={handleSwap}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-surface rounded-full flex items-center justify-center text-on-surface-variant shadow-md border border-outline hover:text-primary transition-colors active:scale-95"
            >
              <span className="material-symbols-outlined">swap_vert</span>
            </button>
          </div>
        </div>

        {/* Quick Address Pills */}
        {savedAddresses && savedAddresses.length > 0 && (
          <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-6 px-6 snap-x">
            {savedAddresses.map(addr => (
              <button
                key={addr.id}
                onClick={() => handleQuickAddress(addr)}
                className="snap-start shrink-0 bg-surface-container py-2.5 px-4 rounded-2xl border border-outline hover:border-primary/50 transition-all flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                    {addr.label?.toLowerCase() === 'rumah' ? 'home' : addr.label?.toLowerCase() === 'kantor' ? 'work' : 'push_pin'}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-on-surface-variant">Kirim ke</p>
                  <p className="text-xs font-bold text-on-surface">{addr.label}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Promo Section */}
        <section>
          <h3 className="font-headline font-bold text-base mb-3 text-on-surface">Hemat biaya pengantaran</h3>
          <div className="bg-surface-container-highest p-4 rounded-3xl border border-outline flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center shrink-0 border border-green-500/30">
              <span className="material-symbols-outlined text-green-500 text-3xl">local_offer</span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-on-surface">Gunakan Terus Aro Drive</h4>
              <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">Dapatkan voucher promo menarik! Goodbye Nebak Ongkir!</p>
            </div>
          </div>
        </section>

        {/* Intip Juga Section */}
        <section>
          <h3 className="font-headline font-bold text-base mb-3 text-on-surface">Intip juga</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#fff9e6] dark:bg-[#fff9e6]/10 p-4 rounded-3xl relative overflow-hidden group cursor-pointer" onClick={() => navigate('/ride')}>
              <div className="relative z-10">
                <h4 className="font-bold text-sm text-[#8a6d00] dark:text-[#ffeea5]">Aro Ride</h4>
                <p className="text-[10px] text-[#8a6d00]/70 dark:text-[#ffeea5]/70 mt-1">Perjalanan aman & nyaman</p>
              </div>
              <span className="material-symbols-outlined absolute -bottom-2 -right-2 text-[60px] text-[#8a6d00]/20 dark:text-[#ffeea5]/20 group-hover:scale-110 transition-transform">directions_car</span>
            </div>

            <div className="bg-[#f0e6ff] dark:bg-[#f0e6ff]/10 p-4 rounded-3xl relative overflow-hidden group cursor-pointer" onClick={() => navigate('/food')}>
              <div className="relative z-10">
                <h4 className="font-bold text-sm text-[#5a2a9b] dark:text-[#d0b3ff]">Aro Food</h4>
                <p className="text-[10px] text-[#5a2a9b]/70 dark:text-[#d0b3ff]/70 mt-1">Pesan makanan favorit</p>
              </div>
              <span className="material-symbols-outlined absolute -bottom-2 -right-2 text-[60px] text-[#5a2a9b]/20 dark:text-[#d0b3ff]/20 group-hover:scale-110 transition-transform">restaurant</span>
            </div>

            <div className="bg-[#e6f4ff] dark:bg-[#e6f4ff]/10 p-4 rounded-3xl relative overflow-hidden group cursor-pointer" onClick={() => navigate('/send')}>
              <div className="relative z-10">
                <h4 className="font-bold text-sm text-[#005a9e] dark:text-[#a5d6ff]">Aro Send</h4>
                <p className="text-[10px] text-[#005a9e]/70 dark:text-[#a5d6ff]/70 mt-1">Kirim barang cepat</p>
              </div>
              <span className="material-symbols-outlined absolute -bottom-2 -right-2 text-[60px] text-[#005a9e]/20 dark:text-[#a5d6ff]/20 group-hover:scale-110 transition-transform">local_shipping</span>
            </div>

            <div className="bg-[#ffe6eb] dark:bg-[#ffe6eb]/10 p-4 rounded-3xl relative overflow-hidden group cursor-pointer">
              <div className="relative z-10">
                <div className="flex gap-2 items-center">
                  <h4 className="font-bold text-sm text-[#9e002b] dark:text-[#ffa5b9]">Aro Car</h4>
                  <span className="text-[8px] bg-[#9e002b] text-on-background dark:bg-[#ffa5b9] dark:text-black px-1.5 py-0.5 rounded-full font-bold">SOON</span>
                </div>
                <p className="text-[10px] text-[#9e002b]/70 dark:text-[#ffa5b9]/70 mt-1">Sewa mobil + driver</p>
              </div>
              <span className="material-symbols-outlined absolute -bottom-2 -right-2 text-[60px] text-[#9e002b]/20 dark:text-[#ffa5b9]/20 group-hover:scale-110 transition-transform">car_rental</span>
            </div>
          </div>
        </section>

      </main>

      {/* Floating Action Button for Next Step */}
      {isReadyToContinue && (
        <div className="fixed bottom-0 left-0 w-full z-50 p-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <button
            onClick={() => navigate('/send/details')}
            className="w-full bg-primary text-primary-fg font-headline font-extrabold text-lg py-4 rounded-full shadow-[0_8px_30px_rgb(var(--primary)/0.3)] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
          >
            Lanjut Isi Detail
            <span className="material-symbols-outlined font-bold">arrow_forward</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default AroSend;
