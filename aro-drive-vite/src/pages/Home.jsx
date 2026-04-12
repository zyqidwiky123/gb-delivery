import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

function Home() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [banners, setBanners] = useState([]);
  const [trendingMerchants, setTrendingMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (user) {
      navigate('/member', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        // Fetch Banners (kept in state but not rendered for now per user request)
        const bannerQuery = query(collection(db, 'banners'), where('active', '==', true), limit(3));
        const bannerSnap = await getDocs(bannerQuery);
        setBanners(bannerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch Trending Merchants (Multiple)
        const merchantQuery = query(collection(db, 'merchants'), orderBy('rating', 'desc'), limit(10));
        const merchantSnap = await getDocs(merchantQuery);
        setTrendingMerchants(merchantSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching home data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  return (
    <div className="bg-background text-on-background min-h-screen pb-20">
      <main className="max-w-xl mx-auto px-6 space-y-8 mt-6">
        {/* Registration Banner CTA */}
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-container to-primary-dim p-6 shadow-2xl">
          <div className="relative z-10 flex flex-col items-start gap-4">
            <div className="space-y-1">
              <span className="text-on-primary-container text-[10px] font-bold tracking-widest uppercase">Eksklusif Penawaran</span>
              <h2 className="text-on-primary-container font-plus-jakarta font-extrabold text-2xl leading-tight">Join Member Sekarang!</h2>
              <p className="text-on-primary-container/80 text-sm max-w-[200px]">Dapatkan gratis ongkir dan diskon 50% untuk pesanan pertamamu.</p>
            </div>
            <button 
              onClick={() => navigate('/register')}
              className="bg-background text-primary px-6 py-2.5 rounded-full font-bold text-sm active:scale-95 transition-all shadow-lg"
            >
              Daftar Sekarang
            </button>
          </div>
          <div className="absolute -right-4 -bottom-4 w-40 h-40 opacity-30">
            <span className="material-symbols-outlined text-[160px] text-on-primary-container">stars</span>
          </div>
        </section>

        {/* Main Service Grid (Bento Style) */}
        <section className="grid grid-cols-2 gap-4">
          <div 
            onClick={() => navigate('/food')}
            className="bg-surface-container-highest rounded-[2rem] p-5 flex flex-col justify-between aspect-square active:scale-95 transition-transform cursor-pointer relative overflow-hidden group"
          >
            <div className="z-10">
              <span className="text-3xl">🍔</span>
              <h3 className="font-plus-jakarta font-bold text-xl mt-2 tracking-tight">ARO FOOD</h3>
            </div>
            <div className="z-10 bg-primary/10 w-fit px-3 py-1 rounded-full">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Lapar?</span>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[80px]">restaurant</span>
            </div>
          </div>

          <div 
            onClick={() => navigate('/ride')}
            className="bg-surface-container-highest rounded-[2rem] p-5 flex flex-col justify-between aspect-square active:scale-95 transition-transform cursor-pointer relative overflow-hidden group"
          >
            <div className="z-10">
              <span className="text-3xl">🛵</span>
              <h3 className="font-plus-jakarta font-bold text-xl mt-2 tracking-tight">ARO JEK</h3>
            </div>
            <div className="z-10 bg-primary/10 w-fit px-3 py-1 rounded-full">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Antar</span>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[80px]">moped</span>
            </div>
          </div>

          <div 
            onClick={() => navigate('/send')}
            className="bg-surface-container-highest rounded-[2rem] p-5 flex flex-col justify-between aspect-square active:scale-95 transition-transform cursor-pointer relative overflow-hidden group"
          >
            <div className="z-10">
              <span className="text-3xl">📦</span>
              <h3 className="font-plus-jakarta font-bold text-xl mt-2 tracking-tight">ARO SEND</h3>
            </div>
            <div className="z-10 bg-primary/10 w-fit px-3 py-1 rounded-full">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Kirim</span>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[80px]">package</span>
            </div>
          </div>

          <div 
            onClick={() => navigate('/shop')}
            className="bg-surface-container-highest rounded-[2rem] p-5 flex flex-col justify-between aspect-square active:scale-95 transition-transform cursor-pointer relative overflow-hidden group"
          >
            <div className="z-10">
              <span className="text-3xl">🛒</span>
              <h3 className="font-plus-jakarta font-bold text-xl mt-2 tracking-tight">ARO TIP (JASTIP)</h3>
            </div>
            <div className="z-10 bg-primary/10 w-fit px-3 py-1 rounded-full">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Belanja</span>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[80px]">shopping_bag</span>
            </div>
          </div>
        </section>

        {/* 
          Temporary hidden per user request: Promo Spesial Hari Ini 
          UI and banners variable are preserved in code but not rendered.
        */}
        {/*
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-plus-jakarta font-bold text-lg">Promo Spesial Hari Ini</h4>
            <span className="text-primary text-xs font-bold uppercase tracking-wider">Lihat Semua</span>
          </div>
          ...
        </section>
        */}

        {/* Featured Section: Lagi Trending di Blitar (List of Best Merchants) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-plus-jakarta font-bold text-lg">Lagi Trending di Blitar</h4>
            <span className="text-primary text-xs font-bold uppercase tracking-wider" onClick={() => navigate('/food')}>Lihat Semua</span>
          </div>
          <div className="space-y-4">
            {trendingMerchants.length > 0 ? (
              trendingMerchants.map((merchant) => (
                <div 
                  key={merchant.id}
                  onClick={() => navigate(`/food/merchant/${merchant.id}`)}
                  className="bg-surface-container-low rounded-[2rem] p-4 flex gap-4 items-center cursor-pointer active:scale-[0.98] transition-all hover:bg-surface-container-high border border-transparent hover:border-primary/20"
                >
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                    <img 
                      alt={merchant.name} 
                      className="w-full h-full object-cover" 
                      src={merchant.photoUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=200&auto=format&fit=crop"} 
                      onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=200&auto=format&fit=crop"; }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h5 className="font-bold text-sm leading-tight max-w-[70%]">{merchant.name}</h5>
                      <div className="flex items-center gap-1 bg-surface-container-highest px-2 py-0.5 rounded-full flex-shrink-0">
                        <span className="material-symbols-outlined text-[12px] text-tertiary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        <span className="text-[10px] font-bold">{merchant.rating || 'New'}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-1.5 line-clamp-1">
                      {merchant.category} • {merchant.location?.address?.split(',')[0]}
                    </p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <span className="text-[9px] text-primary bg-primary/10 px-2 py-0.5 rounded font-black uppercase tracking-tighter shadow-sm">TERPOPULER</span>
                      <span className="text-[10px] text-on-surface-variant font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        15-20 min
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-surface-container-low rounded-[2rem] animate-pulse" />
              ))
            ) : (
              <div className="text-center py-8 opacity-50">
                <p className="text-sm">Belum ada merchant yang tersedia.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;
