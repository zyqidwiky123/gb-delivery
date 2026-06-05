import React, { useState, useEffect, useRef } from 'react';
import { motion as m, AnimatePresence } from 'framer-motion';
import { useAdminStore } from '../store/adminStore';
import { db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Separate component for placeholder image to keep it lightweight
const PlaceholderImage = ({ name }) => {
  const getInitial = (name) => {
    return name && typeof name === 'string' ? name.charAt(0).toUpperCase() : '?';
  };
  return (
    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center rounded-xl border border-on-background/5">
      <span className="text-xl font-black text-primary/50">{getInitial(name)}</span>
    </div>
  );
};

export default function AroFoodSearch({ isOpen, onClose, onMerchantClick }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [merchantsIndex, setMerchantsIndex] = useState([]);
  const [isLoadingIndex, setIsLoadingIndex] = useState(false);
  const workerRef = useRef(null);
  const inputRef = useRef(null);
  const { ui } = useAdminStore();

  // Deferred Fetching & Caching
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchIndex = async () => {
      try {
        const cachedData = sessionStorage.getItem('aro_food_search_index_v3');
        const cacheTime = sessionStorage.getItem('aro_food_search_index_v3_time');
        
        // Cache valid for 1 hour (3600000 ms)
        const isCacheValid = cachedData && cacheTime && (Date.now() - Number(cacheTime) < 3600000);
        
        if (isCacheValid) {
          const parsed = JSON.parse(cachedData);
          setMerchantsIndex(parsed);
          console.log(`[Search] Loaded ${parsed.length} items from cache v3`);
          return;
        }
        
        setIsLoadingIndex(true);
        console.log('[Search] Cache invalid or missing. Fetching from Firestore...');
        
        const q = query(
          collection(db, "merchants"), 
          where("type", "==", "food")
        );
        const snap = await getDocs(q);
        const index = snap.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d, // Spread all data to ensure no missing fields
            // Ensure core fields have fallbacks if needed for search
            name: d.name || '',
            category: d.category || '',
            rating: d.rating || 0,
            image: d.image || '',
            address: d.address || ''
          };
        });
        
        setMerchantsIndex(index);
        sessionStorage.setItem('aro_food_search_index_v3', JSON.stringify(index));
        sessionStorage.setItem('aro_food_search_index_v3_time', Date.now().toString());
        console.log(`[Search] Fetched ${index.length} items and cached v3.`);
      } catch (e) {
        console.error("[Search] Error fetching index:", e);
      } finally {
        setIsLoadingIndex(false);
      }
    };

    fetchIndex();
  }, [isOpen]);

  const searchUI = ui.foodSearch || {
    placeholder: 'Contoh: Mie Gacoan, Nasi Goreng...',
    trendingLabel: 'Sedang Trending 🔥',
    noResultsTitle: 'Hmm, tidak ketemu',
    noResultsDesc: 'Kami tidak dapat menemukan "{query}". Coba gunakan kata kunci lain.',
    clearBtn: 'Hapus Pencarian'
  };

  // Initialize Web Worker
  useEffect(() => {
    // Create worker only when component mounts
    workerRef.current = new Worker(new URL('../workers/searchWorker.js', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'INIT_DONE') {
        // Worker is ready
        console.log(`Search worker initialized with ${payload.count} items`);
      } else if (type === 'SEARCH_RESULTS') {
        // Update results
        if (payload.query === searchQueryRef.current) {
          setSearchResults(payload.results);
          setIsSearching(false);
        }
      }
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Update Worker Index when data changes
  useEffect(() => {
    if (workerRef.current && merchantsIndex && merchantsIndex.length > 0) {
      workerRef.current.postMessage({
        type: 'INIT',
        payload: {
          items: merchantsIndex
        }
      });
    }
  }, [merchantsIndex]);

  // Handle Search Input
  const searchQueryRef = useRef(searchQuery);
  useEffect(() => {
    searchQueryRef.current = searchQuery;
    
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    const timeoutId = setTimeout(() => {
      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'SEARCH',
          payload: { query: searchQuery }
        });
      }
    }, 250); // 250ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 300); // Wait for animation
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Stagger animation variants for results
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <AnimatePresence>
      <m.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col"
      >
        {/* Search Top Bar */}
        <div className="flex-none pt-6 px-6 pb-4 border-b border-on-background/5 bg-background">
          <div className="max-w-xl mx-auto flex items-center gap-4">
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-on-background/5 flex items-center justify-center text-on-background/50 active:scale-90 transition-all hover:bg-on-background/10"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-primary text-xl">search</span>
              </div>
              <input 
                ref={inputRef}
                type="text" 
                placeholder={searchUI.placeholder} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-on-background/5 border border-on-background/10 rounded-2xl py-3.5 pl-12 pr-12 text-sm text-on-background focus:outline-none focus:border-primary/50 focus:bg-on-background/10 transition-all font-medium"
              />
              {searchQuery && (
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-4 inset-y-0 flex items-center text-on-background/30 hover:text-on-background"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-xl mx-auto p-6 space-y-8 pb-24">
            
            {/* Loading Indicator */}
            {(isSearching || isLoadingIndex) && searchResults.length === 0 && (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
            )}

            {/* No Search Query: Show Suggestions */}
            {!searchQuery && (
              <m.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-background/30 mb-4">{searchUI.trendingLabel}</h3>
                  <div className="space-y-4">
                    {/* Show top 5 rated merchants as suggestions */}
                    {merchantsIndex.slice(0, 5).sort((a,b) => (b.rating||0) - (a.rating||0)).map((m) => (
                      <div 
                        key={m.id}
                        onClick={() => {
                          onMerchantClick(m);
                          onClose();
                        }}
                        className="flex items-center gap-4 group cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-none bg-surface-container-high border border-on-background/5">
                           {m.image ? (
                             <img src={m.image} alt={m.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                           ) : (
                             <PlaceholderImage name={m.name} />
                           )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-on-background group-hover:text-primary transition-colors">{String(m.name || '')}</p>
                          <p className="text-[10px] text-on-background/40">{String(m.category || '')} • {String(m.rating || '0.0')} Rating</p>
                        </div>
                        <span className="material-symbols-outlined text-on-background/10 group-hover:text-primary/40 group-hover:translate-x-1 transition-all">trending_up</span>
                      </div>
                    ))}
                  </div>
                </div>
              </m.div>
            )}

            {/* Search Results */}
            {searchQuery && !isSearching && searchResults.length > 0 && (
              <m.div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-background/30 mb-4">
                  {searchResults.length} Hasil ditemukan
                </h3>
                <m.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {searchResults.map(result => (
                    <m.div 
                      layout
                      variants={itemVariants}
                      whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                      whileTap={{ scale: 0.98 }}
                      key={`search-result-${result.id}`}
                      onClick={() => {
                        onMerchantClick(result);
                        onClose();
                      }}
                      className="flex h-24 bg-on-background/[0.02] border border-on-background/5 rounded-2xl overflow-hidden group cursor-pointer"
                    >
                       <div className="w-24 h-full relative overflow-hidden flex-none">
                          {result.image ? (
                            <img src={result.image} alt={result.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <PlaceholderImage name={result.name} />
                          )}
                       </div>
                       <div className="flex-1 p-3 flex flex-col justify-center">
                          <h4 className="font-bold text-sm text-on-background group-hover:text-primary transition-colors line-clamp-1">{String(result.name || '')}</h4>
                          <p className="text-[10px] text-on-background/50 line-clamp-1 mt-0.5">{String(result.address || '')}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[9px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded uppercase tracking-tighter">{String(result.category || '')}</span>
                            <div className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[10px] text-yellow-500" style={{fontVariationSettings: "'FILL' 1"}}>star</span>
                              <span className="text-[10px] font-bold text-on-background/70">{String(result.rating || '0.0')}</span>
                            </div>
                          </div>
                       </div>
                    </m.div>
                  ))}
                </m.div>
              </m.div>
            )}

            {/* Empty State */}
            {searchQuery && !isSearching && searchResults.length === 0 && (
              <m.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20"
              >
                <div className="w-20 h-20 bg-on-background/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-4xl text-on-background/20">search_off</span>
                </div>
                <h3 className="text-on-background font-bold mb-2">{searchUI.noResultsTitle}</h3>
                <p className="text-sm text-on-background/40 max-w-[250px] mx-auto">{searchUI.noResultsDesc.replace('{query}', searchQuery)}</p>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    inputRef.current?.focus();
                  }}
                  className="mt-6 px-6 py-2.5 bg-on-background/10 hover:bg-on-background/20 text-on-background rounded-full font-bold text-xs transition-colors"
                >
                  {searchUI.clearBtn}
                </button>
              </m.div>
            )}
          </div>
        </div>
      </m.div>
    </AnimatePresence>
  );
}
