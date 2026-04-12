import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

function MemberHome() {
  const navigate = useNavigate();
  const { user, loyaltyPoints } = useUserStore();
  const [trendingMerchants, setTrendingMerchants] = useState([]);
  const [heroBanner, setHeroBanner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMemberHomeData = async () => {
      try {
        // Fetch 1 Active Banner for Hero
        const bannerQuery = query(collection(db, 'banners'), where('active', '==', true), limit(1));
        const bannerSnap = await getDocs(bannerQuery);
        if (!bannerSnap.empty) {
          setHeroBanner({ id: bannerSnap.docs[0].id, ...bannerSnap.docs[0].data() });
        }

        // Fetch Top 5 Trending Merchants
        const merchantQuery = query(collection(db, 'merchants'), orderBy('rating', 'desc'), limit(5));
        const merchantSnap = await getDocs(merchantQuery);
        setTrendingMerchants(merchantSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching member home data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMemberHomeData();
  }, []);

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <main className="mt-6 max-w-xl mx-auto px-6 space-y-8">
        
        {/* Compact Loyalty Points Card */}
        <section 
          onClick={() => navigate('/profile')}
          className="bg-[#131313] p-5 rounded-[2rem] border border-primary/20 shadow-xl flex items-center justify-between group cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-black shadow-lg shadow-primary/20 group-hover:rotate-6 transition-transform">
              <span className="material-symbols-outlined font-black">loyalty</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Saldo Poin Anda</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-headline font-black text-white italic">{loyaltyPoints || 0}</span>
                <span className="text-[10px] font-bold text-primary">PTS</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 group-hover:bg-primary/10 transition-colors">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#f3ffca]">Cek Reward</span>
            <span className="material-symbols-outlined text-xs text-primary transition-transform group-hover:translate-x-1">arrow_forward</span>
          </div>
        </section>

        {/* Hero Promo Section */}
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-container to-secondary-fixed p-8 shadow-2xl">
          <div className="relative z-10 space-y-4 max-w-[60%]">
            <div className="inline-block bg-surface px-3 py-1 rounded-full">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Member Only</span>
            </div>
            <h2 className="font-headline text-4xl font-extrabold text-surface-container-lowest leading-[1.1] tracking-tighter">
              {heroBanner ? heroBanner.title : "Diskon Ongkir 50%!"}
            </h2>
            <button 
              onClick={() => heroBanner?.link && navigate(heroBanner.link)}
              className="bg-surface text-primary px-6 py-3 rounded-full font-headline font-bold text-sm active:scale-95 transition-transform shadow-lg"
            >
              Pake Sekarang
            </button>
          </div>
          {/* Decorative Element */}
          <div className="absolute -right-10 -bottom-10 w-48 h-48 opacity-20">
            <span className="material-symbols-outlined text-[12rem] text-surface">local_shipping</span>
          </div>
          {heroBanner?.image && (
            <img alt="Promo" className="absolute right-0 top-0 h-full w-1/2 object-cover mix-blend-overlay opacity-40" src={heroBanner.image} />
          )}
        </section>

        {/* Service Grid */}
        <section className="grid grid-cols-2 gap-4">
          <div 
            onClick={() => navigate('/food')}
            className="bg-surface-container-highest p-6 rounded-[2rem] flex flex-col justify-between min-h-[160px] active:scale-95 transition-all group border border-transparent hover:border-primary/20 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary-container/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-primary text-3xl">restaurant</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-xl tracking-tight text-white group-hover:text-primary transition-colors">🍔 ARO FOOD</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">Laper? Sini Makan</p>
            </div>
          </div>
          <div 
            onClick={() => navigate('/ride')}
            className="bg-surface-container-highest p-6 rounded-[2rem] flex flex-col justify-between min-h-[160px] active:scale-95 transition-all group border border-transparent hover:border-secondary/20 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-secondary text-3xl">moped</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-xl tracking-tight text-white group-hover:text-secondary transition-colors">🛵 ARO JEK</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">Gas Tipis-tipis</p>
            </div>
          </div>
          <div 
            onClick={() => navigate('/send')}
            className="bg-surface-container-highest p-6 rounded-[2rem] flex flex-col justify-between min-h-[160px] active:scale-95 transition-all group border border-transparent hover:border-primary-dim/20 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary-dim/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-primary-dim text-3xl">package_2</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-xl tracking-tight text-white group-hover:text-primary-dim transition-colors">📦 ARO SEND</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">Kirim Paket Satset</p>
            </div>
          </div>
          <div 
            onClick={() => navigate('/shop')}
            className="bg-surface-container-highest p-6 rounded-[2rem] flex flex-col justify-between min-h-[160px] active:scale-95 transition-all group border border-transparent hover:border-tertiary-fixed/20 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-tertiary-fixed/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-tertiary-fixed text-3xl">shopping_cart</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-xl tracking-tight text-white group-hover:text-tertiary-fixed transition-colors">🛒 ARO TIP (JASTIP)</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">Belanja Bulanan</p>
            </div>
          </div>
        </section>

        {/* Trending Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <h2 className="font-headline text-2xl font-extrabold tracking-tight">Lagi Trending</h2>
            <span className="text-primary text-xs font-bold uppercase tracking-widest">Lihat Semua</span>
          </div>
          <div className="flex overflow-x-auto gap-6 no-scrollbar -mx-6 px-6 pb-2">
            {trendingMerchants.length > 0 ? (
              trendingMerchants.map((merchant) => (
                <div 
                  key={merchant.id}
                  onClick={() => navigate(`/food/merchant/${merchant.id}`)}
                  className="flex-none w-[280px] space-y-3 cursor-pointer group"
                >
                  <div className="relative h-[180px] rounded-[1.5rem] overflow-hidden">
                    <img alt={merchant.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={merchant.photoUrl || "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=400&auto=format&fit=crop"} />
                    <div className="absolute top-3 right-3 bg-surface/80 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 shadow-md border border-white/5">
                      <span className="material-symbols-outlined text-primary text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-[10px] font-bold">{merchant.rating || 'New'}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-headline text-lg font-bold group-hover:text-primary transition-colors">{merchant.name}</h4>
                    <div className="flex items-center gap-2 text-on-surface-variant text-xs font-medium">
                      <span>{merchant.category} • {merchant.location?.address?.split(',')[0]}</span>
                      <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                      <span className="text-primary-container">Populer</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex gap-6">
                {[1, 2].map(i => (
                  <div key={i} className="flex-none w-[280px] h-[240px] bg-surface-container-highest rounded-[1.5rem] animate-pulse" />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Bento Promo Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
          <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 flex items-center justify-between group hover:border-primary-container/30 transition-colors">
            <div className="space-y-1">
              <p className="text-primary text-[10px] font-black tracking-[0.2em] uppercase">Voucher Khusus</p>
              <h3 className="font-headline text-xl font-bold text-white leading-tight">Makan Kenyang<br />Cuma Rp 15rb</h3>
            </div>
            <div className="w-20 h-20 rotate-12 group-hover:rotate-6 transition-transform">
              <span className="material-symbols-outlined text-primary-container text-[5rem] opacity-30">confirmation_number</span>
            </div>
          </div>
          <div className="bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 flex items-center justify-between group hover:border-secondary/30 transition-colors">
            <div className="space-y-1">
              <p className="text-secondary text-[10px] font-black tracking-[0.2em] uppercase">Flash Sale</p>
              <h3 className="font-headline text-xl font-bold text-white leading-tight">Gratis Ongkir<br />Semua Toko</h3>
            </div>
            <div className="w-20 h-20 -rotate-12 group-hover:-rotate-6 transition-transform">
              <span className="material-symbols-outlined text-secondary text-[5rem] opacity-30">bolt</span>
            </div>
          </div>
        </section>
      </main>

      {/* Speed-Dial Order Button */}
      <div className="fixed right-0 bottom-24 w-full z-40 pointer-events-none">
        <div className="max-w-xl mx-auto relative h-full">
          <button 
            onClick={() => navigate('/food')}
            className="absolute right-6 w-14 h-14 bg-primary rounded-full shadow-[0_8px_16px_rgba(202,253,0,0.2)] flex items-center justify-center text-surface-container-lowest active:scale-95 duration-200 border-4 border-surface pointer-events-auto hover:bg-primary-dim transition-colors"
          >
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>reorder</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MemberHome;
