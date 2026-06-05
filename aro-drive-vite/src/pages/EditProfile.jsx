import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { auth, storage } from '../firebase/config';
import { 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updateProfile,
  verifyBeforeUpdateEmail,
  deleteUser,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';

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

function EditProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { user, updateUser } = useUserStore();
  
  // Auth state reactivity
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setCurrentUser(u);
    });
    return () => unsubscribe();
  }, []);
  
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Email State
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  
  // Delete State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  
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
      const storageRef = ref(storage, `profile_pics/${user.id}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURLWithRetry(storageRef);

      await updateProfile(auth.currentUser, { photoURL: downloadURL });
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
      if (displayName !== user.displayName) {
        await updateProfile(auth.currentUser, { displayName });
      }

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
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const firebaseUser = currentUser;
      if (!firebaseUser) throw new Error("User tidak ditemukan.");

      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, newPassword);
      
      setSuccess('Kata sandi berhasil diperbarui!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
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

  const handleChangeEmail = async (e) => {
    e.preventDefault();
    if (newEmail === user.email) {
      setError('Email baru sama dengan email saat ini.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const firebaseUser = currentUser;
      if (!firebaseUser) throw new Error("User tidak ditemukan.");

      if (firebaseUser.providerData.some(p => p.providerId === 'password')) {
        const credential = EmailAuthProvider.credential(firebaseUser.email, emailCurrentPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
      }

      await verifyBeforeUpdateEmail(firebaseUser, newEmail);
      await updateUser({ email: newEmail });
      
      setSuccess('Link verifikasi telah dikirim ke email baru Anda. Silakan cek kotak masuk.');
      setEmailCurrentPassword('');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setError('Kata sandi saat ini salah.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email sudah digunakan oleh akun lain.');
      } else {
        setError('Gagal mengubah email: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const firebaseUser = currentUser;
      if (!firebaseUser) throw new Error("User tidak ditemukan.");

      if (firebaseUser.providerData.some(p => p.providerId === 'password')) {
        const credential = EmailAuthProvider.credential(firebaseUser.email, deleteConfirmPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
      }

      if (user.photoURL && user.photoURL.includes('firebasestorage')) {
        try {
          const storageRef = ref(storage, `profile_pics/${user.id}`);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.warn("Gagal menghapus foto profil dari storage:", storageErr);
        }
      }

      const { deleteFirestoreUser } = useUserStore.getState();
      await deleteFirestoreUser();
      await deleteUser(firebaseUser);
      await signOut(auth);
      navigate('/welcome');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setError('Kata sandi salah. Gagal menghapus akun.');
      } else if (err.code === 'auth/requires-recent-login') {
        setError('Silakan login ulang untuk menghapus akun.');
      } else {
        setError('Gagal menghapus akun: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await sendPasswordResetEmail(auth, user.email);
      setSuccess('Link reset password telah dikirim ke email Anda (' + user.email + ').');
    } catch (err) {
      console.error(err);
      setError('Gagal mengirim email reset: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen pb-20 text-on-background font-body">
      <main className="max-w-xl mx-auto px-6 py-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-on-background/5 flex items-center justify-center hover:bg-on-background/10 transition-colors"
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
            <form onSubmit={handleUpdateProfile} className="bg-surface-container-low p-6 rounded-[2rem] border border-on-background/5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Nama Lengkap</label>
                <input 
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-on-background/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Nama Lengkap"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Nomor WhatsApp</label>
                <input 
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full bg-on-background/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
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

          {/* Section: Email Settings */}
          <section className="space-y-4">
            <h2 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ml-2">Pengaturan Email</h2>
            <form onSubmit={handleChangeEmail} className="bg-surface-container-low p-6 rounded-[2rem] border border-on-background/5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Alamat Email Baru</label>
                <input 
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-on-background/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
                  placeholder="emailbaru@example.com"
                />
              </div>

              {currentUser?.providerData.some(p => p.providerId === 'password') && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Kata Sandi Saat Ini</label>
                  <input 
                    type="password"
                    required
                    value={emailCurrentPassword}
                    onChange={(e) => setEmailCurrentPassword(e.target.value)}
                    className="w-full bg-on-background/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Konfirmasi password untuk ganti email"
                  />
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-on-background/10 hover:bg-on-background/20 text-on-background font-headline font-black py-4 rounded-full text-xs uppercase tracking-widest transition-all disabled:opacity-50"
              >
                Ganti Email
              </button>
            </form>
          </section>

          {/* Section: Security */}
          <section className="space-y-4">
            <div className="flex items-center justify-between ml-2">
              <h2 className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Keamanan Akun</h2>
              {currentUser?.providerData.some(p => p.providerId === 'password') && (
                <button 
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline disabled:opacity-50"
                >
                  Lupa Password?
                </button>
              )}
            </div>
            
            {currentUser?.providerData.some(p => p.providerId === 'password') ? (
              <form onSubmit={handleChangePassword} className="bg-surface-container-low p-6 rounded-[2rem] border border-on-background/5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Kata Sandi Saat Ini</label>
                  <input 
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-on-background/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
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
                    className="w-full bg-on-background/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
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
                    className="w-full bg-on-background/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Ulangi kata sandi baru"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-on-background/10 hover:bg-on-background/20 text-on-background font-headline font-black py-4 rounded-full text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  Ganti Kata Sandi
                </button>
              </form>
            ) : (
              <div className="bg-surface-container-low p-8 rounded-[2rem] border border-on-background/5 text-center space-y-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                  <span className="material-symbols-outlined">google</span>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-on-background">Akun Dikelola oleh Google</p>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed px-4">
                    Anda masuk menggunakan akun Google. Pengaturan kata sandi dapat diakses melalui layanan akun Google Anda.
                  </p>
                </div>
                <a 
                  href="https://myaccount.google.com/security" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Buka Akun Google
                </a>
              </div>
            )}
          </section>

          {/* Section: Danger Zone */}
          <section className="space-y-4 pt-8">
            <h2 className="font-label text-[10px] font-bold uppercase tracking-widest text-red-500/80 ml-2 italic">Zona Bahaya</h2>
            <div className="bg-red-500/5 p-6 rounded-[2rem] border border-red-500/10 space-y-4">
              <p className="text-[10px] text-red-400/80 text-center leading-relaxed px-4">
                Menghapus akun akan menghapus semua data Anda secara permanen, termasuk poin loyalitas dan riwayat pesanan. Tindakan ini tidak dapat dibatalkan.
              </p>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-headline font-black py-4 rounded-full text-xs uppercase tracking-widest transition-all"
              >
                Hapus Akun Permanen
              </button>
            </div>
          </section>

        </div>

        {/* Modal Konfirmasi Hapus Akun */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <div className="bg-surface-container-high w-full max-w-sm rounded-[2.5rem] border border-on-background/5 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                <span className="material-symbols-outlined text-3xl">warning</span>
              </div>
              
              <h3 className="text-lg font-headline font-bold text-on-background text-center mb-2">Hapus Akun?</h3>
              <p className="text-xs text-on-surface-variant text-center mb-8 px-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus akun ini secara permanen? Masukkan kata sandi Anda untuk mengonfirmasi.
              </p>

              <form onSubmit={handleDeleteAccount} className="space-y-4">
                {currentUser?.providerData.some(p => p.providerId === 'password') && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase ml-1">Konfirmasi Kata Sandi</label>
                    <input 
                      type="password"
                      required
                      value={deleteConfirmPassword}
                      onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                      className="w-full bg-on-background/5 border-none rounded-2xl py-3 px-4 text-sm focus:ring-1 focus:ring-red-500 transition-all text-center"
                      placeholder="••••••••"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmPassword('');
                    }}
                    className="py-4 rounded-full bg-on-background/5 hover:bg-on-background/10 text-on-background font-headline font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="py-4 rounded-full bg-red-500 text-on-background font-headline font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Menghapus...' : 'Ya, Hapus'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default EditProfile;
