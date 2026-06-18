import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { getOptimizedImageUrl } from '../utils/imageUtils';

function Home() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { promoHeadline, defaultDeliveryTime, ui } = useAdminStore();
  const homeUI = ui.home || {
    joinMemberTitle: 'Join Member Sekarang!',
    joinMemberDesc: promoHeadline || 'Nikmati berbagai penawaran eksklusif.',
    registerBtn: 'Daftar Sekarang',
    rideLabel: 'ARO JEK',
    rideSub: 'Antar',
    foodLabel: 'ARO FOOD',
    foodSub: 'Lapar?',
    sendLabel: 'ARO SEND',
    sendSub: 'Kirim',
    shopLabel: 'ARO TIP',
    shopSub: 'Belanja',
    trendingLabel: 'Lagi Trending di Blitar',
    seeAll: 'Lihat Semua'
  };
  const [banners, setBanners] = useState([]);
  const [trendingMerchants, setTrendingMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const bannerRef = useRef(null);
  const isAutoScrolling = useRef(false);

  useEffect(() => {
    if (user) {
      navigate('/member', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        // Fetch Banners (Filtered for All or Guest)
        const bannerQuery = query(collection(db, 'banners'), where('active', '==', true), limit(6));
        const bannerSnap = await getDocs(bannerQuery);
        const allBanners = bannerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBanners(allBanners.filter(b => !b.targetAudience || b.targetAudience === 'all' || b.targetAudience === 'guest'));

        // Fetch Trending Merchants (Multiple)
        const merchantQuery = query(collection(db, 'merchants'), orderBy('reviewsCount', 'desc'), limit(10));
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

  useEffect(() => {
    if (banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        isAutoScrolling.current = true;
        return next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [banners.length]);

  useEffect(() => {
    if (bannerRef.current && isAutoScrolling.current) {
      const container = bannerRef.current;
      const scrollAmount = activeIndex * container.offsetWidth;
      container.scrollTo({
        left: scrollAmount,
        behavior: 'smooth'
      });
      
      // Reset flag setelah animasi selesai
      const timeout = setTimeout(() => {
        isAutoScrolling.current = false;
      }, 1000); 
      return () => clearTimeout(timeout);
    }
  }, [activeIndex]);

  const handleScroll = (e) => {
    if (isAutoScrolling.current) return;
    const container = e.target;
    const index = Math.round(container.scrollLeft / container.offsetWidth);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  return (
    <div className="bg-background text-on-background min-h-screen pb-20">
      <main className="max-w-xl mx-auto px-6 space-y-8 mt-6">
        {/* Registration Banner CTA */}
        <section className="relative overflow-hidden rounded-[2rem] bg-primary p-6 shadow-2xl">
          <div className="relative z-10 flex flex-col items-start gap-4">
            <div className="space-y-1">
              <span className="text-on-primary text-[10px] font-bold tracking-widest uppercase">Eksklusif Penawaran</span>
              <h2 className="text-on-primary font-plus-jakarta font-extrabold text-2xl leading-tight">{homeUI.joinMemberTitle}</h2>
              <p className="text-on-primary/80 text-sm max-w-[200px]">{homeUI.joinMemberDesc}</p>
            </div>
            <button 
              onClick={() => navigate('/register')}
              className="bg-surface text-primary px-6 py-2.5 rounded-full font-bold text-sm active:scale-95 transition-all shadow-lg"
            >
              {homeUI.registerBtn}
            </button>
          </div>
          <div className="absolute -right-4 -bottom-4 w-40 h-40 opacity-30">
            <span className="material-symbols-outlined text-[160px] text-on-primary">stars</span>
          </div>
        </section>

        {/* Main Service Grid (Bento Style) */}
        <section className="grid grid-cols-2 gap-4">
          <div 
            onClick={() => navigate('/food')}
            className="bg-surface-container shadow-sm rounded-[2rem] p-5 flex flex-col justify-between aspect-[1/0.85] active:scale-95 transition-transform cursor-pointer relative overflow-hidden group border border-outline/10"
          >
            <div className="z-10">
              <h3 className="font-plus-jakarta font-bold text-xl mt-2 tracking-tight text-on-surface">{homeUI.foodLabel}</h3>
            </div>
            <div className="z-10 bg-primary/10 w-fit px-3 py-1 rounded-full">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{homeUI.foodSub}</span>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform text-on-surface">
              <span className="material-symbols-outlined text-[80px]">restaurant</span>
            </div>
          </div>

        <div 
          onClick={() => navigate('/ride')}
          className="bg-surface-container shadow-sm rounded-[2rem] p-5 flex flex-col justify-between aspect-[1/0.85] active:scale-95 transition-transform cursor-pointer relative overflow-hidden group border border-outline/10"
        >
          <div className="z-10">
            <h3 className="font-plus-jakarta font-bold text-xl mt-2 tracking-tight text-on-surface">{homeUI.rideLabel}</h3>
          </div>
          <div className="z-10 bg-primary/10 w-fit px-3 py-1 rounded-full">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{homeUI.rideSub}</span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform text-on-surface">
            <span className="material-symbols-outlined text-[80px]">moped</span>
          </div>
        </div>

        <div 
          onClick={() => navigate('/send')}
          className="bg-surface-container shadow-sm rounded-[2rem] p-5 flex flex-col justify-between aspect-[1/0.85] active:scale-95 transition-transform cursor-pointer relative overflow-hidden group border border-outline/10"
        >
          <div className="z-10">
            <h3 className="font-plus-jakarta font-bold text-xl mt-2 tracking-tight text-on-surface">{homeUI.sendLabel}</h3>
          </div>
          <div className="z-10 bg-primary/10 w-fit px-3 py-1 rounded-full">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{homeUI.sendSub}</span>
          </div>
          <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform text-on-surface">
            <span className="material-symbols-outlined text-[80px]">package</span>
          </div>
        </div>

        <div 
          onClick={() => navigate('/shop')}
          className="bg-surface-container shadow-sm rounded-[2rem] p-5 flex flex-col justify-between aspect-[1/0.85] active:scale-95 transition-transform cursor-pointer relative overflow-hidden group border border-outline/10"
        >
          <div className="z-10">
            <h3 className="font-plus-jakarta font-bold text-xl mt-2 tracking-tight text-on-surface">{homeUI.shopLabel}</h3>
            </div>
            <div className="z-10 bg-primary/10 w-fit px-3 py-1 rounded-full">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">{homeUI.shopSub}</span>
            </div>
            <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform text-on-surface">
              <span className="material-symbols-outlined text-[80px]">shopping_bag</span>
            </div>
          </div>
        </section>

        {/* Promo Section: Promo Spesial Hari Ini */}
        {banners.length > 0 && (
          <section className="space-y-4">
              <div className="flex justify-center gap-1.5 pt-2">
                {banners.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeIndex === idx ? 'bg-primary w-4' : 'bg-outline/30'}`}
                  />
                ))}
              </div>
            
            <div 
              ref={bannerRef}
              onScroll={handleScroll}
              className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6 snap-x snap-mandatory"
            >
              {banners.map((banner, index) => (
                <div 
                  key={banner.id}
                  onClick={() => {
                    if (banner.link) {
                      if (banner.link.startsWith('http')) {
                        window.open(banner.link, '_blank');
                      } else {
                        navigate(banner.link);
                      }
                    }
                  }}
                  className="min-w-[90%] snap-center rounded-[2rem] overflow-hidden relative active:scale-[0.98] transition-transform cursor-pointer shadow-xl border border-outline/10"
                >
                  <img 
                    src={getOptimizedImageUrl(banner.imageUrl || banner.image, { width: 600, height: 300 })} 
                    alt={banner.title} 
                    className="w-full h-auto object-contain block" 
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Featured Section: Lagi Trending di Blitar (List of Best Merchants) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-plus-jakarta font-bold text-lg">{homeUI.trendingLabel}</h4>
            <span className="text-primary text-xs font-bold uppercase tracking-wider cursor-pointer" onClick={() => navigate('/food')}>{homeUI.seeAll}</span>
          </div>
          <div className="space-y-4">
            {trendingMerchants.length > 0 ? (
              trendingMerchants.map((merchant) => (
                <div 
                  key={merchant.id}
                  onClick={() => navigate('/food', { state: { openMerchant: merchant } })}
                  className="bg-surface-container-low rounded-[2rem] p-4 flex gap-4 items-center cursor-pointer active:scale-[0.98] transition-all hover:bg-surface-container-high border border-outline/10 hover:border-primary/20 shadow-sm"
                >
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                    <img 
                      alt={merchant.name} 
                      className="w-full h-full object-cover" 
                      src={getOptimizedImageUrl(merchant.image || merchant.photoUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=200&auto=format&fit=crop", { width: 200, height: 200 })} 
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
                        {merchant.deliveryTime || defaultDeliveryTime}
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
