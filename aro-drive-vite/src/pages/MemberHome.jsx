import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { getOptimizedImageUrl } from '../utils/imageUtils';

const PlaceholderImage = ({ name }) => (
  <div className="w-full h-full bg-gradient-to-br from-surface to-background flex justify-center items-center relative overflow-hidden group">
     <span className="text-6xl font-headline font-black on-surface/5 uppercase tracking-widest absolute">{String(name || '').substring(0, 3)}</span>
     <div className="absolute inset-0 bg-primary/5 transition-opacity group-hover:bg-primary/20" />
     <span className="material-symbols-outlined text-primary/20 text-4xl transform group-hover:scale-125 transition-transform duration-500">restaurant</span>
  </div>
);

function MemberHome() {
  const navigate = useNavigate();
  const { user, loyaltyPoints } = useUserStore();
  const { bentoPromos, defaultDeliveryTime } = useAdminStore();
  const [trendingMerchants, setTrendingMerchants] = useState([]);
  const [heroBanners, setHeroBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const bannerRef = useRef(null);
  const isAutoScrolling = useRef(false);

  useEffect(() => {
    const fetchMemberHomeData = async () => {
      try {
        // Fetch Banners for Hero (Filtered for All or Member)
        const bannerQuery = query(collection(db, 'banners'), where('active', '==', true), limit(5));
        const bannerSnap = await getDocs(bannerQuery);
        const banners = bannerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const filteredBanners = banners.filter(b => !b.targetAudience || b.targetAudience === 'all' || b.targetAudience === 'member');
        setHeroBanners(filteredBanners);

        // Fetch Top 10 Trending Food Merchants (Ordered by rating)
        const merchantQuery = query(
          collection(db, 'merchants'), 
          where('type', '==', 'food'),
          orderBy('reviewsCount', 'desc'), 
          limit(10)
        );
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

  useEffect(() => {
    if (heroBanners.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % heroBanners.length;
        isAutoScrolling.current = true;
        return next;
      });
    }, 4000); // Ganti setiap 4 detik

    return () => clearInterval(interval);
  }, [heroBanners.length]);

  useEffect(() => {
    if (bannerRef.current && isAutoScrolling.current) {
      const container = bannerRef.current;
      const scrollAmount = activeIndex * container.offsetWidth;
      container.scrollTo({
        left: scrollAmount,
        behavior: 'smooth'
      });

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
    <div className="bg-background text-on-background min-h-screen">
      <main className="mt-6 max-w-xl mx-auto px-6 space-y-8">
        
        {/* Compact Loyalty Points Card */}
        <section 
          onClick={() => navigate('/profile')}
          className="bg-surface p-5 rounded-[2rem] border border-outline/10 shadow-xl flex items-center justify-between group cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-black shadow-lg shadow-primary/20 group-hover:rotate-6 transition-transform">
              <span className="material-symbols-outlined font-black">loyalty</span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Saldo Poin Anda</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-headline font-black text-on-surface italic">{loyaltyPoints || 0}</span>
                <span className="text-[10px] font-bold text-primary">PTS</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-surface-container-highest/20 px-3 py-1.5 rounded-full border border-outline/20 group-hover:bg-primary/10 transition-colors">
            <span className="text-[9px] font-black uppercase tracking-widest text-primary">Cek Reward</span>
            <span className="material-symbols-outlined text-xs text-primary transition-transform group-hover:translate-x-1">arrow_forward</span>
          </div>
        </section>

        {/* Hero Promo Banner Section (Slidable) */}
        {heroBanners.length > 0 && (
          <section className="space-y-3">
             <div className="flex items-center justify-between px-2">
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">Promo Spesial</h4>
               <div className="flex gap-1.5">
                  {heroBanners.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeIndex === idx ? 'bg-primary w-4' : 'bg-on-surface/20'}`}
                    />
                  ))}
               </div>
             </div>
             <div 
               ref={bannerRef}
               onScroll={handleScroll}
               className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6 snap-x snap-mandatory"
             >
              {heroBanners.map((banner, index) => (
                <div 
                  key={banner.id}
                  onClick={() => {
                    if (banner.link) {
                      if (banner.link.startsWith('http')) {
                        window.open(banner.link, '_blank');
                      } else {
                        navigate(banner.link);
                      }
                    } else {
                      navigate('/food');
                    }
                  }}
                  className="min-w-[90%] snap-center rounded-[2rem] overflow-hidden shadow-2xl cursor-pointer active:scale-[0.98] transition-all border border-outline/10"
                >
                  <img 
                    alt={banner.title} 
                    className="w-full h-auto object-contain block" 
                    src={getOptimizedImageUrl(banner.imageUrl || banner.image, { width: 600, height: 300 })} 
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Service Grid */}
        <section className="grid grid-cols-2 gap-4">
          <div 
            onClick={() => navigate('/food')}
            className="bg-surface-container-highest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[136px] active:scale-95 transition-all group border border-transparent hover:border-primary/20 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary-container/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-primary text-3xl">restaurant</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-xl tracking-tight text-on-surface group-hover:text-primary transition-colors">ARO FOOD</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">Laper? Sini Makan</p>
            </div>
          </div>
          <div 
            onClick={() => navigate('/ride')}
            className="bg-surface-container-highest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[136px] active:scale-95 transition-all group border border-transparent hover:border-secondary/20 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-secondary text-3xl">moped</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-xl tracking-tight text-on-surface group-hover:text-secondary transition-colors">ARO JEK</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">Gas Tipis-tipis</p>
            </div>
          </div>
          <div 
            onClick={() => navigate('/send')}
            className="bg-surface-container-highest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[136px] active:scale-95 transition-all group border border-transparent hover:border-primary-dim/20 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary-dim/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-primary-dim text-3xl">package_2</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-xl tracking-tight text-on-surface group-hover:text-primary-dim transition-colors">ARO SEND</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-1">Kirim Paket Satset</p>
            </div>
          </div>
          <div 
            onClick={() => navigate('/shop')}
            className="bg-surface-container-highest p-6 rounded-[2rem] shadow-sm flex flex-col justify-between min-h-[136px] active:scale-95 transition-all group border border-transparent hover:border-tertiary-fixed/20 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-tertiary-fixed/10 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-tertiary-fixed text-3xl">shopping_cart</span>
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-xl tracking-tight text-on-surface group-hover:text-tertiary-fixed transition-colors">ARO TIP (JASTIP)</h3>
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
                  onClick={() => navigate('/food', { state: { openMerchant: merchant } })}
                  className="flex-none w-[280px] space-y-3 cursor-pointer group"
                >
                  <div className="relative h-[180px] rounded-[1.5rem] overflow-hidden bg-surface-container-highest">
                    {merchant.image || merchant.photoUrl ? (
                      <img 
                        alt={merchant.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        src={getOptimizedImageUrl(merchant.image || merchant.photoUrl, { width: 400, height: 300 })} 
                      />
                    ) : (
                      <PlaceholderImage name={merchant.name} />
                    )}
                    <div className="absolute top-3 right-3 bg-surface/80 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 shadow-md border border-outline/20">
                      <span className="material-symbols-outlined text-primary text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="text-[10px] font-bold text-on-surface">{merchant.rating || 'New'}</span>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-headline text-lg font-bold group-hover:text-primary transition-colors">{merchant.name}</h4>
                    <div className="flex items-center gap-2 text-on-surface-variant text-xs font-medium">
                      <span className="line-clamp-1">{merchant.category} • {merchant.address?.split(',')[0] || 'Blitar'}</span>
                      <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                        {merchant.deliveryTime || defaultDeliveryTime || '15-20 min'}
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
          {bentoPromos.map((promo, idx) => (
            <div 
              key={idx}
              onClick={() => promo.link && navigate(promo.link)}
              className={`bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/10 flex items-center justify-between group hover:border-${promo.color}-container/30 transition-colors cursor-pointer active:scale-95`}
            >
              <div className="space-y-1">
                <p className={`text-${promo.color} text-[10px] font-black tracking-[0.2em] uppercase`}>{promo.subtitle}</p>
                <h3 className="font-headline text-xl font-bold text-on-surface leading-tight whitespace-pre-line">{promo.title}</h3>
              </div>
              <div className="w-20 h-20 rotate-12 group-hover:rotate-6 transition-transform">
                <span className={`material-symbols-outlined text-${promo.color}-container text-[5rem] opacity-30`}>{promo.icon}</span>
              </div>
            </div>
          ))}
        </section>
      </main>

    </div>
  );
}

export default MemberHome;
