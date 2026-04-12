import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { auth, storage } from '../firebase/config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function EditProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user, updateUser } = useUserStore();
  
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
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

    // Basic validation
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
      const storageRef = ref(storage, `profile_pics/${user.id}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // 1. Update Firebase Auth
      await updateProfile(auth.currentUser, { photoURL: downloadURL });

      // 2. Update Store & Firestore
      await updateUser({ photoURL: downloadURL });

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
      if (displayName !== user.displayName) {
        await updateProfile(auth.currentUser, { displayName });
      }

      // 2. Update Store & Firestore
      await updateUser({
        displayName,
        whatsapp
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
    // ... (logic remains same)
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

      // Re-authenticate if necessary (for password provider)
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
    <div className="bg-background min-h-screen pb-20 text-white font-body">
      <main className="max-w-xl mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline font-bold text-xl">Pengaturan Akun</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold text-center">
            {success}
          </div>
        )}

        <div className="space-y-8">
          
          {/* Section: Avatar Editor */}
          <section className="flex flex-col items-center">
             <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                <div className={`w-24 h-24 rounded-full border-4 border-primary/20 overflow-hidden shadow-2xl transition-all ${uploading ? 'opacity-50' : 'group-hover:border-primary'}`}>
                   <img 
                    src={user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAr5XAajWHWnCVcEoi2VhomU2RRi1oJj14RBhltVEwmTbfEKW_i84dn2BDkUz9qAQj07nsW1VB0znDXOW5qiwlc18aHqhw7Gb53jOgqu22HqidGCHExwD202ID9AIWBaNt6MkzajfHVnmrUTACMJknmlViLwxT-oUuNyAm-gWNyh8y73S-6_JDv5sLo-ZwmgEHwjPyTeaqbJyqf_UDWD4h30dkfYwiVwaVX5dP2bncVn6yn1IfcqPjFpKBz4VY49nkar4KuReEa7jY"} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                   />
                </div>
                {uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-black rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
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
             <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mt-3">Klik untuk ganti foto</p>
          </section>

          {/* Section: Profile Info */}
          <section className="space-y-4">
            <h2 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-2">Informasi Pribadi</h2>
            <form onSubmit={handleUpdateProfile} className="bg-surface-container-low p-6 rounded-[2rem] border border-white/5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Nama Lengkap</label>
                <input 
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Nama Lengkap"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Nomor WhatsApp</label>
                <input 
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full bg-white/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
                  placeholder="08123456789"
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-primary text-black font-headline font-black py-4 rounded-full text-xs uppercase tracking-widest shadow-lg shadow-primary/10 active:scale-95 transition-all disabled:opacity-50"
              >
                Simpan Perubahan
              </button>
            </form>
          </section>

          {/* Section: Security */}
          {auth.currentUser?.providerData.some(p => p.providerId === 'password') && (
            <section className="space-y-4">
              <h2 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-2">Keamanan Akun</h2>
              <form onSubmit={handleChangePassword} className="bg-surface-container-low p-6 rounded-[2rem] border border-white/5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Kata Sandi Saat Ini</label>
                  <input 
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-white/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Kata Sandi Baru</label>
                  <input 
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-white/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Minimal 6 karakter"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Konfirmasi Kata Sandi Baru</label>
                  <input 
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Minimal 6 karakter"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-white/10 hover:bg-white/20 text-white font-headline font-black py-4 rounded-full text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  Ganti Kata Sandi
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
