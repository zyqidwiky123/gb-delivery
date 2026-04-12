import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverStore } from '../store/useDriverStore';
import { auth, storage } from '../firebase/config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function EditProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { profile, updateProfile: updateDriverProfile } = useDriverStore();
  
  const [name, setName] = useState(profile?.name || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '');
  const [vehicleType, setVehicleType] = useState(profile?.vehicleType || '');
  const [plateNumber, setPlateNumber] = useState(profile?.plateNumber || '');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAvatarClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Harap pilih file gambar.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Ukuran file maksimal 2MB.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const storageRef = ref(storage, `profile_pics/${auth.currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // 1. Update Firebase Auth
      await updateProfile(auth.currentUser, { photoURL: downloadURL });

      // 2. Update Store & Firestore
      await updateDriverProfile({ photoUrl: downloadURL });

      setSuccess('Foto profil berhasil diperbarui!');
    } catch (err) {
      console.error(err);
      setError('Gagal mengunggah foto profil.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // 1. Update Firebase Auth display name if changed
      if (name !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: name });
      }

      // 2. Update Store & Firestore
      await updateDriverProfile({
        name,
        whatsapp,
        vehicleType,
        plateNumber
      });
      setSuccess('Profil berhasil diperbarui!');
    } catch (err) {
      console.error(err);
      setError('Gagal memperbarui profil.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error("User not found");

      if (firebaseUser.providerData.some(p => p.providerId === 'password')) {
        const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
      }

      await updatePassword(firebaseUser, newPassword);
      setSuccess('Kata sandi berhasil diubah!');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setError('Kata sandi saat ini salah.');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('Silakan login ulang untuk mengubah kata sandi.');
      } else {
        setError('Gagal mengubah kata sandi: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#0A0A0A] min-h-screen pb-20 text-white font-body">
      <main className="max-w-xl mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-outline">arrow_back</span>
          </button>
          <h1 className="font-headline font-black italic tracking-tighter text-2xl text-primary">EDIT PROFIL MITRA</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold text-center italic uppercase tracking-wider">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold text-center italic uppercase tracking-wider">
            {success}
          </div>
        )}

        <div className="space-y-8">
          
          {/* Section: Avatar Editor */}
          <section className="flex flex-col items-center">
             <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                <div className={`w-28 h-28 rounded-full border-4 border-primary/20 overflow-hidden shadow-2xl transition-all ${uploading ? 'opacity-50' : 'group-hover:border-primary'}`}>
                   <img 
                    src={profile?.photoUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuB1uS3ff2JpvqzPJfBz6jy9Gwt4iZW5fHAgnymzDNUfKxsIt0aGrdYRzaaTJC_O2HtqQKeHtnENQp3S9HwDZlWq5JMmnN2DbKWsjyMr7GThLWvjH6Pv0l1ti83JuyqVGdKThmAnR658TxQ7pfyItmhSzFqKM49rIZuLio_9Rh81dX_ys82EoBYTYJUHoKOgm4WbooNmSL0Vu7TfyegTXQe9eCIN4YUx77MIk4i4uFuy1Irma1PI3zoru41Sf2WYo0cOketOMvQnN7g"} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                   />
                </div>
                {uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="absolute bottom-0 right-1 w-9 h-9 bg-primary text-black rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-sm font-bold">photo_camera</span>
                  </div>
                )}
             </div>
             <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange}
             />
             <p className="text-[10px] font-bold text-outline uppercase tracking-[0.2em] mt-4 italic">Klik untuk ganti foto profil</p>
          </section>

          {/* Section: Profile Info */}
          <section className="space-y-4">
            <h2 className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-outline ml-2">Detail Personal & Kendaraan</h2>
            <form onSubmit={handleUpdateProfile} className="bg-surface-container-low p-6 rounded-[2rem] border border-white/5 space-y-5 shadow-2xl">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-outline uppercase ml-1 tracking-widest">Nama Lengkap</label>
                <div className="relative">
                   <input 
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-5 text-sm focus:ring-1 focus:ring-primary transition-all text-white placeholder:text-white/20"
                    placeholder="Nama Lengkap"
                  />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-outline uppercase ml-1 tracking-widest">Nomor WhatsApp</label>
                <input 
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-5 text-sm focus:ring-1 focus:ring-primary transition-all text-white placeholder:text-white/20"
                  placeholder="08123456789"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-outline uppercase ml-1 tracking-widest">Tipe Kendaraan</label>
                  <input 
                    type="text"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-5 text-sm focus:ring-1 focus:ring-primary transition-all text-white placeholder:text-white/20"
                    placeholder="Contoh: Beat 2024"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-outline uppercase ml-1 tracking-widest">Plat Nomor</label>
                  <input 
                    type="text"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-5 text-sm focus:ring-1 focus:ring-primary transition-all text-white placeholder:text-white/20 uppercase font-mono tracking-widest"
                    placeholder="AG 1234 XX"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-4 kinetic-gradient text-black font-headline font-black py-5 rounded-3xl text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/10 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'MEMPROSES...' : 'PERBARUI PROFIL'}
              </button>
            </form>
          </section>

          {/* Section: Security */}
          {auth.currentUser?.providerData.some(p => p.providerId === 'password') && (
            <section className="space-y-4">
              <h2 className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-outline ml-2">Keamanan Akun</h2>
              <form onSubmit={handleChangePassword} className="bg-surface-container-low p-6 rounded-[2rem] border border-white/5 space-y-5 shadow-2xl">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-outline uppercase ml-1 tracking-widest">Kata Sandi Saat Ini</label>
                  <input 
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-5 text-sm focus:ring-1 focus:ring-primary transition-all text-white"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-outline uppercase ml-1 tracking-widest">Kata Sandi Baru</label>
                  <input 
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-5 text-sm focus:ring-1 focus:ring-primary transition-all text-white"
                    placeholder="Minimal 6 karakter"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-outline uppercase ml-1 tracking-widest">Konfirmasi Password Baru</label>
                  <input 
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-2xl py-4 px-5 text-sm focus:ring-1 focus:ring-primary transition-all text-white"
                    placeholder="Ulangi password baru"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full mt-4 bg-white/5 hover:bg-white/10 text-white font-headline font-black py-5 rounded-3xl text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-50 border border-white/5"
                >
                  {loading ? 'MEMPROSES...' : 'GANTI KATA SANDI'}
                </button>
              </form>
            </section>
          )}

        </div>

      </main>
    </div>
  );
}

export default EditProfile;
