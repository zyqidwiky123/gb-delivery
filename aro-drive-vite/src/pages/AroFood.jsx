import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { db, storage } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  deleteField,
  query,
  where,
  limit,
  startAfter,
  orderBy,
  arrayRemove,
  arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const getDownloadURLWithRetry = async (storageRef, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await getDownloadURL(storageRef);
    } catch (error) {
      if (error.code === 'storage/object-not-found' && i < retries - 1) {
        console.warn(`[Storage] Object not found, retrying in ${delay}ms... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
};

import MerchantCard from '../components/MerchantCard';
import ErrorBoundary from '../components/ErrorBoundary';
import AroFoodSearch from '../components/AroFoodSearch';
import { getOptimizedImageUrl } from '../utils/imageUtils';
const MerchantDetailSheet = React.lazy(() => import('../components/MerchantDetailSheet'));

const PlaceholderImage = ({ name }) => (
  <div className="w-full h-full bg-gradient-to-br from-surface to-background flex justify-center items-center relative overflow-hidden group">
     <span className="text-6xl font-headline font-black text-on-surface/5 uppercase tracking-widest absolute">{String(name || '').substring(0, 3)}</span>
     <div className="absolute inset-0 bg-primary/5 transition-opacity group-hover:bg-primary/20" />
     <span className="material-symbols-outlined text-primary/20 text-4xl transform group-hover:scale-125 transition-transform duration-500">restaurant</span>
  </div>
);


// Animation variants moved outside to prevent re-creation on every render
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { 
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      type: "spring", 
      stiffness: 100, 
      damping: 15,
      mass: 1 
    } 
  }
};

function AroFood() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, savedAddresses, isAdmin } = useUserStore();
  const { cart, addToCart, clearCart, foodDeliveryLocation, setFoodDelivery } = useOrderStore();
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  
  const [locationName, setLocationName] = useState('Detecting location...');
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  
  const [merchants, setMerchants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [expandedCardId, setExpandedCardId] = useState(null);
  const { categories, ui } = useAdminStore();
  const foodUI = ui.aroFood || {
    detectingLoc: 'Mendeteksi lokasi...',
    chooseLoc: 'Pilih Lokasi Pengiriman',
    searchPlaceholder: 'Mau makan apa hari ini?',
    loadingMsg: 'Menghidangkan rekomendasi...',
    topRatedLabel: 'Top Rated🔥',
    exploreLabel: 'Eksplorasi Rasa',
    modalTitle: 'Kirim Ke Mana?',
    mapBtn: 'Pilih di Peta'
  };

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);


  // Process auto-open from navigation state
  useEffect(() => {
    if (location.state?.openMerchant) {
      setSelectedMerchant(location.state.openMerchant);
      // Clean up state so it doesn't reopen if they navigate back
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };


  // Fetch from Firebase with Pagination
  const fetchMerchants = async (isNew = true) => {
    if (isNew) {
      setIsLoading(true);
      setMerchants([]);
      setLastDoc(null);
      setHasMore(true);
    } else {
      if (!hasMore || isMoreLoading) return;
      setIsMoreLoading(true);
    }

    try {
      setError(null);
      let q = collection(db, "merchants");
      let constraints = [where("type", "==", "food")];

      // Filter Category
      if (activeCategory !== 'All') {
        constraints.push(where("category", "==", activeCategory.toLowerCase()));
        constraints.push(orderBy("reviewsCount", "desc"));
      } 
      // Default (All)
      else {
        constraints.push(orderBy("reviewsCount", "desc"));
      }

      constraints.push(limit(10));

      // Pagination
      if (!isNew && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const finalQuery = query(q, ...constraints);
      const querySnapshot = await getDocs(finalQuery);
      
      const newDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(querySnapshot.docs.length === 10);
      
      if (isNew) {
        setMerchants(newDocs);
      } else {
        setMerchants(prev => [...prev, ...newDocs]);
      }
    } catch (error) {
      console.error("Error fetching merchants:", error);
      setError("Gagal memuat merchant. Pastikan koneksi internet stabil atau coba lagi nanti.");
    } finally {
      setIsLoading(false);
      setIsMoreLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants(true);
  }, [activeCategory]); // Removed debouncedSearch from here as we use client-side search now

  // Sync locationName with foodDeliveryLocation
  useEffect(() => {
    if (foodDeliveryLocation) {
      setLocationName(foodDeliveryLocation.address);
    } else {
      setLocationName(foodUI.chooseLoc);
    }
  }, [foodDeliveryLocation]);

  // Initial Geolocation - only if no location is selected
  useEffect(() => {
    // Restore auto-detection of location on initial load if not already set
    if (!foodDeliveryLocation && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: "Lokasi Terdeteksi" };
        setFoodDelivery(coords);
        console.log("Auto-location detected:", coords);
      }, (err) => {
        console.warn("Geolocation denied or failed:", err);
      }, { enableHighAccuracy: true, timeout: 5000 });
    }
  }, [foodDeliveryLocation, setFoodDelivery]);

  const getMerchantLoc = (merchant) => {
    // Try primary top-level lat/lng
    if (merchant.lat !== undefined && merchant.lng !== undefined) return [Number(merchant.lat), Number(merchant.lng)];
    // Try nested location object
    if (merchant.location?.lat !== undefined && merchant.location?.lng !== undefined) return [Number(merchant.location.lat), Number(merchant.location.lng)];
    // Try latlng array
    if (Array.isArray(merchant.latlng)) return [Number(merchant.latlng[0]), Number(merchant.latlng[1])];
    // Fallback
    return [-8.100, 112.160];
  };

  const selectSavedAddress = (addr) => {
    setFoodDelivery({ address: addr.address, lat: addr.lat, lng: addr.lng });
    setShowAddressPicker(false);
  };
  
  const handleAddToCart = (e, item, merchant) => {
    e.stopPropagation();
    try {
      addToCart({ 
        ...item, 
        merchantId: merchant.id, 
        merchantName: merchant.name,
        merchantLocation: getMerchantLoc(merchant)
      });
    } catch (error) {
      console.error("Error adding to cart:", error);
    }
  };

  const handleManualOrderSubmit = useCallback((merchant, text) => {
    if (!text.trim()) return;
    
    // Create a special menu item for manual order
    const manualItem = {
      id: `manual-${Date.now()}`,
      name: text.length > 200 ? `${text.substring(0, 200)}...` : text,
      price: 0, 
      desc: text,
      qty: 1,
      isManual: true,
      originalMenuImage: merchant.originalMenuImage || null
    };

    addToCart({ 
      ...manualItem, 
      merchantId: merchant.id, 
      merchantName: merchant.name,
      merchantLocation: getMerchantLoc(merchant)
    });
    showToast("Ditambahkan ke keranjang!", "success");
  }, [addToCart]);

  const handleAdminPhotoUpload = useCallback(async (e, merchantId) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Capture files immediately as Array to avoid stale FileList references
    const fileArray = Array.from(files);

    setIsUploading(true);
    setUploadStatus(`Mengunggah ${fileArray.length} foto...`);

    try {
      const merchantRef = doc(db, "merchants", merchantId);
      // Fetch fresh data from Firestore for accurate state
      const merchantSnap = await getDoc(merchantRef);
      const merchantData = merchantSnap.exists() ? merchantSnap.data() : {};
      const hasOriginal = !!merchantData.originalMenuImage;
      
      const newUrls = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        // Sanitize filename: remove special chars, keep extension
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const safeName = `menu_${Date.now()}_${i}.${ext}`;
        const storagePath = `manual_menus/${merchantId}/${safeName}`;
        const storageRef = ref(storage, storagePath);
        
        // Upload and use snapshot.ref for reliable getDownloadURL
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURLWithRetry(snapshot.ref);
        newUrls.push(downloadURL);
      }

      const updateData = {};

      if (newUrls.length > 0) {
        // Smart logic: Promote the first new photo to originalMenuImage
        updateData.originalMenuImage = newUrls[0];
        
        const thumbnailsToAdd = [...newUrls.slice(1)];
        // Demote old originalMenuImage to thumbnails so it is not lost
        if (merchantData.originalMenuImage) {
          thumbnailsToAdd.push(merchantData.originalMenuImage);
        }
        
        if (thumbnailsToAdd.length > 0) {
          updateData.menu_thumbnails = arrayUnion(...thumbnailsToAdd);
        }
      }

      await updateDoc(merchantRef, updateData);

      // Update local state
      setMerchants(prev => prev.map(m => {
        if (m.id === merchantId) {
          const updatedThumbnails = [...(m.menu_thumbnails || [])];
          
          const newThumbs = [...newUrls.slice(1)];
          if (m.originalMenuImage) {
            newThumbs.push(m.originalMenuImage);
          }

          return { 
            ...m, 
            originalMenuImage: newUrls[0] || m.originalMenuImage,
            menu_thumbnails: [...updatedThumbnails, ...newThumbs]
          };
        }
        return m;
      }));

      setSelectedMerchant(prev => {
        if (prev && prev.id === merchantId) {
          const updatedThumbnails = [...(prev.menu_thumbnails || [])];
          
          const newThumbs = [...newUrls.slice(1)];
          if (prev.originalMenuImage) {
            newThumbs.push(prev.originalMenuImage);
          }

          return { 
            ...prev, 
            originalMenuImage: newUrls[0] || prev.originalMenuImage,
            menu_thumbnails: [...updatedThumbnails, ...newThumbs],
            menu: undefined 
          };
        }
        return prev;
      });
      
      setUploadStatus(`${newUrls.length} foto berhasil diunggah!`);
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus('Gagal unggah: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  }, [storage, db, merchants]);

  const handleDeleteMenuThumbnail = useCallback(async (merchantId, url) => {
    if (!window.confirm("Hapus foto menu ini?")) return;

    try {
      const merchantRef = doc(db, "merchants", merchantId);
      const currentMerchant = merchants.find(m => m.id === merchantId);
      
      if (url === currentMerchant?.originalMenuImage) {
        const nextPhoto = currentMerchant.menu_thumbnails?.length > 0 ? currentMerchant.menu_thumbnails[0] : null;
        
        if (nextPhoto) {
          await updateDoc(merchantRef, {
            originalMenuImage: nextPhoto,
            menu_thumbnails: arrayRemove(nextPhoto)
          });
        } else {
          await updateDoc(merchantRef, {
            originalMenuImage: deleteField()
          });
        }
      } else {
        await updateDoc(merchantRef, {
          menu_thumbnails: arrayRemove(url)
        });
      }
      
      // Update local state
      setMerchants(prev => prev.map(m => {
        if (m.id === merchantId) {
          let updatedOriginal = m.originalMenuImage;
          let updatedThumbnails = [...(m.menu_thumbnails || [])];

          if (url === m.originalMenuImage) {
            const nextPhoto = updatedThumbnails.length > 0 ? updatedThumbnails[0] : null;
            if (nextPhoto) {
              updatedOriginal = nextPhoto;
              updatedThumbnails = updatedThumbnails.slice(1);
            } else {
              updatedOriginal = null;
            }
          } else {
            updatedThumbnails = updatedThumbnails.filter(u => u !== url);
          }

          return { 
            ...m, 
            originalMenuImage: updatedOriginal,
            menu_thumbnails: updatedThumbnails 
          };
        }
        return m;
      }));
      
      setSelectedMerchant(prev => {
        if (prev && prev.id === merchantId) {
          let updatedOriginal = prev.originalMenuImage;
          let updatedThumbnails = [...(prev.menu_thumbnails || [])];

          if (url === prev.originalMenuImage) {
            const nextPhoto = updatedThumbnails.length > 0 ? updatedThumbnails[0] : null;
            if (nextPhoto) {
              updatedOriginal = nextPhoto;
              updatedThumbnails = updatedThumbnails.slice(1);
            } else {
              updatedOriginal = null;
            }
          } else {
            updatedThumbnails = updatedThumbnails.filter(u => u !== url);
          }

          return { 
            ...prev, 
            originalMenuImage: updatedOriginal,
            menu_thumbnails: updatedThumbnails 
          };
        }
        return prev;
      });

      showToast("Foto dihapus", "success");
    } catch (error) {
      console.error("Delete error:", error);
      showToast("Gagal menghapus", "error");
    }
  }, [db, merchants]);



  const totalAmount = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.qty), 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

  const topRated = useMemo(() => merchants.slice(0, 4), [merchants]);

  const handleMerchantClick = useCallback((merchant) => {
    setSelectedMerchant(merchant);
  }, []);

  const handleToggleExpand = useCallback((merchantId) => {
    setExpandedCardId(prev => prev === merchantId ? null : merchantId);
  }, []);



  // Observer Logic Fix
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (isLoading || isMoreLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchMerchants(false);
      }
    }, { threshold: 0.1 });
    if (node) observer.current.observe(node);
  }, [isLoading, isMoreLoading, hasMore]);

  // End of helper hooks/functions

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen pb-40">
      
      {/* App Header (Glassmorphism) */}
      {/* Fixed Sticky Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-outline pt-6 pb-4 px-6">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-on-surface-variant flex-1 min-w-0" onClick={() => setShowAddressPicker(true)}>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-none">
              <span className="material-symbols-outlined">location_on</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest leading-none text-primary">Kirim Ke</span>
              <span className="text-sm font-bold text-on-surface mt-1 truncate">{locationName}</span>
            </div>
            <span className="material-symbols-outlined text-on-surface/50 text-sm">expand_more</span>
          </div>
        </div>

        {/* Advanced Search Entry */}
        <div 
          className="max-w-xl mx-auto mt-4 relative cursor-pointer group"
          onClick={() => setIsSearchOpen(true)}
        >
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-on-surface/50 text-xl group-hover:text-primary transition-colors">search</span>
          </div>
          <div className="w-full bg-on-surface/5 border border-outline rounded-2xl py-3.5 pl-12 pr-12 text-sm text-on-surface/40 font-medium shadow-inner group-hover:bg-on-surface/10 transition-all">
            {foodUI.searchPlaceholder}
          </div>
          <div className="absolute right-4 inset-y-0 flex items-center pointer-events-none">
             <span className="material-symbols-outlined text-on-surface/20 scale-75">north_west</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto pt-6">
        
        {/* Category Tabs */}
        {!isLoading && merchants.length > 0 && (
          <section className="px-6 mb-8 overflow-x-auto no-scrollbar flex items-center gap-3">
            {categories.map((cat, idx) => (
              <button 
                key={idx}
                onClick={() => setActiveCategory(cat)}
                className={`flex-none px-6 py-2.5 rounded-full font-bold text-xs tracking-wide transition-all active:scale-95 ${
                  activeCategory === cat 
                    ? 'kinetic-gradient bg-primary text-black shadow-lg shadow-primary/20' 
                    : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface border border-outline'
                }`}
              >
                {cat}
              </button>
            ))}
          </section>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 gap-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-on-surface-variant text-sm font-medium animate-pulse">{foodUI.loadingMsg}</p>
          </div>
        ) : (
          <>
            {/* Top Picks Horizontal Scroll */}
            {activeCategory === 'All' && topRated.length > 0 && (
              <section className="mb-10 w-full overflow-hidden">
                <div className="px-6 mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-headline font-black text-on-surface uppercase tracking-tight">{foodUI.topRatedLabel}</h2>
                </div>
                <div className="flex overflow-x-auto gap-4 px-6 pb-6 no-scrollbar snap-x">
                  {topRated.map((merchant) => (
                    <m.div 
                      whileHover={{ y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      key={merchant.id} 
                      onClick={() => handleMerchantClick(merchant)}
                      className="snap-start flex-none w-[260px] h-[320px] rounded-3xl overflow-hidden relative cursor-pointer group bg-surface-container-highest border border-outline shadow-2xl"
                    >
                      {merchant.image || merchant.originalMenuImage ? (
                        <img src={getOptimizedImageUrl(merchant.image || merchant.originalMenuImage, { width: 400, height: 300 })} alt={merchant.name} className="w-full h-[60%] object-cover transition-transform duration-700 group-hover:scale-110" />
                      ) : (
                        <div className="h-[60%] w-full">
                          <PlaceholderImage name={merchant.name} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="glass-panel px-2 py-0.5 rounded-md flex items-center gap-1 border border-primary/20">
                            <span className="material-symbols-outlined text-[10px] text-primary" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                            <span className="text-[10px] font-bold text-primary">{merchant.rating || '4.5'}</span>
                          </div>
                          <span className="text-[10px] text-on-surface/50 bg-on-surface/5 px-2 py-0.5 rounded-md">{merchant.deliveryTime || '20'} Min</span>
                        </div>
                        <h3 className="text-xl font-headline font-black text-on-surface leading-tight drop-shadow-lg line-clamp-2">{merchant.name}</h3>
                        <p className="text-xs text-primary mt-1 font-medium">{merchant.category}</p>
                      </div>
                    </m.div>
                  ))}
                </div>
              </section>
            )}

            {/* Merchant Feed */}
            <section className="px-6 space-y-6">
              <h2 className="text-sm font-label font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-4">
                {activeCategory === 'All' ? foodUI.exploreLabel : `Pilihan ${activeCategory}`}
              </h2>
              
              <m.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-4"
              >
                {merchants.map(merchant => (
                  <MerchantCard 
                    key={merchant.id}
                    merchant={merchant}
                    onClick={handleMerchantClick}
                    variants={itemVariants}
                    isExpanded={expandedCardId === merchant.id}
                    onToggleExpand={handleToggleExpand}
                    onAddToCart={handleAddToCart}
                    onManualOrderSubmit={handleManualOrderSubmit}
                    onDeleteMenuThumbnail={handleDeleteMenuThumbnail}
                    isAdmin={isAdmin}
                  />
                ))}

                {/* Infinite Scroll Sentinel */}
                {hasMore && (
                  <div 
                    className="py-10 flex justify-center items-center"
                    ref={lastElementRef}
                  >
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  </div>
                )}
                
                {!isLoading && (error || merchants.length === 0) && (
                  <div className="text-center py-20 bg-surface-container-low rounded-3xl border border-dashed border-outline/20 space-y-4">
                    {error ? (
                      <>
                        <div className="bg-error/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto border border-error/20">
                          <span className="material-symbols-outlined text-error text-3xl">error</span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-on-surface font-black text-lg">Waduh, Ada Masalah!</p>
                          <p className="text-on-surface/60 text-sm max-w-[250px] mx-auto">{error}</p>
                        </div>
                        <button 
                          onClick={() => fetchMerchants(true)}
                          className="bg-primary text-black px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg"
                        >
                          Coba Lagi
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-6xl text-primary/20">search_off</span>
                        <p className="text-on-surface font-bold">Maaf, belum ada merchant di kategori ini</p>
                      </>
                    )}
                  </div>
                )}
              </m.div>
            </section>
          </>
        )}
      </main>

      {/* Advanced Search Overlay */}
      <AroFoodSearch 
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onMerchantClick={handleMerchantClick}
      />



      {/* Merchant Menu Sheet / Modal */}
      <AnimatePresence>
        {selectedMerchant && (
          <Suspense fallback={null}>
            <MerchantDetailSheet 
              merchant={selectedMerchant}
              onClose={() => setSelectedMerchant(null)}
              isAdmin={isAdmin}
              isUploading={isUploading}
              uploadStatus={uploadStatus}
              onPhotoUpload={handleAdminPhotoUpload}
              onAddToCart={handleAddToCart}
              onManualOrderSubmit={handleManualOrderSubmit}
              onDeleteMenuThumbnail={handleDeleteMenuThumbnail}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Address Picker Overlay */}
      <AnimatePresence>
        {showAddressPicker && (
          <m.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-md p-4"
          >
             <m.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="w-full max-w-xl bg-surface-container-high rounded-[2.5rem] p-6 space-y-4 shadow-2xl border border-outline"
             >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-headline font-black text-lg text-on-surface uppercase tracking-tight">{foodUI.modalTitle}</h3>
                  <button onClick={() => setShowAddressPicker(false)} className="w-8 h-8 flex justify-center items-center rounded-full bg-on-surface/5 text-on-surface-variant hover:text-on-surface transition-colors">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                
                <div className="flex flex-col gap-3">
                  {/* Map Picker Access Button */}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        setShowAddressPicker(false);
                        navigate('/location-picker?mode=foodDelivery');
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-black p-3.5 rounded-2xl font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">map</span>
                      {foodUI.mapBtn}
                    </button>
                    
                    <button 
                      onClick={() => {
                        if (foodDeliveryLocation) {
                           if(window.confirm('Hapus pilihan lokasi saat ini?')) {
                             setFoodDelivery(null);
                             setShowAddressPicker(false);
                           }
                        } else {
                          setShowAddressPicker(false);
                          navigate('/location-picker?mode=foodDelivery');
                        }
                      }}
                      className={`w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all border ${foodDeliveryLocation ? 'bg-error/10 border-error/20 text-error' : 'bg-on-surface/5 border-outline text-on-surface'}`}
                    >
                      <span className="material-symbols-outlined text-sm">{foodDeliveryLocation ? 'delete' : 'autorenew'}</span>
                      {foodDeliveryLocation ? 'Hapus' : 'Ganti'}
                    </button>
                  </div>

                  {savedAddresses.length > 0 ? (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 scrollbar-none">
                    {savedAddresses.map(addr => (
                      <button 
                        key={addr.id}
                        onClick={() => selectSavedAddress(addr)}
                        className="w-full flex items-center gap-4 bg-surface-container-low p-4 rounded-2xl border border-outline hover:border-primary/40 transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-sm">
                            {String(addr.label || '').toLowerCase() === 'rumah' ? 'home' : String(addr.label || '').toLowerCase() === 'kantor' ? 'work' : 'push_pin'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-on-surface mb-0.5">{addr.label}</p>
                          <p className="text-[10px] text-on-surface-variant line-clamp-1">{addr.address}</p>
                        </div>
                        <span className="material-symbols-outlined text-primary/50 text-sm">chevron_right</span>
                      </button>
                    ))}
                  </div>
                  ) : (
                    <p className="text-center text-sm text-on-background/50 py-4">Belum ada alamat tersimpan. Tambah alamat di Profil.</p>
                  )}
                </div>
             </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Action Bar (Cart Summary) */}
      <AnimatePresence>
        {totalItems > 0 && (
          <m.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`fixed ${selectedMerchant ? 'bottom-6' : 'bottom-24'} w-full z-[60] pointer-events-none transition-all duration-300 left-0`}
          >
            <div className="max-w-xl mx-auto px-6 relative">
              <div className="kinetic-gradient text-black px-6 py-4 rounded-2xl flex items-center justify-between shadow-2xl border border-primary/20 pointer-events-auto backdrop-blur-xl">
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{totalItems} {totalItems > 1 ? 'ITEMS' : 'ITEM'} IN CART</span>
                    {[...new Set(cart.map(i => i.merchantId))].length > 1 && (
                      <span className="text-[8px] font-black bg-black/20 text-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Multi-Warung</span>
                    )}
                    <button 
                      onClick={() => {
                        if(window.confirm('Hapus semua isi keranjang?')) clearCart();
                      }}
                      className="text-[10px] font-black text-error/60 hover:text-error uppercase tracking-tighter transition-colors flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-[12px]">delete</span>
                      Hapus
                    </button>
                  </div>
                  <span className="text-lg font-bold">Rp {totalAmount.toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => navigate('/checkout')}
                  className="bg-black text-primary px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider flex items-center gap-2 active:scale-95 transition-all shadow-lg hover:shadow-black/40"
                >
                  Checkout
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border ${toast.type === 'error' ? 'bg-error/20 border-error text-error' : 'bg-primary/20 border-primary text-primary'}`}>
            <span className="material-symbols-outlined text-lg">
              {toast.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span className="text-xs font-black uppercase tracking-widest">{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
}

export default function AroFoodWithErrorBoundary(props) {
  return (
    <ErrorBoundary>
      <AroFood {...props} />
    </ErrorBoundary>
  );
}
