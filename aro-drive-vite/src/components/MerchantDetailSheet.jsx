import React, { useState, useMemo, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { getOpeningStatus } from '../utils/timeUtils';
import { useAdminStore } from '../store/adminStore';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import ImageViewer from './ImageViewer';
import { db } from '../firebase/config';
import { collection, query, onSnapshot } from 'firebase/firestore';

const starStyle = { fontVariationSettings: "'FILL' 1" };

// ── Day name mapping for schedule display ──
const DAY_MAP = {
  Sunday: 'Minggu', Monday: 'Senin', Tuesday: 'Selasa',
  Wednesday: 'Rabu', Thursday: 'Kamis', Friday: 'Jumat', Saturday: 'Sabtu'
};
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MerchantDetailSheet = ({ 
  merchant, 
  onClose, 
  isAdmin, 
  isUploading, 
  uploadStatus, 
  onPhotoUpload, 
  onAddToCart,
  onManualOrderSubmit,
  onDeleteMenuThumbnail
}) => {
  const [orderText, setOrderText] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  
  // ── Digital Menu State ──
  const [digitalMenu, setDigitalMenu] = useState([]);
  const [isMenuLoading, setIsMenuLoading] = useState(false);

  const { ui } = useAdminStore();
  const detailUI = ui.merchantDetail || {
    operatingHours: 'Jam Operasional',
    noHours: 'Data jadwal belum tersedia',
    adminTitle: 'Admin: Kelola Menu',
    photoList: 'Daftar Menu Foto',
    noPhoto: 'Foto Menu Belum Tersedia',
    manualOrderTitle: 'Tulis Pesanan Manual',
    placeholder: 'Tulis menu & jumlahnya...\nContoh:\n- Nasi Goreng Spesial 2\n- Es Teh Manis 2',
    addBtn: 'Tambahkan Ke Keranjang',
    disclaimer: 'Pesanan akan diproses oleh driver sesuai ketersediaan.',
    tipsTitle: 'Tips Memesan',
    tipsDesc: 'Sebutkan porsi, tingkat kepedasan, atau request khusus di kolom pesanan agar driver lebih mudah membelikan.'
  };
  
  // ── Derived data ──
  const status = useMemo(() => getOpeningStatus(merchant?.openingHours), [merchant?.openingHours]);
  
  const menuPhotos = useMemo(() => {
    if (!merchant) return [];
    const photos = [];
    if (merchant.originalMenuImage) photos.push(merchant.originalMenuImage);
    if (merchant.menu_thumbnails?.length) photos.push(...merchant.menu_thumbnails);
    return photos;
  }, [merchant?.originalMenuImage, merchant?.menu_thumbnails]);

  const scheduleList = useMemo(() => {
    if (!merchant?.openingHours) return [];
    let hours = merchant.openingHours;
    if (typeof hours === 'object' && !Array.isArray(hours)) hours = hours.weekdayText;
    if (!Array.isArray(hours)) return [];
    
    return DAY_ORDER.map(dayEn => {
      const entry = hours.find(h => h.startsWith(dayEn));
      if (!entry) return null;
      const timePart = entry.substring(entry.indexOf(':') + 1).trim();
      const isToday = new Date().getDay() === DAY_ORDER.indexOf(dayEn) + 1 || (dayEn === 'Sunday' && new Date().getDay() === 0);
      return { day: DAY_MAP[dayEn], time: timePart, isToday };
    }).filter(Boolean);
  }, [merchant?.openingHours]);

  // ── Fetch Digital Menu from subcollection ──
  useEffect(() => {
    if (!merchant?.id || !merchant?.verified) {
      setDigitalMenu([]);
      return;
    }

    setIsMenuLoading(true);
    const menuRef = collection(db, "merchants", merchant.id, "menu");
    const q = query(menuRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDigitalMenu(items);
      setIsMenuLoading(false);
    }, (error) => {
      console.error("Error fetching digital menu:", error);
      setIsMenuLoading(false);
    });

    return () => unsubscribe();
  }, [merchant?.id]);

  if (!merchant) return null;

  const handleOrderSubmit = () => {
    if (onManualOrderSubmit && orderText.trim()) {
      onManualOrderSubmit(merchant, orderText);
      setOrderText('');
    }
  };

  return (
    <m.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <m.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.35 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl h-[90vh] sm:h-[85vh] sm:rounded-3xl rounded-t-[2rem] bg-background flex flex-col overflow-hidden border-t border-outline"
      >
        {/* Upload progress bar */}
        {isUploading && (
          <div className="h-0.5 bg-outline overflow-hidden flex-none">
            <m.div 
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-full h-full bg-primary"
            />
          </div>
        )}

        {/* ═══ COMPACT HEADER ═══ */}
        <div className="flex-none px-5 pt-5 pb-4">
          {/* Drag handle */}
          <div className="w-10 h-1 rounded-full bg-on-surface/15 mx-auto mb-4" />
          
          <div className="flex gap-4 items-start">
            {/* Small merchant image */}
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-none bg-surface">
              {merchant.image ? (
                <img 
                  src={getOptimizedImageUrl(merchant.image, { width: 128, height: 128 })} 
                  alt={merchant.name} 
                  className="w-full h-full object-cover" 
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-surface-variant opacity-20 text-2xl">restaurant</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-xl font-headline font-black text-on-surface leading-tight truncate">{merchant.name}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest px-2 py-0.5 bg-primary/10 rounded border border-primary/20">{merchant.category}</span>
                    <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ${
                      status.color === 'green' ? 'text-green-400' :
                      status.color === 'orange' ? 'text-orange-400' :
                      status.color === 'red' ? 'text-red-400' : 'text-on-surface-variant opacity-50'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        status.color === 'green' ? 'bg-green-400' :
                        status.color === 'orange' ? 'bg-orange-400' :
                        status.color === 'red' ? 'bg-red-400' : 'bg-on-surface-variant opacity-30'
                      }`} />
                      {status.message}
                    </div>
                  </div>
                </div>
                
                {/* Rating + Close */}
                <div className="flex items-center gap-2 flex-none">
                  <div className="flex items-center gap-1 bg-on-surface/5 px-2 py-1 rounded-lg">
                    <span className="material-symbols-outlined text-xs text-primary" style={starStyle}>star</span>
                    <span className="font-black text-sm text-on-surface">{merchant.rating || '0.0'}</span>
                  </div>
                  <button 
                    onClick={onClose}
                    className="w-9 h-9 rounded-full bg-on-surface/5 flex items-center justify-center text-on-surface/60 hover:text-on-surface hover:bg-on-surface/10 transition-colors active:scale-90"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-center gap-2 mt-3 text-on-surface/35 text-xs">
            <span className="material-symbols-outlined text-sm">location_on</span>
            <span className="truncate">{merchant.address || 'Alamat tidak tersedia'}</span>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-outline flex-none" />

        {/* ═══ SCROLLABLE CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="px-5 py-5 space-y-6">

            {/* ── Jam Operasional ── */}
            <div>
              <button 
                onClick={() => setShowSchedule(!showSchedule)}
                className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-surface-container border border-outline hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-lg text-primary/60">schedule</span>
                  <span className="text-xs font-bold text-on-surface/70">{detailUI.operatingHours}</span>
                </div>
                <div className="flex items-center gap-2">
                  {merchant.deliveryTime && (
                    <span className="text-[10px] font-bold text-on-surface/30">~{merchant.deliveryTime} min</span>
                  )}
                  <m.span 
                    animate={{ rotate: showSchedule ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="material-symbols-outlined text-sm text-on-surface/30"
                  >
                    expand_more
                  </m.span>
                </div>
              </button>

              {showSchedule && (
                <m.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="overflow-hidden mt-2"
                >
                  <div className="px-4 py-3 rounded-xl bg-surface border border-outline space-y-1.5">
                    {scheduleList.length > 0 ? (
                      scheduleList.map((item, idx) => (
                        <div key={idx} className={`flex justify-between text-xs py-1 px-2 rounded-lg ${
                          item.isToday ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant opacity-70'
                        }`}>
                          <span className="font-medium">{item.day}</span>
                          <span>{item.time}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-on-surface-variant opacity-50 text-center py-2">{detailUI.noHours}</p>
                    )}
                  </div>
                </m.div>
              )}
            </div>

            {/* ── Admin Controls ── */}
            {isAdmin && (
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">admin_panel_settings</span>
                  {detailUI.adminTitle}
                </p>
                <div className="flex gap-3">
                  <input 
                    type="file" 
                    id="menu-upload-detail"
                    className="hidden" 
                    accept="image/*"
                    multiple
                    onChange={(e) => onPhotoUpload(e, merchant.id)}
                  />
                  <label 
                    htmlFor="menu-upload-detail"
                    className={`flex-1 h-12 flex items-center justify-center gap-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${
                      isUploading 
                        ? 'bg-surface-container text-on-surface-variant opacity-50 pointer-events-none' 
                        : 'bg-surface-container text-on-surface hover:bg-surface border border-outline'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{isUploading ? 'sync' : 'photo_camera'}</span>
                    {isUploading ? (uploadStatus || 'Uploading...') : 'Upload Foto Menu'}
                  </label>
                </div>
              </div>
            )}

            {/* ── Digital Menu ── */}
            {merchant.verified && (isMenuLoading || digitalMenu.length > 0) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-70 flex items-center gap-2">
                    <span className="w-6 h-px bg-outline" />
                    Menu Digital
                  </h3>
                  {!isMenuLoading && (
                    <span className="text-[10px] font-bold text-primary/50">{digitalMenu.length} Item</span>
                  )}
                </div>

                {isMenuLoading ? (
                  <div className="flex flex-col items-center py-8 gap-3 opacity-30">
                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-[10px] font-bold uppercase tracking-widest">Memuat Menu...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {digitalMenu.map((item, idx) => (
                      <div key={item.id || idx} className="flex items-center justify-between p-4 rounded-2xl bg-on-surface/[0.03] border border-outline hover:border-primary/20 transition-colors">
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-sm font-bold text-on-surface truncate">{item.name}</p>
                          <p className="text-xs text-primary font-bold mt-1">IDR {Number(item.price || 0).toLocaleString()}</p>
                          {item.description && (
                            <p className="text-[10px] text-on-surface-variant opacity-60 mt-1 line-clamp-1">{item.description}</p>
                          )}
                        </div>
                        <button 
                          onClick={(e) => onAddToCart && onAddToCart(e, item, merchant)}
                          className="w-10 h-10 rounded-xl bg-primary text-black flex items-center justify-center hover:bg-primary/90 transition-all active:scale-90 shadow-lg shadow-primary/10"
                        >
                          <span className="material-symbols-outlined text-xl">add</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Separator if followed by photo gallery */}
                {menuPhotos.length > 0 && <div className="h-px bg-outline pt-2" />}
              </div>
            )}

            {/* ── Menu Photo Gallery ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant opacity-70 flex items-center gap-2">
                  <span className="w-6 h-px bg-outline" />
                  {detailUI.photoList}
                </h3>
                {menuPhotos.length > 0 && (
                  <span className="text-[10px] font-bold text-primary/50">{menuPhotos.length} Foto</span>
                )}
              </div>

              {menuPhotos.length > 0 ? (
                <>
                  {/* Main photo viewer */}
                  <div 
                    className="relative rounded-2xl overflow-hidden bg-surface-container border border-outline aspect-[3/4] cursor-pointer active:opacity-90 transition-opacity"
                    onClick={() => setViewerOpen(true)}
                  >
                    <img 
                      src={getOptimizedImageUrl(menuPhotos[activePhotoIdx], { width: 600, height: 800, fit: 'inside' })} 
                      alt={`Menu ${activePhotoIdx + 1}`} 
                      className="w-full h-full object-contain"
                    />
                    {/* Photo counter */}
                    <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded-lg text-[9px] font-bold text-on-background opacity-80">
                      {activePhotoIdx + 1} / {menuPhotos.length}
                    </div>
                    {/* Admin delete */}
                    {isAdmin && onDeleteMenuThumbnail && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteMenuThumbnail(merchant.id, menuPhotos[activePhotoIdx]); }}
                        className="absolute top-3 right-3 w-8 h-8 bg-error/80 text-on-background rounded-lg flex items-center justify-center active:scale-90 transition-transform"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                    {/* Zoom hint */}
                    <div className="absolute bottom-3 right-3 bg-black/50 px-2 py-1 rounded-lg flex items-center gap-1">
                      <span className="material-symbols-outlined text-on-background opacity-60 text-xs">pinch_zoom_in</span>
                      <span className="text-[8px] font-bold text-on-background opacity-60 uppercase">Tap untuk zoom</span>
                    </div>
                  </div>

                  {/* Thumbnail strip */}
                  {menuPhotos.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {menuPhotos.map((url, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActivePhotoIdx(idx)}
                          className={`flex-none w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                            idx === activePhotoIdx 
                              ? 'border-primary opacity-100 scale-105' 
                              : 'border-outline opacity-50 hover:opacity-80'
                          }`}
                        >
                          <img 
                            src={getOptimizedImageUrl(url, { width: 96, height: 96 })} 
                            alt={`Thumb ${idx + 1}`} 
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-10 flex flex-col items-center justify-center border border-dashed border-outline rounded-2xl bg-surface-container">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant opacity-30 mb-2">image_search</span>
                  <p className="text-[10px] text-on-surface-variant opacity-50 font-bold uppercase tracking-widest">{detailUI.noPhoto}</p>
                </div>
              )}
            </div>

            {/* ── Manual Order ── */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 flex items-center gap-2">
                <span className="w-6 h-px bg-primary/20" />
                {detailUI.manualOrderTitle}
              </h3>
              
              <textarea 
                value={orderText}
                onChange={(e) => setOrderText(e.target.value)}
                placeholder={detailUI.placeholder}
                className="w-full bg-surface-container border border-outline rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant placeholder:opacity-50 focus:outline-none focus:border-primary/30 transition-colors font-medium min-h-[120px] resize-none leading-relaxed"
              />

              <button 
                onClick={handleOrderSubmit}
                disabled={!orderText.trim()}
                className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 active:scale-[0.97] ${
                  orderText.trim() 
                    ? 'bg-primary text-black' 
                    : 'bg-surface-container text-on-surface-variant opacity-50 cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-base">shopping_basket</span>
                {detailUI.addBtn}
              </button>

              <p className="text-[8px] text-center text-on-surface-variant opacity-50 font-bold uppercase tracking-widest">
                {detailUI.disclaimer}
              </p>
            </div>

            {/* ── Tips ── */}
            <div className="py-4 px-4 rounded-2xl bg-surface-container border border-outline flex gap-3 items-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-none">
                <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-on-surface mb-0.5">{detailUI.tipsTitle}</p>
                <p className="text-[9px] text-on-surface-variant opacity-70 leading-relaxed">{detailUI.tipsDesc}</p>
              </div>
            </div>

          </div>
        </div>
      </m.div>

      {/* Fullscreen Image Viewer with pinch-to-zoom */}
      <AnimatePresence>
        {viewerOpen && menuPhotos.length > 0 && (
          <ImageViewer 
            images={menuPhotos}
            initialIndex={activePhotoIdx}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </AnimatePresence>
    </m.div>
  );
};

export default MerchantDetailSheet;
