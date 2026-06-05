import React, { useMemo, useState, useCallback, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { getOpeningStatus } from '../utils/timeUtils';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import ImageViewer from './ImageViewer';

// ── Constants ──
const IMAGE_OPTIONS = { width: 400, height: 300 };
const THUMB_OPTIONS = { width: 96, height: 96 };
const GALLERY_OPTIONS = { width: 400, height: 600 };
const starStyle = { fontVariationSettings: "'FILL' 1" };

const PlaceholderImage = React.memo(({ name }) => (
  <div className="w-full h-full bg-gradient-to-br from-surface to-background flex justify-center items-center relative overflow-hidden group">
     <span className="text-6xl font-headline font-black text-on-surface-variant opacity-10 uppercase tracking-widest absolute">{String(name || '').substring(0, 3)}</span>
     <div className="absolute inset-0 bg-primary/5 transition-opacity group-hover:bg-primary/20" />
     <span className="material-symbols-outlined text-primary/20 text-4xl transform group-hover:scale-125 transition-transform duration-500">restaurant</span>
  </div>
));

// ── Expanded content animations ──
const expandedContentVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { 
    height: "auto", 
    opacity: 1,
    transition: { 
      height: { type: "spring", stiffness: 200, damping: 28 },
      opacity: { duration: 0.25, delay: 0.1 }
    }
  },
  exit: { 
    height: 0, 
    opacity: 0,
    transition: { 
      height: { type: "spring", stiffness: 250, damping: 30 },
      opacity: { duration: 0.15 }
    }
  }
};

const galleryItemVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i) => ({ 
    opacity: 1, 
    scale: 1,
    transition: { delay: i * 0.08, type: "spring", stiffness: 150, damping: 20 }
  })
};

