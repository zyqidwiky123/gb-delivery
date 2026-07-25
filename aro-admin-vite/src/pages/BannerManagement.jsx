import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebase/config';
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAdminStore } from '../store/adminStore';

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

const convertToWebP = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const webpFile = new File([blob], `${file.name.split('.')[0]}.webp`, {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(webpFile);
            } else {
              reject(new Error('Gagal mengonversi ke WebP'));
            }
          },
          'image/webp',
          0.85
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

function BannerManagement() {
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [newBanner, setNewBanner] = useState({
    title: '',
    link: '',
    targetAudience: 'all',
    active: true,
    image: 'https://via.placeholder.com/800x450?text=Klik+Ganti+Gambar'
  });
  const [showAddBannerModal, setShowAddBannerModal] = useState(false);
  const [bannerEdits, setBannerEdits] = useState({});

  const { banners, setBanners } = useAdminStore();

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "banners"));
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBanner = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "banners"), {
        ...newBanner,
        createdAt: serverTimestamp()
      });
      alert("Banner Berhasil Ditambahkan!");
      setShowAddBannerModal(false);
      setNewBanner({
        title: '',
        link: '',
        targetAudience: 'all',
        active: true,
        image: 'https://via.placeholder.com/800x450?text=Klik+Ganti+Gambar'
      });
      fetchBanners();
    } catch (error) {
      console.error("Error adding banner:", error);
      alert("Gagal menambah banner: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBanner = async (bannerId) => {
    if (!window.confirm("Hapus banner ini permanen?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "banners", bannerId));
      alert("Banner Berhasil Dihapus!");
      fetchBanners();
    } catch (error) {
      console.error("Error deleting banner:", error);
      alert("Gagal menghapus banner.");
    } finally {
      setLoading(false);
    }
  };

  const handleBannerUpload = async (bannerId, file) => {
    if (!file) return;
    setUploadingId(bannerId);
    try {
      const webpFile = await convertToWebP(file);
      const storageRef = ref(storage, `banners/${bannerId}.webp`);
      await uploadBytes(storageRef, webpFile);
      const downloadURL = await getDownloadURLWithRetry(storageRef);

      const bannerRef = doc(db, "banners", bannerId);
      await updateDoc(bannerRef, { imageUrl: downloadURL });
      fetchBanners();
    } catch (error) {
      console.error("Error uploading banner:", error);
      alert("Gagal mengunggah banner: " + error.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleUpdateBannerMetadata = async (bannerId) => {
    const edit = bannerEdits[bannerId];
    if (!edit) return;

    try {
      setLoading(true);
      const bannerRef = doc(db, "banners", bannerId);
      await updateDoc(bannerRef, {
        title: edit.title || "",
        link: edit.link || "",
        targetAudience: edit.targetAudience || "all",
        active: edit.active !== undefined ? edit.active : true
      });
      alert("Metadata Banner Berhasil Diperbarui!");
      fetchBanners();
    } catch (error) {
      console.error("Error updating banner metadata:", error);
      alert("Gagal memperbarui banner: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">Banner Management</h3>
          <p className="text-sm text-on-surface-variant font-medium">Kelola gambar promosi yang tampil di dashboard aplikasi user</p>
        </div>
        <button 
          onClick={() => setShowAddBannerModal(true)}
          className="bg-primary text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:shadow-[0_0_20px_rgba(202,253,0,0.3)] transition-all active:scale-95 whitespace-nowrap"
        >
          <span className="material-symbols-outlined">add_circle</span>
          TAMBAH BANNER BARU
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {banners.map(banner => (
          <div key={banner.id} className="bg-surface-container-low rounded-[2rem] p-6 border border-white/5 space-y-6">
            <div className="aspect-[21/9] w-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 relative group">
              <img src={banner.imageUrl || banner.image} alt={banner.id} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[10px] font-black text-white uppercase tracking-widest bg-black/60 px-4 py-2 rounded-full">Preview Banner</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Judul Banner</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Diskon Ongkir 50%"
                  value={bannerEdits[banner.id]?.title ?? banner.title ?? ''}
                  onChange={(e) => setBannerEdits({...bannerEdits, [banner.id]: {...(bannerEdits[banner.id] || {title: banner.title, link: banner.link}), title: e.target.value}})}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white text-sm font-bold focus:ring-2 focus:ring-primary transition-all"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Target Link (Path / URL)</label>
                <input 
                  type="text" 
                  placeholder="Contoh: /food atau /ride"
                  value={bannerEdits[banner.id]?.link ?? banner.link ?? ''}
                  onChange={(e) => setBannerEdits({...bannerEdits, [banner.id]: {...(bannerEdits[banner.id] || {title: banner.title, link: banner.link, targetAudience: banner.targetAudience}), link: e.target.value}})}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white text-sm font-bold focus:ring-2 focus:ring-primary transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Target Audience</label>
                <select 
                  value={bannerEdits[banner.id]?.targetAudience ?? banner.targetAudience ?? 'all'}
                  onChange={(e) => setBannerEdits({...bannerEdits, [banner.id]: {...(bannerEdits[banner.id] || {title: banner.title, link: banner.link, targetAudience: banner.targetAudience}), targetAudience: e.target.value}})}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white text-sm font-bold focus:ring-2 focus:ring-primary transition-all appearance-none"
                >
                  <option value="all" className="bg-surface-container-highest">Semua Pengguna</option>
                  <option value="member" className="bg-surface-container-highest">Member Saja</option>
                  <option value="guest" className="bg-surface-container-highest">Guest Saja</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => handleUpdateBannerMetadata(banner.id)}
                  className="flex-[2] bg-white/5 hover:bg-white/10 text-white border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  Simpan Teks & Link
                </button>
                
                <label className={`flex-1 flex items-center justify-center px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                  uploadingId === banner.id ? 'bg-zinc-800 text-zinc-500' : 'bg-primary text-black hover:shadow-lg active:scale-95'
                }`}>
                  {uploadingId === banner.id ? 'Sabar...' : 'Ganti Gambar'}
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => handleBannerUpload(banner.id, e.target.files[0])}
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">ID: {banner.id}</span>
                <button 
                  onClick={() => handleDeleteBanner(banner.id)}
                  className="text-error hover:text-red-400 transition-colors"
                  title="Hapus Banner"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${banner.active ? 'bg-primary' : 'bg-zinc-600'}`}></span>
                <button 
                  onClick={() => {
                    setBannerEdits({...bannerEdits, [banner.id]: {
                      ...(bannerEdits[banner.id] || {title: banner.title, link: banner.link, targetAudience: banner.targetAudience}), 
                      active: !banner.active
                    }});
                    setTimeout(() => handleUpdateBannerMetadata(banner.id), 100);
                  }}
                  className="text-[10px] font-black text-white uppercase hover:text-primary transition-colors"
                >
                  {banner.active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddBannerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddBannerModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">Tambah Banner</h3>
              <button onClick={() => setShowAddBannerModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white">close</span></button>
            </div>
            <form onSubmit={handleAddBanner} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Judul Banner</label>
                <input required type="text" value={newBanner.title} onChange={e => setNewBanner({...newBanner, title: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Promo Gajian..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Target Link</label>
                <input required type="text" value={newBanner.link} onChange={e => setNewBanner({...newBanner, link: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="/food" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Target Audience</label>
                <select 
                  value={newBanner.targetAudience} 
                  onChange={e => setNewBanner({...newBanner, targetAudience: e.target.value})}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white appearance-none"
                >
                  <option value="all">Semua Pengguna</option>
                  <option value="member">Member Saja</option>
                  <option value="guest">Guest Saja</option>
                </select>
              </div>
              <div className="pt-6">
                <button disabled={loading} type="submit" className="w-full bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                  {loading ? 'Menyimpan...' : 'Buat Banner'}
                </button>
              </div>
              <p className="text-[10px] text-on-surface-variant text-center mt-2 px-4 italic">
                * Setelah dibuat, silakan ganti gambar pada daftar banner.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BannerManagement;
