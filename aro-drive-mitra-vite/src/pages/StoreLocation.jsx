import React, { useState } from 'react';
import { useMerchantStore } from '../store/useMerchantStore';
import { ChevronLeft, MapPin, Save } from 'lucide-react';
import { Link } from 'react-router-dom';

function StoreLocation() {
  const { merchant, updateMerchant } = useMerchantStore();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    address: merchant?.address || '',
    city: merchant?.city || '',
    province: merchant?.province || 'Jawa Timur',
  });

  const [coords, setCoords] = useState({
    lat: merchant?.location?.lat || merchant?.lat || '',
    lng: merchant?.location?.lng || merchant?.lng || '',
  });

  // Sync state when merchant data arrives
  React.useEffect(() => {
    if (merchant) {
      setForm({
        address: merchant.address || '',
        city: merchant.city || '',
        province: merchant.province || 'Jawa Timur',
      });
      setCoords({
        lat: merchant.location?.lat || merchant.lat || '',
        lng: merchant.location?.lng || merchant.lng || '',
      });
    }
  }, [merchant]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation tidak didukung oleh browser Anda.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (err) => {
        alert("Gagal mendapatkan lokasi: " + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await updateMerchant({
        address: form.address,
        city: form.city,
        province: form.province,
        location: {
          lat: Number(coords.lat) || 0,
          lng: Number(coords.lng) || 0,
        },
        lat: Number(coords.lat) || 0,
        lng: Number(coords.lng) || 0,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    }
    setSaving(false);
  };

  const hasCoords = coords.lat && coords.lng;
  const mapUrl = hasCoords 
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${coords.lat},${coords.lng}&zoom=16&size=600x300&maptype=roadmap&markers=color:green%7C${coords.lat},${coords.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
    : null;

  return (
    <div className="min-h-screen bg-dark">
      <header className="bg-surface/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/settings" className="text-white/40 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </Link>
          <h2 className="font-headline font-bold text-lg">Alamat & Lokasi</h2>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Map Preview */}
          <div className="rounded-2xl overflow-hidden border border-white/10">
            {mapUrl ? (
              <img src={mapUrl} alt="Map Preview" className="w-full h-48 object-cover" />
            ) : (
              <div className="w-full h-48 bg-white/5 flex flex-col items-center justify-center text-white/20">
                <MapPin size={40} className="mb-2 opacity-30" />
                <span className="text-xs">Belum ada lokasi</span>
              </div>
            )}
          </div>

          {/* Get Location Button */}
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            className="w-full bg-primary/10 border border-primary/20 text-primary py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/20 transition-all"
          >
            <MapPin size={16} />
            Gunakan Lokasi Saat Ini
          </button>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Latitude</label>
              <input
                type="number"
                step="any"
                className="input-field w-full"
                placeholder="-8.1234"
                value={coords.lat}
                onChange={e => setCoords({...coords, lat: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Longitude</label>
              <input
                type="number"
                step="any"
                className="input-field w-full"
                placeholder="112.1234"
                value={coords.lng}
                onChange={e => setCoords({...coords, lng: e.target.value})}
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Alamat Lengkap</label>
            <textarea
              className="input-field w-full resize-none"
              rows={3}
              placeholder="Jl. Contoh No. 123, Kec. ABC..."
              value={form.address}
              onChange={e => setForm({...form, address: e.target.value})}
            />
          </div>

          {/* City & Province */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Kota</label>
              <input
                type="text"
                className="input-field w-full"
                value={form.city}
                onChange={e => setForm({...form, city: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Provinsi</label>
              <input
                type="text"
                className="input-field w-full"
                value={form.province}
                onChange={e => setForm({...form, province: e.target.value})}
              />
            </div>
          </div>

          {success && (
            <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-xl text-sm font-medium text-center">
              ✓ Lokasi berhasil disimpan!
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full py-4 shadow-lg shadow-primary/20"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={20} />
                <span>Simpan Lokasi</span>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

export default StoreLocation;