const MerchantCard = React.memo(({ 
  merchant, 
  onClick,
  variants, 
  isExpanded, 
  onToggleExpand, 
  onAddToCart,
  onManualOrderSubmit,
  onDeleteMenuThumbnail,
  isAdmin
}) => {
  const [orderText, setOrderText] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const textareaRef = useRef(null);

  // ── Handlers ──
  const handleHeaderClick = useCallback(() => {
    if (onToggleExpand) {
      onToggleExpand(merchant.id);
    }
  }, [merchant.id, onToggleExpand]);

  const handleDetailClick = useCallback((e) => {
    e.stopPropagation();
    if (onClick) onClick(merchant);
  }, [merchant, onClick]);

  const handleOrderSubmit = useCallback((e) => {
    e.stopPropagation();
    if (onManualOrderSubmit && orderText.trim()) {
      onManualOrderSubmit(merchant, orderText);
      setOrderText('');
    }
  }, [merchant, orderText, onManualOrderSubmit]);

  // ── Memoized values ──
  const status = useMemo(() => getOpeningStatus(merchant.openingHours), [merchant.openingHours]);
  const optimizedImage = useMemo(() => {
    const imgUrl = merchant.image || merchant.originalMenuImage;
    if (imgUrl) {
      return getOptimizedImageUrl(imgUrl, IMAGE_OPTIONS);
    }
    return null;
  }, [merchant.image, merchant.originalMenuImage]);

  const menuPhotos = useMemo(() => {
    const photos = [];
    if (merchant.originalMenuImage) photos.push(merchant.originalMenuImage);
    if (merchant.menu_thumbnails?.length) photos.push(...merchant.menu_thumbnails);
    return photos;
  }, [merchant.originalMenuImage, merchant.menu_thumbnails]);

  const hasMenuPhotos = menuPhotos.length > 0;

  return (
    <>
    <m.div 
      variants={variants}
      className={`bg-surface-container-low rounded-2xl overflow-hidden border transition-colors duration-300 shadow-lg ${
        isExpanded 
          ? 'border-primary shadow-2xl' 
          : 'border-outline hover:border-outline'
      }`}
    >
      {/* ═══ HEADER (always visible, clickable to toggle) ═══ */}
      <div 
        onClick={handleHeaderClick}
        className="flex h-32 group cursor-pointer hover:bg-surface-container transition-colors"
      >
        {/* Merchant Image */}
        <div className="w-1/3 h-full relative overflow-hidden flex-none">
          {optimizedImage ? (
            <img 
              src={optimizedImage} 
              alt={merchant.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
              loading="lazy"
              decoding="async"
            />
          ) : (
            <PlaceholderImage name={merchant.name} />
          )}
        </div>

        {/* Merchant Info */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <div className={`text-[8px] font-black uppercase tracking-[0.15em] mb-1.5 ${
              status.color === 'green' ? 'text-green-400' :
              status.color === 'orange' ? 'text-orange-400' :
              status.color === 'red' ? 'text-red-400' :
              'text-on-surface-variant opacity-50'
            }`}>
              {status.message}
            </div>
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-bold text-base text-on-surface group-hover:text-primary transition-colors line-clamp-1">{String(merchant.name || '')}</h3>
              <div className="flex items-center gap-1 bg-surface px-1.5 py-0.5 rounded text-xs flex-none border border-outline">
                <span className="material-symbols-outlined text-[10px] text-yellow-400" style={starStyle}>star</span>
                <span className="font-bold text-on-surface">{String(merchant.rating || '0.0')}</span>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant line-clamp-1">{String(merchant.address || '')}</p>
          </div>
          
          <div className="flex items-center justify-between mt-auto pt-2">
            <span className="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-full">{String(merchant.category || '')}</span>
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-on-surface flex items-center gap-1 opacity-70">
                  <span className="material-symbols-outlined text-[14px]">schedule</span>
                  {String(merchant.deliveryTime || '25')} min
               </span>
               {/* Expand/Collapse indicator */}
               <m.span 
                 animate={{ rotate: isExpanded ? 180 : 0 }}
                 transition={{ type: "spring", stiffness: 300, damping: 20 }}
                 className={`material-symbols-outlined text-[18px] transition-colors duration-300 ${
                   isExpanded ? 'text-primary' : 'text-on-surface-variant opacity-50'
                 }`}
               >
                 expand_more
               </m.span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MINI THUMBNAIL ROW (collapsed only, when photos exist) ═══ */}
      {!isExpanded && hasMenuPhotos && (
        <div 
          className="px-4 pb-3 flex items-center gap-2 cursor-pointer"
          onClick={handleHeaderClick}
        >
          <span className="material-symbols-outlined text-[13px] text-primary/40">photo_library</span>
          <div className="flex gap-1.5 overflow-hidden">
            {menuPhotos.slice(0, 4).map((url, idx) => (
              <div key={idx} className="w-9 h-9 rounded-lg overflow-hidden flex-none border border-outline bg-surface">
                <img 
                  src={getOptimizedImageUrl(url, THUMB_OPTIONS)} 
                  alt={`Menu ${idx + 1}`} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {menuPhotos.length > 4 && (
              <div className="w-9 h-9 rounded-lg bg-surface-container border border-primary flex items-center justify-center opacity-80">
                <span className="text-[9px] font-black text-primary">+{menuPhotos.length - 4}</span>
              </div>
            )}
          </div>
          <span className="text-[9px] font-bold text-on-surface-variant opacity-50 ml-auto uppercase tracking-wider">Lihat Menu →</span>
        </div>
      )}

      {/* ═══ EXPANDED CONTENT ═══ */}
      <AnimatePresence>
        {isExpanded && (
          <m.div
            variants={expandedContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 space-y-5">
              {/* Separator line */}
              <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              {/* ── Menu Photo Gallery ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-70 flex items-center gap-2">
                    <span className="w-6 h-px bg-outline" />
                    Daftar Menu Foto
                  </h4>
                  {hasMenuPhotos && (
                    <span className="text-[10px] font-bold text-primary/50">{menuPhotos.length} Foto</span>
                  )}
                </div>

                {hasMenuPhotos ? (
                  <div className="relative">
                    <div className="flex overflow-x-auto gap-3 pb-3 no-scrollbar snap-x snap-mandatory">
                      {menuPhotos.map((url, idx) => (
                        <m.div 
                          key={idx} 
                          custom={idx}
                          variants={galleryItemVariants}
                          initial="hidden"
                          animate="visible"
                          className="flex-none w-[72%] snap-center"
                        >
                          <div className="relative rounded-2xl overflow-hidden border border-outline bg-surface shadow-xl aspect-[3/4]">
                            <img 
                              src={getOptimizedImageUrl(url, GALLERY_OPTIONS)} 
                              alt={`Menu ${idx + 1}`} 
                              className="w-full h-full object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-500"
                              onClick={(e) => { e.stopPropagation(); setViewerIdx(idx); setViewerOpen(true); }}
                              loading="lazy"
                            />
                            {/* Bottom overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
                              <span className="bg-surface-container backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-bold text-on-surface-variant border border-outline">
                                MENU #{idx + 1}
                              </span>
                              {isAdmin && onDeleteMenuThumbnail && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); onDeleteMenuThumbnail(merchant.id, url); }}
                                  className="w-8 h-8 bg-error/20 backdrop-blur-md text-error rounded-lg border border-error/30 flex items-center justify-center hover:bg-error hover:text-on-background transition-all active:scale-90"
                                >
                                  <span className="material-symbols-outlined text-xs">delete</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </m.div>
                      ))}
                      {/* End spacer */}
                      <div className="flex-none w-4" />
                    </div>
                    {/* Scroll dots */}
                    {menuPhotos.length > 1 && (
                      <div className="flex justify-center gap-1.5 mt-1">
                        {menuPhotos.map((_, i) => (
                          <div key={i} className="w-1 h-1 rounded-full bg-outline" />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center border border-dashed border-outline rounded-2xl bg-surface-container">
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant opacity-30 mb-2">image_search</span>
                    <p className="text-[10px] text-on-surface-variant opacity-50 font-bold uppercase tracking-widest">Foto Menu Belum Tersedia</p>
                  </div>
                )}
              </div>
              
              {/* ── Digital Menu ── */}
              {merchant.verified && merchant.menu && merchant.menu.length > 0 && (
                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-70 flex items-center gap-2">
                      <span className="w-6 h-px bg-outline" />
                      Menu Digital
                    </h4>
                    <span className="text-[10px] font-bold text-primary/50">{merchant.menu.length} Item</span>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                    {merchant.menu.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-container border border-outline hover:border-primary transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-xs font-bold text-on-surface truncate">{item.name}</p>
                          <p className="text-[10px] text-primary font-bold mt-0.5">IDR {Number(item.price || 0).toLocaleString()}</p>
                        </div>
                        <button 
                          onClick={(e) => onAddToCart && onAddToCart(e, item, merchant)}
                          className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-black transition-all active:scale-90 shadow-lg shadow-primary/5"
                        >
                          <span className="material-symbols-outlined text-lg">add</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Manual Order Input ── */}
              <m.div 
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 150, damping: 20 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 flex items-center gap-2">
                    <span className="w-6 h-px bg-primary/20" />
                    Tulis Pesanan Manual
                  </h4>
                  <div className="flex items-center gap-1 opacity-40">
                    <span className="w-1 h-1 rounded-full bg-on-surface" />
                    <span className="text-[9px] font-bold text-on-surface uppercase tracking-tighter">Fast Order</span>
                  </div>
                </div>
                
                <div className="relative group" onClick={(e) => e.stopPropagation()}>
                  <textarea 
                    ref={textareaRef}
                    value={orderText}
                    onChange={(e) => setOrderText(e.target.value)}
                    placeholder={"Tulis menu & jumlahnya...\nContoh:\n- Nasi Goreng Spesial 2\n- Es Teh Manis 2"}
                    className="w-full bg-surface-container border border-outline rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant placeholder:opacity-50 focus:outline-none focus:border-primary transition-all font-medium min-h-[110px] shadow-lg resize-none leading-relaxed"
                  />
                  {/* Glow on focus */}
                  <div className="absolute inset-0 rounded-2xl bg-primary/5 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                </div>

                <button 
                  onClick={handleOrderSubmit}
                  disabled={!orderText.trim()}
                  className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                    orderText.trim() 
                      ? 'bg-primary text-on-primary shadow-[0_6px_20px_rgba(255,215,0,0.2)] active:scale-[0.97]' 
                      : 'bg-surface-container text-on-surface-variant opacity-50 cursor-not-allowed'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">shopping_basket</span>
                  Tambahkan Ke Keranjang
                </button>

                <p className="text-[8px] text-center text-on-surface-variant opacity-50 font-bold uppercase tracking-widest leading-relaxed">
                  Pesanan akan diproses oleh driver sesuai ketersediaan di outlet.
                </p>
              </m.div>

              {/* ── Detail Lengkap Button ── */}
              <button 
                onClick={handleDetailClick}
                className="w-full py-3.5 rounded-xl bg-surface-container border border-outline text-on-surface-variant opacity-70 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-surface hover:text-on-surface hover:opacity-100 transition-all active:scale-[0.97]"
              >
                <span className="material-symbols-outlined text-sm">open_in_full</span>
                Detail Lengkap
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </m.div>

    {/* Fullscreen Image Viewer with pinch-to-zoom */}
    <AnimatePresence>
      {viewerOpen && menuPhotos.length > 0 && (
        <ImageViewer 
          images={menuPhotos}
          initialIndex={viewerIdx}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </AnimatePresence>
    </>
  );
});

export default MerchantCard;
