import React, { useState, useRef } from 'react';
import { useMerchantStore } from '../store/useMerchantStore';
import { ChevronLeft, Camera, Save, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

function StoreInfo() {
  const { merchant, updateMerchant, uploadImage, user } = useMerchantStore();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: merchant?.name || '',
    description: merchant?.description || '',
    category: merchant?.category || 'Makanan',
    phone: merchant?.phone || '',
    openTime: merchant?.openTime || '08:00',
    closeTime: merchant?.closeTime || '21:00',
  });

  const [logoPreview, setLogoPreview] = useState(merchant?.logoUrl || null);
  const [logoFile, setLogoFile] = useState(null);

  // Sync state when merchant data arrives
  React.useEffect(() => {
    if (merchant) {
      setForm({
        name: merchant.name || '',
        description: merchant.description || '',
        category: merchant.category || 'Makanan',
        phone: merchant.phone || '',
        openTime: merchant.openTime || '08:00',
        closeTime: merchant.closeTime || '21:00',
      });
      setLogoPreview(merchant.logoUrl || null);
    }
  }, [merchant]);

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran foto maksimal 5MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      const updates = { ...form };

      if (logoFile) {
        const url = await uploadImage(logoFile, `merchants/${user.uid}/logo`);
        updates.logoUrl = url;
      }

      await updateMerchant(updates);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-dark">
      <header className="bg-surface/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/settings" className="text-white/40 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </Link>
          <h2 className="font-headline font-bold text-lg">Informasi Toko</h2>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Logo Upload */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-28 h-28 rounded-3xl bg-white/5 border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-primary/30 transition-colors overflow-hidden"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Camera size={32} className="text-white/20" />
              )}
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-xs text-primary font-bold">
              Ganti Logo Toko
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Nama Toko</label>
            <input
              type="text"
              className="input-field w-full"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Nomor WhatsApp</label>
            <input
              type="tel"
              className="input-field w-full"
              placeholder="Contoh: 08123456789"
              value={form.phone}
              onChange={e => setForm({...form, phone: e.target.value})}
              required
            />
            <p className="text-[10px] text-white/20 mt-1">Gunakan format angka saja (contoh: 0812...)</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Deskripsi</label>
            <textarea
              className="input-field w-full resize-none"
              rows={3}
              placeholder="Deskripsi toko Anda..."
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Kategori</label>
            <select
              className="input-field w-full"
              value={form.category}
              onChange={e => setForm({...form, category: e.target.value})}
            >
              <option value="Makanan">Makanan</option>
              <option value="Minuman">Minuman</option>
              <option value="Makanan & Minuman">Makanan & Minuman</option>
              <option value="Cemilan">Cemilan</option>
              <option value="Toko">Toko</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          {/* Operating Hours */}
          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <Clock size={12} />
              Jam Operasional
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-white/30 uppercase tracking-widest">Buka</span>
                <input
                  type="time"
                  className="input-field w-full"
                  value={form.openTime}
                  onChange={e => setForm({...form, openTime: e.target.value})}
                />
              </div>
              <div>
                <span className="text-[10px] text-white/30 uppercase tracking-widest">Tutup</span>
                <input
                  type="time"
                  className="input-field w-full"
                  value={form.closeTime}
                  onChange={e => setForm({...form, closeTime: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Success Banner */}
          {success && (
            <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-xl text-sm font-medium text-center">
              ✓ Berhasil disimpan!
            </div>
          )}

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-4 mt-4 shadow-lg shadow-primary/20"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={20} />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

export default StoreInfo;
