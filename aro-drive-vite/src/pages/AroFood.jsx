import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrderStore } from '../store/orderStore';
import { useUserStore } from '../store/userStore';
import { db, storage } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteField,
  query,
  where,
  limit,
  startAfter,
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
const PlaceholderImage = ({ name }) => (
  <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#0A0A0A] flex justify-center items-center relative overflow-hidden group">
     <span className="text-6xl font-headline font-black text-white/5 uppercase tracking-widest absolute">{name?.substring(0, 3)}</span>
     <div className="absolute inset-0 bg-primary/5 transition-opacity group-hover:bg-primary/20" />
     <span className="material-symbols-outlined text-primary/20 text-4xl transform group-hover:scale-125 transition-transform duration-500">restaurant</span>
  </div>
);

// Isolated Component to prevent full page re-render on keystroke
const ManualOrderInput = ({ merchant, onSubmit }) => {
  const [text, setText] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-label font-black uppercase tracking-widest text-white/50 pt-2 pb-2">Tulis Pesanan Anda</h3>
      </div>
      
      <div className="relative">
        <textarea 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Contoh: Nasi Goreng 2 piring pedas, Es Teh 1 tawar..."
          className="w-full bg-surface-container-low border border-white/10 rounded-3xl p-6 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40 transition-all font-medium min-h-[150px] shadow-inner"
        />
        <div className="absolute top-4 right-4 animate-pulse">
            <span className="material-symbols-outlined text-primary/30">edit_note</span>
        </div>
      </div>

      <button 
        onClick={() => {
          onSubmit(merchant, text);
          setText('');
        }}
        disabled={!text.trim()}
        className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all overflow-hidden relative group ${text.trim() ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'bg-white/5 text-white/20'}`}
      >
         <span className="relative z-10 flex items-center justify-center gap-2">
           <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
           Masukkan Keranjang
         </span>
         {text.trim() && (
           <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
         )}
      </button>
      
      <p className="text-[10px] text-center text-on-surface-variant/50 italic px-4">
        Catatan: Nanti driver kami akan mengonfirmasi total biaya belanjaan setelah melihat menu di lokasi.
      </p>
    </div>
  );
};

function AroFood() {
  const navigate = useNavigate();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Debouncing search query to avoid too many Firestore calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fixed categories for faster loading
  const categories = ['All', 'Nasi Goreng', 'Nasi', 'Seblak', 'Ayam', 'Bebek', 'Bakso', 'Mie', 'Cafe', 'Pecel', 'Lesehan', 'Pentol', 'Lalapan'];

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
      let q = collection(db, "merchants");
      let constraints = [];

      // Priority 1: Deep Search (Keywords array-contains)
      if (debouncedSearch.trim() !== '') {
        const s = debouncedSearch.trim().toLowerCase();
        // Note: For multi-word search, you'd need a more complex strategy
        // This handles the most important word or a single word search perfectly
        const firstWord = s.split(/\s+/)[0]; 
        constraints.push(where("keywords", "array-contains", firstWord));
        constraints.push(orderBy("rating", "desc"));
      } 
      // Priority 2: Category
      else if (activeCategory !== 'All') {
        constraints.push(where("category", "==", activeCategory));
        constraints.push(orderBy("rating", "desc"));
      } 
      // Priority 3: Default (All)
      else {
        constraints.push(orderBy("rating", "desc"));
      }

      constraints.push(limit(12));

      // Pagination
      if (!isNew && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }

      const finalQuery = query(q, ...constraints);
      const querySnapshot = await getDocs(finalQuery);
      
      const newDocs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
      setHasMore(querySnapshot.docs.length === 12);
      
      if (isNew) {
        setMerchants(newDocs);
      } else {
        setMerchants(prev => [...prev, ...newDocs]);
      }
    } catch (error) {
      console.error("Error fetching merchants:", error);
    } finally {
      setIsLoading(false);
      setIsMoreLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants(true);
  }, [activeCategory, debouncedSearch]);

  // Sync locationName with foodDeliveryLocation
  useEffect(() => {
    if (foodDeliveryLocation) {
      setLocationName(foodDeliveryLocation.address);
    } else {
      setLocationName('Pilih Lokasi Pengiriman');
    }
  }, [foodDeliveryLocation]);

  // Initial Geolocation - only if no location is selected
  useEffect(() => {
    // If we already have a location in store, don't do anything
    if (foodDeliveryLocation) return;

    // We no longer auto-detect location to respect user request for manual input.
    // User must pick location manually via the header.
    console.log("Auto-location detection disabled for initial load.");
  }, [foodDeliveryLocation]);

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

  const handleManualOrderSubmit = (merchant, text) => {
    if (!text.trim()) return;
    
    // Create a special menu item for manual order
    const manualItem = {
      id: `manual-${Date.now()}`,
      name: `Pesanan Manual: ${text.substring(0, 20)}...`,
      price: 0, // Customer might not know price, or we can add an input later
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
  };

  const handleAdminPhotoUpload = async (e, merchantId) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('Mengunggah...');

    try {
      const storageRef = ref(storage, `merchant_menus/${merchantId}/${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update merchant document with the photo URL and CLEAR dummy menu
      const merchantRef = doc(db, "merchants", merchantId);
      await updateDoc(merchantRef, {
        originalMenuImage: downloadURL,
        menu: deleteField() // Remove dummy menu as per "hapus saja" request
      });

      // Update local state
      setMerchants(prev => prev.map(m => m.id === merchantId ? { ...m, originalMenuImage: downloadURL, menu: [] } : m));
      setSelectedMerchant(prev => prev ? { ...prev, originalMenuImage: downloadURL, menu: [] } : null);
      
      setUploadStatus('Berhasil diunggah!');
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus('Gagal unggah.');
    } finally {
      setIsUploading(false);
    }
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  // Filtered merchants is now just the merchants state since we search on server
  const filteredMerchants = merchants;

  const topRated = merchants.filter(m => m.rating >= 4.0).slice(0, 4);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen pb-40">
      
      {/* App Header (Glassmorphism) */}
      {/* Fixed Sticky Header */}
      <header className="sticky top-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5 pt-6 pb-4 px-6">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-on-surface-variant flex-1 min-w-0" onClick={() => setShowAddressPicker(true)}>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-none">
              <span className="material-symbols-outlined">location_on</span>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest leading-none text-primary">Kirim Ke</span>
              <span className="text-sm font-bold text-white mt-1 truncate">{locationName}</span>
            </div>
            <span className="material-symbols-outlined text-white/50 text-sm">expand_more</span>
          </div>
        </div>

        {/* Search Mockup */}
        <div className="max-w-xl mx-auto mt-4 relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-white/50 text-xl">search</span>
          </div>
          <input 
            type="text" 
            placeholder="Mau makan apa hari ini?" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-12 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 transition-colors font-medium shadow-inner"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-4 inset-y-0 flex items-center text-white/30 hover:text-white"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          )}
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
                    : 'bg-surface-container-highest text-on-surface-variant hover:text-white border border-white/5'
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
            <p className="text-on-surface-variant text-sm font-medium animate-pulse">Menghidangkan rekomendasi...</p>
          </div>
        ) : (
          <>
            {/* Top Picks Horizontal Scroll - Hidden when searching */}
            {activeCategory === 'All' && searchQuery === '' && topRated.length > 0 && (
              <section className="mb-10 w-full overflow-hidden">
                <div className="px-6 mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-headline font-black text-white uppercase tracking-tight">Top Rated🔥</h2>
                </div>
                <div className="flex overflow-x-auto gap-4 px-6 pb-6 no-scrollbar snap-x">
                  {topRated.map((merchant) => (
                    <motion.div 
                      whileHover={{ y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      key={merchant.id} 
                      onClick={() => setSelectedMerchant(merchant)}
                      className="snap-start flex-none w-[260px] h-[320px] rounded-3xl overflow-hidden relative cursor-pointer group bg-surface-container-highest border border-white/5 shadow-2xl"
                    >
                      {merchant.image ? (
                        <img src={merchant.image} alt={merchant.name} className="w-full h-[60%] object-cover transition-transform duration-700 group-hover:scale-110" />
                      ) : (
                        <div className="h-[60%] w-full">
                          <PlaceholderImage name={merchant.name} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent"></div>
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="glass-panel px-2 py-0.5 rounded-md flex items-center gap-1 border border-primary/20">
                            <span className="material-symbols-outlined text-[10px] text-primary" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                            <span className="text-[10px] font-bold text-primary">{merchant.rating || '4.5'}</span>
                          </div>
                          <span className="text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-md">{merchant.deliveryTime || '20'} Min</span>
                        </div>
                        <h3 className="text-xl font-headline font-black text-white leading-tight drop-shadow-lg line-clamp-2">{merchant.name}</h3>
                        <p className="text-xs text-primary mt-1 font-medium">{merchant.category}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Merchant Feed */}
            <section className="px-6 space-y-6">
              <h2 className="text-sm font-label font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-4">
                {searchQuery !== '' 
                  ? `Hasil pencarian "${searchQuery}"` 
                  : (activeCategory === 'All' ? 'Eksplorasi Rasa' : `Pilihan ${activeCategory}`)}
              </h2>
              
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-4"
              >
                {filteredMerchants.map(merchant => (
                  <motion.div 
                    variants={itemVariants}
                    key={merchant.id} 
                    onClick={() => setSelectedMerchant(merchant)}
                    className="flex h-32 bg-surface-container-low rounded-2xl overflow-hidden group border border-transparent hover:border-primary/20 transition-colors cursor-pointer shadow-lg"
                  >
                    <div className="w-1/3 h-full relative overflow-hidden flex-none">
                      {merchant.image ? (
                        <img src={merchant.image} alt={merchant.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <PlaceholderImage name={merchant.name} />
                      )}
                    </div>
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-bold text-base text-white group-hover:text-primary transition-colors line-clamp-1">{merchant.name}</h3>
                          <div className="flex items-center gap-1 bg-[#1a1a1a] px-1.5 py-0.5 rounded text-xs flex-none">
                            <span className="material-symbols-outlined text-[10px] text-yellow-400" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                            <span className="font-bold">{merchant.rating || '4.0'}</span>
                          </div>
                        </div>
                        <p className="text-xs text-on-surface-variant line-clamp-1">{merchant.address}</p>
                      </div>
                      
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <span className="text-[10px] font-bold px-2 py-1 bg-primary/10 text-primary rounded-full">{merchant.category}</span>
                        <span className="text-xs font-bold text-white flex items-center gap-1 opacity-70">
                           <span className="material-symbols-outlined text-[14px]">schedule</span>
                           {merchant.deliveryTime || '25'} min
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Infinite Scroll Sentinel */}
                {hasMore && !searchQuery && (
                  <div 
                    className="py-10 flex justify-center items-center"
                    ref={(el) => {
                      if (el) {
                        const observer = new IntersectionObserver(entries => {
                          if (entries[0].isIntersecting && hasMore && !isLoading && !isMoreLoading) {
                            fetchMerchants(false);
                          }
                        }, { threshold: 0.1 });
                        observer.observe(el);
                      }
                    }}
                  >
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  </div>
                )}
                
                {filteredMerchants.length === 0 && (
                  <div className="text-center py-20 bg-surface-container-low rounded-3xl border border-dashed border-white/10">
                    <span className="material-symbols-outlined text-6xl mb-4 text-primary/20">search_off</span>
                    <p className="text-white font-bold">Maaf, tidak ditemukan hasil</p>
                    <p className="text-xs text-on-surface-variant mt-1">Coba kata kunci lain atau cek kategori berbeda</p>
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="mt-6 px-6 py-2 bg-primary text-black rounded-full font-bold text-xs uppercase"
                      >
                        Reset Pencarian
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            </section>
          </>
        )}
      </main>

      {/* Merchant Menu Sheet / Modal */}
      <AnimatePresence>
        {selectedMerchant && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-xl h-[85vh] sm:h-[80vh] sm:rounded-3xl rounded-t-[2.5rem] bg-surface-container flex flex-col shadow-2xl border border-white/10 overflow-hidden"
            >
              {/* Header Image */}
              <div className="h-48 rounded-t-[2.5rem] sm:rounded-t-3xl relative overflow-hidden flex-none">
                {selectedMerchant.image ? (
                  <img src={selectedMerchant.image} alt={selectedMerchant.name} className="w-full h-full object-cover" />
                ) : (
                  <PlaceholderImage name={selectedMerchant.name} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-black/50" />
                
                {/* Close button */}
                <button 
                  onClick={() => setSelectedMerchant(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-95"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Merchant Info */}
              <div className="px-6 py-4 flex-none border-b border-white/5 relative z-10 -mt-8 bg-surface-container rounded-t-[2rem]">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-headline font-black text-white tracking-tight">{selectedMerchant.name}</h2>
                    <p className="text-sm text-primary font-bold mt-1">{selectedMerchant.category}</p>
                  </div>
                  <div className="glass-panel bg-primary/10 px-3 py-1.5 rounded-xl flex flex-col items-center border border-primary/20">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-primary" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                      <span className="font-black text-white">{selectedMerchant.rating || '4.0'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-on-surface-variant flex items-center gap-4 mt-4">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">location_on</span> {selectedMerchant.address?.substring(0, 40)}...</span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">schedule</span> {selectedMerchant.deliveryTime || '25'} min</span>
                </div>
              </div>

              {/* Menu List / Manual Order View */}
              <div className="flex-1 overflow-y-auto px-6 py-4 pb-32">
                
                {/* Admin Upload Section */}
                {isAdmin && (
                  <div className="mb-8 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-3">Admin: Kelola Menu Foto</p>
                     <div className="flex items-center gap-3">
                        <input 
                          type="file" 
                          id="menu-upload"
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => handleAdminPhotoUpload(e, selectedMerchant.id)}
                        />
                        <label 
                          htmlFor="menu-upload"
                          className={`flex-1 h-12 flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${isUploading ? 'bg-white/10 text-white/50 animate-pulse' : 'bg-primary text-black hover:scale-[1.02]'}`}
                        >
                           <span className="material-symbols-outlined text-sm">{isUploading ? 'hourglass_top' : 'upload_file'}</span>
                           {uploadStatus || 'Unggah Foto Menu Baru'}
                        </label>
                     </div>
                     <p className="text-[9px] text-white/40 mt-2 italic">*Mengunggah foto baru akan otomatis menghapus daftar menu digital lama (dummy).</p>
                  </div>
                )}

                {/* Display Reference Photo if exists */}
                {selectedMerchant.originalMenuImage ? (
                  <div className="mb-6">
                    <h3 className="text-sm font-label font-black uppercase tracking-widest text-white/50 mb-4 sticky top-0 bg-surface-container pt-2 pb-2 z-10">Daftar Menu (Gunakan Foto)</h3>
                    <div className="rounded-3xl overflow-hidden border border-white/5 bg-surface-container-low shadow-xl">
                       <img 
                         src={selectedMerchant.originalMenuImage} 
                         alt="Menu" 
                         className="w-full object-contain max-h-[400px] hover:scale-105 transition-transform duration-500"
                         onClick={() => window.open(selectedMerchant.originalMenuImage, '_blank')}
                       />
                       <div className="p-3 bg-white/5 text-[10px] text-center text-white/50">
                         Ketuk foto untuk perbesar di tab baru 🔍
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 p-10 text-center opacity-30 border-2 border-dashed border-white/10 rounded-3xl">
                     <span className="material-symbols-outlined text-4xl mb-2">no_photography</span>
                     <p className="text-sm">Belum ada foto menu fisik dari resto ini.</p>
                  </div>
                )}

                {/* Single Text Input for Order */}
                <ManualOrderInput merchant={selectedMerchant} onSubmit={handleManualOrderSubmit} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Address Picker Overlay */}
      <AnimatePresence>
        {showAddressPicker && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-md p-4"
          >
             <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="w-full max-w-xl bg-surface-container-high rounded-[2.5rem] p-6 space-y-4 shadow-2xl border border-white/10"
             >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-headline font-black text-lg text-white uppercase tracking-tight">Kirim Ke Mana?</h3>
                  <button onClick={() => setShowAddressPicker(false)} className="w-8 h-8 flex justify-center items-center rounded-full bg-white/5 text-on-surface-variant hover:text-white transition-colors">
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
                      Pilih di Peta
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
                      className={`w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all border ${foodDeliveryLocation ? 'bg-error/10 border-error/20 text-error' : 'bg-white/5 border-white/10 text-white'}`}
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
                        className="w-full flex items-center gap-4 bg-surface-container-low p-4 rounded-2xl border border-white/5 hover:border-primary/40 transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-sm">
                            {addr.label?.toLowerCase() === 'rumah' ? 'home' : addr.label?.toLowerCase() === 'kantor' ? 'work' : 'push_pin'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-white mb-0.5">{addr.label}</p>
                          <p className="text-[10px] text-on-surface-variant line-clamp-1">{addr.address}</p>
                        </div>
                        <span className="material-symbols-outlined text-primary/50 text-sm">chevron_right</span>
                      </button>
                    ))}
                  </div>
                  ) : (
                    <p className="text-center text-sm text-white/50 py-4">Belum ada alamat tersimpan. Tambah alamat di Profil.</p>
                  )}
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom Action Bar (Cart Summary) */}
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div 
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
          </motion.div>
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

export default AroFood;
