import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/config';
import { collection, getDocs, updateDoc, doc, deleteDoc, getDoc, setDoc, serverTimestamp, query, orderBy, deleteField, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAdminStore } from '../store/adminStore';

const secondaryFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

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

function MerchantManagement() {
  const navigate = useNavigate();
  const { pricing } = useAdminStore();

  const [merchants, setMerchants] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [showAddMerchantModal, setShowAddMerchantModal] = useState(false);
  const [isAddingMerchant, setIsAddingMerchant] = useState(false);
  const [newMerchant, setNewMerchant] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    category: 'makanan',
    type: 'food'
  });
  const [isDeleting, setIsDeleting] = useState(null);
  const [showMenuGalleryModal, setShowMenuGalleryModal] = useState(false);
  const [selectedMerchantMenu, setSelectedMerchantMenu] = useState(null);

  const fetchMerchants = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "merchants"), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMerchants(list);
    } catch (error) {
      console.error("Error fetching merchants:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const handleAddMerchant = async (e) => {
    e.preventDefault();
    setIsAddingMerchant(true);

    let secondaryApp;
    try {
      const appName = `SecondaryApp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      secondaryApp = initializeApp(secondaryFirebaseConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        newMerchant.email, 
        newMerchant.password
      );
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "merchants", uid), {
        name: newMerchant.name,
        email: newMerchant.email,
        phone: newMerchant.phone,
        address: newMerchant.address,
        category: newMerchant.category,
        type: newMerchant.type || 'food',
        verified: true,
        isOpen: true,
        rating: 5.0,
        reviewsCount: 0,
        createdAt: serverTimestamp(),
        role: 'merchant'
      });

      alert("Mitra Merchant Berhasil Didaftarkan!");
      setShowAddMerchantModal(false);
      setNewMerchant({ name: '', email: '', phone: '', address: '', category: 'makanan', type: 'food', password: '' });
      fetchMerchants();
    } catch (error) {
      console.error("Error adding merchant:", error);
      alert("Gagal mendaftarkan merchant: " + error.message);
    } finally {
      setIsAddingMerchant(false);
    }
  };

  const handleDeleteMerchant = async (merchant) => {
    if (!window.confirm(`Hapus merchant ${merchant.name || 'ini'}? Data merchant akan hilang permanen!`)) return;

    setIsDeleting(merchant.id);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        throw new Error('Sesi admin berakhir. Silakan login ulang.');
      }

      const response = await fetch('https://asia-southeast2-gb-delivery-41bf6.cloudfunctions.net/deleteMerchant', { 
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ merchantId: merchant.id })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal hapus merchant');
      }

      alert("Merchant berhasil dihapus!");
      fetchMerchants();
    } catch (error) {
      console.error("Error deleting merchant:", error);
      alert("Gagal hapus merchant: " + error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handlePhotoUpload = async (merchantId, files) => {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    
    setUploadingId(merchantId);
    try {
      const merchantRef = doc(db, "merchants", merchantId);
      const merchantSnap = await getDoc(merchantRef);
      const merchantData = merchantSnap.exists() ? merchantSnap.data() : {};
      const hasOriginal = !!merchantData.originalMenuImage;
      
      const newUrls = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const safeName = `menu_${Date.now()}_${i}.${ext}`;
        const storagePath = `manual_menus/${merchantId}/${safeName}`;
        const storageRef = ref(storage, storagePath);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURLWithRetry(snapshot.ref);
        newUrls.push(downloadURL);
      }

      if (newUrls.length === 0) {
        alert("Tidak ada foto yang berhasil diunggah.");
        return;
      }

      const updateData = {};

      if (merchantData.menu !== undefined) {
        updateData.menu = deleteField();
      }

      if (newUrls.length > 0) {
        updateData.originalMenuImage = newUrls[0];
        
        const thumbnailsToAdd = [...newUrls.slice(1)];
        if (merchantData.originalMenuImage) {
          thumbnailsToAdd.push(merchantData.originalMenuImage);
        }
        
        if (thumbnailsToAdd.length > 0) {
          updateData.menu_thumbnails = arrayUnion(...thumbnailsToAdd);
        }
      }

      await updateDoc(merchantRef, updateData);

      alert(`Menu berhasil diunggah! (${newUrls.length} foto)`);
      fetchMerchants();
    } catch (error) {
      console.error("Upload error:", error);
      alert("Gagal mengunggah menu: " + error.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeleteMenuPhoto = async (merchantId, photoUrl, isOriginal) => {
    if (!window.confirm("Hapus foto ini dari galeri merchant?")) return;

    try {
      const merchantRef = doc(db, "merchants", merchantId);
      const updateData = {};

      if (isOriginal) {
        if (selectedMerchantMenu.menu_thumbnails && selectedMerchantMenu.menu_thumbnails.length > 0) {
          const firstThumb = selectedMerchantMenu.menu_thumbnails[0];
          updateData.originalMenuImage = firstThumb;
          updateData.menu_thumbnails = arrayRemove(firstThumb);
        } else {
          updateData.originalMenuImage = deleteField();
        }
      } else {
        updateData.menu_thumbnails = arrayRemove(photoUrl);
      }

      await updateDoc(merchantRef, updateData);
      
      const updatedMerchant = { ...selectedMerchantMenu };
      if (isOriginal) {
        if (selectedMerchantMenu.menu_thumbnails && selectedMerchantMenu.menu_thumbnails.length > 0) {
          updatedMerchant.originalMenuImage = selectedMerchantMenu.menu_thumbnails[0];
          updatedMerchant.menu_thumbnails = selectedMerchantMenu.menu_thumbnails.slice(1);
        } else {
          delete updatedMerchant.originalMenuImage;
        }
      } else {
        updatedMerchant.menu_thumbnails = selectedMerchantMenu.menu_thumbnails.filter(url => url !== photoUrl);
      }
      setSelectedMerchantMenu(updatedMerchant);
      
      setMerchants(prev => prev.map(m => m.id === merchantId ? updatedMerchant : m));
      
      alert("Foto berhasil dihapus");
    } catch (error) {
      console.error("Delete photo error:", error);
      alert("Gagal menghapus foto: " + error.message);
    }
  };

  const handleSyncPopularity = async (merchant) => {
    setUploadingId(merchant.id);
    try {
      const response = await fetch('https://asia-southeast2-gb-delivery-41bf6.cloudfunctions.net/syncMerchantPopularityFromMaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchantId: merchant.id
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync popularity');
      }

      alert(`Berhasil sinkronisasi popularitas! (${result.reviewsCount} ulasan)`);
      fetchMerchants();
    } catch (error) {
      console.error("Sync popularity error:", error);
      alert("Gagal sinkronisasi: " + error.message);
    } finally {
      setUploadingId(null);
    }
  };

  const toggleVerifyMerchant = async (merchantId, currentStatus, currentReviewsCount) => {
    try {
      const updates = { verified: !currentStatus };
      if (currentReviewsCount === undefined) updates.reviewsCount = 0;
      await updateDoc(doc(db, "merchants", merchantId), updates);
      fetchMerchants();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredMerchants = merchants.filter(m => 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 gap-6">
        <div>
          <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">Food Merchant Management</h3>
          <p className="text-sm text-on-surface-variant font-medium">Kelola daftar warung dan upload foto menu fisik untuk manual order</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="Cari warung/resto..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-container-highest border-none rounded-2xl px-6 py-3 text-sm w-full focus:ring-2 focus:ring-primary transition-all text-white"
            />
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary">search</span>
          </div>
          <button 
            onClick={() => setShowAddMerchantModal(true)}
            className="w-full sm:w-auto bg-primary text-black font-black px-6 py-3 rounded-2xl hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
          >
            <span className="material-symbols-outlined text-sm">storefront</span>
            Tambah Merchant
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-primary uppercase tracking-[0.3em]">Memuat Merchant...</p>
        </div>
      ) : (
        <div className="space-y-12">
          {['makanan', 'minuman', 'camilan', 'bakso', 'seblak', 'nasi', 'mie', 'ayam', 'others'].map(catId => {
            const merchantsInCat = filteredMerchants.filter(m => {
              if (catId === 'others') {
                return !['makanan', 'minuman', 'camilan', 'bakso', 'seblak', 'nasi', 'mie', 'ayam'].includes(m.category);
              }
              return m.category === catId;
            });

            if (merchantsInCat.length === 0) return null;

            return (
              <div key={catId} className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-[2px] flex-1 bg-white/5"></div>
                  <h4 className="text-lg font-black text-primary font-headline uppercase italic tracking-widest px-6 border border-primary/20 rounded-full py-2 bg-primary/5 shadow-lg shadow-primary/5">
                    {catId === 'others' ? 'Lainnya' : catId.charAt(0).toUpperCase() + catId.slice(1)}
                  </h4>
                  <div className="h-[2px] flex-1 bg-white/5"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {merchantsInCat.map((m) => (
                    <div key={m.id} className="bg-surface-container-low rounded-[2rem] p-6 border border-white/5 hover:border-primary/20 transition-all group relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5">
                          {m.image && !m.image.includes('storage.googleapis.com') ? (
                            <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                          ) : m.originalMenuImage ? (
                            <img src={m.originalMenuImage} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-primary">storefront</span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {m.originalMenuImage ? (
                            <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase rounded-full border border-green-500/20">
                              Menu OK ({1 + (m.menu_thumbnails?.length || 0)} Foto)
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-error/10 text-error text-[10px] font-black uppercase rounded-full border border-error/20">Belum Ada Menu</span>
                          )}
                          {m.verified ? (
                            <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-full border border-primary/20 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">verified</span> Verified
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-zinc-500/10 text-zinc-500 text-[10px] font-black uppercase rounded-full border border-white/5">Pending Review</span>
                          )}
                        </div>
                      </div>
                      
                      <h4 className="text-lg font-black text-white font-headline mb-1 uppercase tracking-tight">{m.name}</h4>
                        <div className="flex items-center gap-2 mb-6">
                          <p className="text-xs text-on-surface-variant font-medium line-clamp-1 flex-1">{m.address || "Kab. Blitar"}</p>
                          <button 
                            onClick={async () => {
                              const newType = m.type === 'shop' ? 'food' : 'shop';
                              try {
                                const updates = { type: newType };
                                if (m.reviewsCount === undefined) updates.reviewsCount = 0;
                                await updateDoc(doc(db, "merchants", m.id), updates);
                                fetchMerchants();
                              } catch (e) { alert(e.message); }
                            }}
                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${m.type === 'shop' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}
                          >
                            {m.type === 'shop' ? 'SHOP' : 'FOOD'}
                          </button>
                          {m.reviewsCount !== undefined && (
                            <div className="flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                              <span className="material-symbols-outlined text-[12px] text-primary">trending_up</span>
                              <span className="text-[10px] font-black text-primary">{m.reviewsCount}</span>
                            </div>
                          )}
                        </div>
                      
                      <div className="pt-4 border-t border-white/5 space-y-4">
                        <button 
                          onClick={() => toggleVerifyMerchant(m.id, m.verified, m.reviewsCount)}
                          className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                            m.verified ? 'bg-error/10 text-error border border-error/20 hover:bg-error hover:text-white' : 'bg-primary text-black hover:shadow-lg active:scale-95'
                          }`}
                        >
                          {m.verified ? 'Unverify Merchant' : 'Verify Merchant Now'}
                        </button>

                        <div className="flex gap-3">
                          <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest cursor-pointer transition-all ${
                            uploadingId === m.id ? 'bg-zinc-800 text-zinc-500' : 'bg-white/5 text-white border border-white/10 hover:bg-white/10 active:scale-95'
                          }`}>
                            <span className="material-symbols-outlined text-sm">
                              {uploadingId === m.id ? 'sync' : 'upload_file'}
                            </span>
                            {uploadingId === m.id ? 'SABAR...' : 'Menu'}
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              multiple
                              disabled={uploadingId === m.id}
                              onChange={(e) => handlePhotoUpload(m.id, e.target.files)}
                            />
                          </label>
                          
                          {(m.originalMenuImage || (m.menu_thumbnails && m.menu_thumbnails.length > 0)) && (
                            <button 
                              onClick={() => {
                                setSelectedMerchantMenu(m);
                                setShowMenuGalleryModal(true);
                              }}
                              className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/10"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                            </button>
                          )}
                        </div>
                        
                          <div className="flex gap-3">

                            <button 
                              onClick={() => handleSyncPopularity(m)}
                              disabled={uploadingId === m.id}
                              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                                uploadingId === m.id ? 'bg-white/5 text-white/30' : 'border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-black active:scale-95'
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm">trending_up</span>
                              Popularity
                            </button>
                           {m.image && (
                              <button 
                                onClick={() => window.open(m.image, '_blank')}
                                className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white border border-white/10 hover:bg-white/20"
                              >
                                <span className="material-symbols-outlined text-sm">image</span>
                              </button>
                            )}
                          </div>
                          <button 
                            onClick={() => handleDeleteMerchant(m)}
                            disabled={isDeleting === m.id}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-error/10 text-error border border-error/20 hover:bg-error hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeleting === m.id ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <span className="material-symbols-outlined text-sm">delete</span>
                            )}
                            Hapus Merchant
                          </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Merchant Modal */}
      {showAddMerchantModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddMerchantModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">Pendaftaran Merchant</h3>
              </div>
              <button onClick={() => setShowAddMerchantModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white">close</span></button>
            </div>

            <form onSubmit={handleAddMerchant} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nama Merchant</label>
                <input required type="text" value={newMerchant.name} onChange={e => setNewMerchant({...newMerchant, name: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Warung Barokah" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email (Login)</label>
                  <input required type="email" value={newMerchant.email} onChange={e => setNewMerchant({...newMerchant, email: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="merchant@aro.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Password Default</label>
                  <input required type="password" value={newMerchant.password} onChange={e => setNewMerchant({...newMerchant, password: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="******" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nomor WhatsApp</label>
                  <input required type="tel" value={newMerchant.phone} onChange={e => setNewMerchant({...newMerchant, phone: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="0812..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Kategori</label>
                  <select required value={newMerchant.category} onChange={e => setNewMerchant({...newMerchant, category: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white appearance-none">
                    <option value="makanan">Makanan</option>
                    <option value="minuman">Minuman</option>
                    <option value="camilan">Camilan</option>
                    <option value="bakso">Bakso</option>
                    <option value="seblak">Seblak</option>
                    <option value="nasi">Nasi</option>
                    <option value="mie">Mie</option>
                    <option value="ayam">Ayam</option>
                    <option value="toko">Toko / Shop</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tipe Merchant</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setNewMerchant({...newMerchant, type: 'food'})} className={`py-3 rounded-xl font-bold text-xs transition-all ${newMerchant.type === 'food' ? 'bg-primary text-black' : 'bg-white/5 text-white'}`}>ARO FOOD</button>
                    <button type="button" onClick={() => setNewMerchant({...newMerchant, type: 'shop'})} className={`py-3 rounded-xl font-bold text-xs transition-all ${newMerchant.type === 'shop' ? 'bg-primary text-black' : 'bg-white/5 text-white'}`}>ARO SHOP</button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Alamat / Lokasi</label>
                <input required type="text" value={newMerchant.address} onChange={e => setNewMerchant({...newMerchant, address: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Jl. Merdeka No. 10, Blitar" />
              </div>

              <div className="pt-6">
                <button disabled={isAddingMerchant} type="submit" className="w-full bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                  {isAddingMerchant ? 'Mendaftarkan...' : 'Daftarkan Merchant Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Menu Gallery Modal */}
      {showMenuGalleryModal && selectedMerchantMenu && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => { setShowMenuGalleryModal(false); setSelectedMerchantMenu(null); }}></div>
          <div className="relative w-full max-w-4xl bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-white/5 flex justify-between items-start flex-shrink-0">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic mb-1">
                  Foto Menu: {selectedMerchantMenu.name}
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  Total: <span className="text-primary font-bold">
                    {1 + (selectedMerchantMenu.menu_thumbnails?.length || 0)} Foto
                  </span>
                </p>
              </div>
              <button 
                onClick={() => { setShowMenuGalleryModal(false); setSelectedMerchantMenu(null); }}
                className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-white">close</span>
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {/* Original Image */}
                {selectedMerchantMenu.originalMenuImage && (
                  <div className="group relative aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all">
                    <img 
                      src={selectedMerchantMenu.originalMenuImage} 
                      alt="Menu Utama" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/300x400?text=Gambar+Error';
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex items-end justify-between">
                      <span className="text-[10px] bg-primary text-black font-black px-2 py-1 rounded uppercase">Utama</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleDeleteMenuPhoto(selectedMerchantMenu.id, selectedMerchantMenu.originalMenuImage, true)}
                          className="w-8 h-8 bg-error/20 backdrop-blur-md rounded-full flex items-center justify-center text-error opacity-0 group-hover:opacity-100 hover:bg-error hover:text-white transition-all border border-error/30"
                          title="Hapus Foto Utama"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                        <button 
                          onClick={() => window.open(selectedMerchantMenu.originalMenuImage, '_blank')}
                          className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-all"
                        >
                          <span className="material-symbols-outlined text-xs">open_in_new</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thumbnails */}
                {selectedMerchantMenu.menu_thumbnails && selectedMerchantMenu.menu_thumbnails.map((thumbUrl, index) => (
                  <div key={index} className="group relative aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all">
                    <img 
                      src={thumbUrl} 
                      alt={`Menu ${index + 1}`} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/300x400?text=Gambar+Error';
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex items-end justify-between">
                      <button 
                        onClick={() => handleDeleteMenuPhoto(selectedMerchantMenu.id, thumbUrl, false)}
                        className="w-8 h-8 bg-error/20 backdrop-blur-md rounded-full flex items-center justify-center text-error opacity-0 group-hover:opacity-100 hover:bg-error hover:text-white transition-all border border-error/30"
                        title="Hapus Foto"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                      <button 
                        onClick={() => window.open(thumbUrl, '_blank')}
                        className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-all"
                      >
                        <span className="material-symbols-outlined text-xs">open_in_new</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-zinc-900/50 border-t border-white/5 flex justify-end flex-shrink-0">
              <button 
                onClick={() => { setShowMenuGalleryModal(false); setSelectedMerchantMenu(null); }}
                className="px-6 py-3 bg-white/5 text-white font-black rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs border border-white/10"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MerchantManagement;
