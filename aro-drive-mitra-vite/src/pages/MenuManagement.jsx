import React, { useEffect, useState, useRef } from 'react';
import { useMerchantStore } from '../store/useMerchantStore';
import { db, storage } from '../firebase/config';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { ShoppingBag, ChevronLeft, Plus, Trash2, Edit3, Image as ImageIcon, X, Camera, LayoutDashboard, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

function MenuManagement() {
  const { merchant, user } = useMerchantStore();
  const [menuItems, setMenuItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: '', category: 'Makanan', description: '', isAvailable: true });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;

    const q = collection(db, "merchants", user.uid, "menu");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [user]);

  const resetForm = () => {
    setFormData({ name: '', price: '', category: 'Makanan', description: '', isAvailable: true });
    setEditingItem(null);
    setImageFile(null);
    setImagePreview(null);
    setShowModal(false);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      price: item.price?.toString() || '',
      category: item.category || 'Makanan',
      description: item.description || '',
      isAvailable: item.isAvailable !== false
    });
    setImagePreview(item.imageUrl || null);
    setImageFile(null);
    setShowModal(true);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran foto maksimal 5MB');
      return;
    }
    
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const uploadMenuImage = async (menuItemId) => {
    if (!imageFile || !user?.uid) return null;
    
    const safeName = imageFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const storagePath = `merchants/${user.uid}/menu/${menuItemId}_${safeName}`;
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, imageFile);
    return await getDownloadURL(snapshot.ref);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) return;
    
    setSaving(true);
    try {
      const data = {
        name: formData.name,
        price: Number(formData.price),
        category: formData.category,
        description: formData.description,
        isAvailable: formData.isAvailable,
        updatedAt: new Date()
      };

      if (editingItem) {
        // Edit existing
        const docRef = doc(db, "merchants", user.uid, "menu", editingItem.id);
        
        if (imageFile) {
          const imageUrl = await uploadMenuImage(editingItem.id);
          if (imageUrl) data.imageUrl = imageUrl;
        }
        
        await updateDoc(docRef, data);
      } else {
        // Add new
        data.createdAt = new Date();
        const docRef = await addDoc(collection(db, "merchants", user.uid, "menu"), data);
        
        if (imageFile) {
          const imageUrl = await uploadMenuImage(docRef.id);
          if (imageUrl) {
            await updateDoc(docRef, { imageUrl });
          }
        }
      }

      resetForm();
    } catch (err) {
      console.error("Error saving menu item:", err);
      alert("Gagal menyimpan menu: " + err.message);
    }
    setSaving(false);
  };

  const toggleAvailability = async (item) => {
    const docRef = doc(db, "merchants", user.uid, "menu", item.id);
    await updateDoc(docRef, { isAvailable: !item.isAvailable });
  };

  const deleteItem = async (id) => {
    if (window.confirm("Hapus menu ini?")) {
      await deleteDoc(doc(db, "merchants", user.uid, "menu", id));
    }
  };

  const groupedMenu = menuItems.reduce((acc, item) => {
    const cat = item.category || 'Lainnya';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-dark pb-24">
      <header className="bg-surface/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="text-white/40 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </Link>
          <h2 className="font-headline font-bold text-lg">Kelola Menu</h2>
          <button 
            onClick={openAddModal}
            className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary hover:bg-primary/30 transition-colors"
          >
            <Plus size={24} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {menuItems.length === 0 ? (
          <div className="card text-center py-20 text-white/20">
            <ShoppingBag size={48} className="mx-auto mb-4 opacity-10" />
            <p className="font-medium">Menu masih kosong</p>
            <button 
              onClick={openAddModal}
              className="mt-4 text-primary font-bold text-sm hover:underline"
            >
              Tambah Menu Pertama
            </button>
          </div>
        ) : (
          Object.entries(groupedMenu).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 px-1">{category} ({items.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(item => (
                  <div key={item.id} className={`card flex gap-4 p-4 ${!item.isAvailable && 'opacity-50'}`}>
                    {/* Image */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white/5 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={32} className="text-white/20" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-white truncate">{item.name}</h4>
                        <span className="text-primary font-bold text-sm shrink-0 ml-2">Rp {item.price?.toLocaleString()}</span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{item.description}</p>
                      )}
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">{item.category}</p>
                      
                      <div className="flex items-center justify-between mt-4">
                        <button 
                          onClick={() => toggleAvailability(item)}
                          className={`text-[10px] font-black uppercase tracking-tighter px-2 py-1 rounded-md ${item.isAvailable ? 'bg-primary/10 text-primary' : 'bg-white/10 text-white/40'}`}
                        >
                          {item.isAvailable ? 'Tersedia' : 'Habis'}
                        </button>
                        <div className="flex gap-3">
                          <button onClick={() => openEditModal(item)} className="text-white/20 hover:text-primary transition-colors">
                            <Edit3 size={16} />
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="text-red-500/40 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="card w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-headline font-bold text-xl">
                {editingItem ? 'Edit Menu' : 'Tambah Menu Baru'}
              </h3>
              <button onClick={resetForm} className="text-white/20 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Foto Menu</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 bg-white/5 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/30 transition-colors overflow-hidden"
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera size={32} className="text-white/20 mb-2" />
                      <span className="text-xs text-white/30">Tap untuk upload foto</span>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Nama Menu</label>
                <input 
                  type="text" 
                  className="input-field w-full" 
                  placeholder="Contoh: Nasi Goreng Spesial"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              {/* Price & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Harga (Rp)</label>
                  <input 
                    type="number" 
                    className="input-field w-full" 
                    placeholder="15000"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Kategori</label>
                  <select 
                    className="input-field w-full"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                    <option value="Cemilan">Cemilan</option>
                    <option value="Paket">Paket</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Deskripsi (Opsional)</label>
                <textarea 
                  className="input-field w-full resize-none" 
                  rows={2}
                  placeholder="Deskripsi singkat menu..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              {/* Availability Toggle (only for edit) */}
              {editingItem && (
                <div className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                  <span className="text-sm font-medium">Ketersediaan</span>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, isAvailable: !formData.isAvailable})}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.isAvailable ? 'bg-primary' : 'bg-white/20'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${formData.isAvailable ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl font-bold text-sm transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 btn-primary py-3"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    editingItem ? 'Simpan Perubahan' : 'Simpan Menu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/80 backdrop-blur-2xl border-t border-white/5 pb-safe z-50">
        <div className="max-w-xl mx-auto flex justify-around p-3">
          <Link to="/" className="flex flex-col items-center gap-1 p-2 text-white/40 hover:text-white transition-colors">
            <LayoutDashboard size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Beranda</span>
          </Link>
          <Link to="/menu" className="flex flex-col items-center gap-1 p-2 text-primary">
            <ShoppingBag size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Menu</span>
          </Link>
          <Link to="/settings" className="flex flex-col items-center gap-1 p-2 text-white/40 hover:text-white transition-colors">
            <Store size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Toko</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default MenuManagement;
