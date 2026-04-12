import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db, storage } from '../firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useDriverStore } from '../store/useDriverStore';

function Profile() {
  const navigate = useNavigate();
  const { profile, updateProfile, clearData } = useDriverStore();
  
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState(profile?.bankAccounts || []);
  const [qrisUrl, setQrisUrl] = useState(profile?.qrisUrl || '');
  
  // States for the add account form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountHolder, setNewAccountHolder] = useState('');

  // Sync and migrate data
  React.useEffect(() => {
    if (profile) {
      setQrisUrl(profile.qrisUrl || '');
      
      // Handle migration from old single field profile to list if needed
      if (profile.bankAccounts) {
        setBankAccounts(profile.bankAccounts);
      } else if (profile.bankName && profile.accountNumber) {
        // Create initial list from old data
        const initialAccount = {
          id: Date.now().toString(),
          bankName: profile.bankName,
          accountNumber: profile.accountNumber,
          accountHolder: profile.accountHolder || ''
        };
        setBankAccounts([initialAccount]);
      } else {
        setBankAccounts([]);
      }
    }
  }, [profile]);

  const handleAddAccount = async () => {
    if (!newBankName || !newAccountNumber || !newAccountHolder) {
      alert("Mohon lengkapi semua data rekening.");
      return;
    }

    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const newAccount = {
        id: Date.now().toString(),
        bankName: newBankName,
        accountNumber: newAccountNumber,
        accountHolder: newAccountHolder,
      };

      const updatedAccounts = [...bankAccounts, newAccount];
      const driverRef = doc(db, "drivers", auth.currentUser.uid);
      
      await setDoc(driverRef, { bankAccounts: updatedAccounts }, { merge: true });
      updateProfile({ bankAccounts: updatedAccounts });
      
      setBankAccounts(updatedAccounts);
      setNewBankName('');
      setNewAccountNumber('');
      setNewAccountHolder('');
      setShowAddForm(false);
      alert("Rekening berhasil ditambahkan!");
    } catch (error) {
      console.error("Error adding account:", error);
      alert("Gagal menambahkan rekening: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!window.confirm("Hapus rekening ini?")) return;
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const updatedAccounts = bankAccounts.filter(acc => acc.id !== id);
      const driverRef = doc(db, "drivers", auth.currentUser.uid);
      
      await setDoc(driverRef, { bankAccounts: updatedAccounts }, { merge: true });
      updateProfile({ bankAccounts: updatedAccounts });
      setBankAccounts(updatedAccounts);
      alert("Rekening berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Gagal menghapus rekening.");
    } finally {
      setLoading(false);
    }
  };

  const handleQrisUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!auth.currentUser) {
      alert("Sesi berakhir, silakan login kembali.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran file terlalu besar. Maksimal 2MB.");
      return;
    }
    
    setLoading(true);
    try {
      const storageRef = ref(storage, `qris/${auth.currentUser.uid}`);
      const metadata = { contentType: file.type };
      
      await uploadBytes(storageRef, file, metadata);
      const url = await getDownloadURL(storageRef);
      setQrisUrl(url);
      
      const driverRef = doc(db, "drivers", auth.currentUser.uid);
      await setDoc(driverRef, { qrisUrl: url }, { merge: true });
      updateProfile({ qrisUrl: url });
      
      alert("Berhasil! Gambar QRIS telah diperbarui.");
    } catch (error) {
      console.error("Error QRIS upload:", error);
      alert("Gagal upload QRIS: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!auth.currentUser) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran foto terlalu besar. Maksimal 2MB.");
      return;
    }

    setLoading(true);
    try {
      const storageRef = ref(storage, `profile_pics/${auth.currentUser.uid}`);
      const metadata = { contentType: file.type };

      await uploadBytes(storageRef, file, metadata);
      const url = await getDownloadURL(storageRef);

      const driverRef = doc(db, "drivers", auth.currentUser.uid);
      await setDoc(driverRef, { photoUrl: url }, { merge: true });
      updateProfile({ photoUrl: url });

      alert("Foto profil berhasil diperbarui!");
    } catch (error) {
      console.error("Error profile pic upload:", error);
      alert("Gagal memperbarui foto profil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-dim min-h-screen text-white font-body pb-32">
      {/* Dynamic Header */}
      <header className="bg-[#0e0e0e]/90 backdrop-blur-md sticky top-0 z-50 border-b border-white/5 py-8">
        <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center px-6">
          <div className="relative group cursor-pointer mb-5">
            <label className="cursor-pointer block relative group">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleProfilePicUpload}
                disabled={loading}
              />
              <div className="w-28 h-28 rounded-full border-[6px] border-[#262626] overflow-hidden group-hover:border-primary transition-all shadow-2xl relative">
                <img 
                  src={profile?.photoUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuB1uS3ff2JpvqzPJfBz6jy9Gwt4iZW5fHAgnymzDNUfKxsIt0aGrdYRzaaTJC_O2HtqQKeHtnENQp3S9HwDZlWq5JMmnN2DbKWsjyMr7GThLWvjH6Pv0l1ti83JuyqVGdKThmAnR658TxQ7pfyItmhSzFqKM49rIZuLio_9Rh81dX_ys82EoBYTYJUHoKOgm4WbooNmSL0Vu7TfyegTXQe9eCIN4YUx77MIk4i4uFuy1Irma1PI3zoru41Sf2WYo0cOketOMvQnN7g"} 
                  alt={profile?.name} 
                  className="w-full h-full object-cover filter brightness-90 group-hover:brightness-100 group-hover:scale-110 transition-all duration-500"
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
                </div>
                {loading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </label>
            {/* Status Indicator */}
            <div className="absolute bottom-1 right-2 w-6 h-6 rounded-full bg-[#131313] flex items-center justify-center border-2 border-[#131313] shadow-lg">
              <span className={`w-3 h-3 rounded-full ${profile?.isOnline ? 'bg-green-500 animate-pulse' : 'bg-outline-variant'}`}></span>
            </div>
          </div>
          
          <h1 className="font-headline font-extrabold text-3xl text-white mb-1 tracking-tight">{profile?.name || "Driver"}</h1>
          
          <div className="bg-surface-container-highest px-3 py-1 rounded-full border border-white/5 flex items-center gap-1.5 shadow-sm mt-3">
            <span className="material-symbols-outlined text-[12px] text-tertiary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            <span className="text-xs font-bold">{profile?.rating || "0.0"}</span>
            <span className="text-outline text-xs">|</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">{profile?.level || "Mitra"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto flex flex-col gap-6 px-6 mt-6">
        
        {/* Vehicle Info */}
        <section className="bg-surface-container-low p-6 rounded-[2rem] border border-white/5 space-y-4 hover:border-primary/20 transition-colors shadow-inner">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-xl">two_wheeler</span>
            <h2 className="font-headline font-bold text-lg text-white">Info Kendaraan</h2>
          </div>
          
          <div className="bg-surface-container-highest p-4 rounded-xl border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Tipe Kendaraan</p>
              <p className="font-bold text-base text-white">{profile?.vehicleType || "Tipe Motor"}</p>
            </div>
            <div className="border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1 text-left md:text-right">Plat Nomor</p>
              <div className="bg-white px-4 py-2 rounded-lg border-2 border-dashed border-gray-400">
                <p className="font-mono text-xl font-black text-black tracking-widest">{profile?.plateNumber || "XX 0000 XX"}</p>
              </div>
            </div>
          </div>
        </section>

        {/* List of Bank Accounts */}
        <section className="bg-surface-container-low p-6 rounded-[2rem] border border-white/5 space-y-4 hover:border-primary/20 transition-colors shadow-inner">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">account_balance</span>
              <h2 className="font-headline font-bold text-lg text-white">Daftar Rekening</h2>
            </div>
            {!showAddForm && (
              <button 
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-bold hover:bg-primary/20 transition-all"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                Tambah
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {bankAccounts.length === 0 && !showAddForm && (
              <div className="text-center py-8 bg-[#1a1a1a] rounded-2xl border border-dashed border-white/5">
                <span className="material-symbols-outlined text-outline text-3xl mb-2">payments</span>
                <p className="text-xs text-on-surface-variant font-medium italic">Belum ada rekening terdaftar</p>
              </div>
            )}

            {bankAccounts.map((acc) => (
              <div key={acc.id} className="bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e] p-5 rounded-2xl border border-white/5 shadow-xl relative group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">{acc.bankName}</span>
                    <span className="text-lg font-headline font-black text-white italic tracking-wider">{acc.accountNumber}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="w-8 h-8 rounded-full bg-error/10 text-error flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/20"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
                <div className="flex justify-between items-end">
                   <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#f3ffca]/40 mb-0.5">Atas Nama</span>
                    <span className="font-bold text-xs text-white uppercase">{acc.accountHolder}</span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-sm">wallet</span>
                  </div>
                </div>
              </div>
            ))}

            {showAddForm && (
              <div className="bg-[#1a1a1a] p-5 rounded-2xl border border-primary/30 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-sm text-primary">Tambah Rekening Baru</h3>
                  <button onClick={() => setShowAddForm(false)} className="text-outline hover:text-white">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1.5 ml-1">Bank</p>
                      <input 
                        type="text" 
                        placeholder="BCA/Mandiri..." 
                        value={newBankName}
                        onChange={(e) => setNewBankName(e.target.value)}
                        className="w-full bg-[#0e0e0e] border border-white/10 rounded-xl px-4 py-3 text-xs focus:border-primary outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1.5 ml-1">No Rekening</p>
                      <input 
                        type="text" 
                        placeholder="0001 ..." 
                        value={newAccountNumber}
                        onChange={(e) => setNewAccountNumber(e.target.value)}
                        className="w-full bg-[#0e0e0e] border border-white/10 rounded-xl px-4 py-3 text-xs focus:border-primary outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1.5 ml-1">Atas Nama</p>
                    <input 
                      type="text" 
                      placeholder="Sesuai Tabungan" 
                      value={newAccountHolder}
                      onChange={(e) => setNewAccountHolder(e.target.value)}
                      className="w-full bg-[#0e0e0e] border border-white/10 rounded-xl px-4 py-3 text-xs focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <button 
                    onClick={handleAddAccount}
                    disabled={loading}
                    className="w-full py-3 bg-primary text-black font-headline font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg active:scale-95 transition-all"
                  >
                    {loading ? "Menyimpan..." : "Simpan Rekening"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* QRIS Upload Status */}
        <section className="bg-surface-container-low p-6 rounded-[2rem] border border-white/5 space-y-4 hover:border-primary/20 transition-colors shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

          <div className="flex items-center justify-between z-10 relative">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">qr_code_scanner</span>
              <h2 className="font-headline font-bold text-lg text-white">QRIS Kustom</h2>
            </div>
            {qrisUrl ? (
              <span className="text-secondary font-bold text-[10px] uppercase tracking-wider bg-secondary/10 px-2 py-1 rounded">Aktif</span>
            ) : (
              <span className="text-error font-bold text-[10px] uppercase tracking-wider bg-error/10 px-2 py-1 rounded">Belum Diupload</span>
            )}
          </div>
          
          <p className="text-sm text-on-surface-variant relative z-10 leading-relaxed">
            Upload gambar QRIS statis M-Banking/E-Wallet Anda agar pelanggan bisa membayar secara non-tunai langsung ke Anda.
          </p>
          
          <div className="relative z-10 mt-2">
            {!qrisUrl ? (
              <label className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary/40 rounded-xl bg-surface-container-highest/50 hover:bg-surface-container-highest hover:border-primary transition-all group-hover:border-primary cursor-pointer active:scale-95 shadow-inner">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleQrisUpload}
                  disabled={loading}
                />
                <span className="material-symbols-outlined text-3xl text-primary mb-2 opacity-80 group-hover:opacity-100 transition-opacity">cloud_upload</span>
                <span className="font-bold text-sm text-primary mb-1">Unggah Gambar QRIS</span>
                <span className="text-xs text-on-surface-variant font-medium">JPEG, PNG Max 2MB</span>
              </label>
            ) : (
              <div className="space-y-4">
                <div className="w-full bg-white p-4 rounded-xl flex items-center justify-center shadow-lg border border-white/20">
                  <img src={qrisUrl} alt="QRIS" className="max-h-48 object-contain" />
                </div>
                <label className="w-full py-3 bg-surface-container-highest border border-white/10 rounded-xl text-primary font-bold text-sm tracking-wide hover:bg-[#262626] transition-colors active:scale-95 shadow-md flex justify-center items-center gap-2 cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleQrisUpload}
                    disabled={loading}
                  />
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Ganti Gambar QRIS
                </label>
              </div>
            )}
          </div>
        </section>
        
        {/* Settings Menu */}
        <section className="bg-surface-container-low rounded-[2rem] border border-white/5 overflow-hidden shadow-sm">
          <div 
            onClick={() => navigate('/edit-profile')}
            className="flex items-center justify-between p-5 border-b border-white/5 hover:bg-surface-container-highest transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">manage_accounts</span>
              <span className="font-bold text-sm text-white">Pengaturan Akun</span>
            </div>
            <span className="material-symbols-outlined text-outline text-sm group-hover:translate-x-1 transition-transform">chevron_right</span>
          </div>

          <div className="flex items-center justify-between p-5 border-b border-white/5 hover:bg-surface-container-highest transition-colors cursor-pointer group">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">description</span>
              <span className="font-bold text-sm text-white">Syarat & Ketentuan Mitra</span>
            </div>
            <span className="material-symbols-outlined text-outline text-sm group-hover:translate-x-1 transition-transform">chevron_right</span>
          </div>
          
          <div 
            onClick={async () => {
              await signOut(auth);
              clearData();
              navigate('/login');
            }}
            className="flex items-center justify-between p-5 hover:bg-surface-container-highest transition-colors cursor-pointer group text-error hover:text-red-400"
          >
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined">logout</span>
              <span className="font-bold text-sm">Keluar Akun (Log Out)</span>
            </div>
          </div>
        </section>
      </main>


    </div>
  );
}

export default Profile;
