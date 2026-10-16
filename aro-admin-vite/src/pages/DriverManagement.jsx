import React, { useState, useEffect } from 'react';
import { db } from '@aro/shared/firebase';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
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

function DriverManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: '',
    email: '',
    phone: '',
    plateNumber: '',
    vehicleType: 'jek',
    password: '',
  });
  const [editingDriver, setEditingDriver] = useState(null);
  const [showEditDriverModal, setShowEditDriverModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);

  const { drivers, setDrivers } = useAdminStore();

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'drivers'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDrivers(list);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    setIsAddingDriver(true);

    let secondaryApp;
    try {
      secondaryApp = initializeApp(secondaryFirebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        newDriver.email,
        newDriver.password
      );
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'drivers', uid), {
        name: newDriver.name,
        email: newDriver.email,
        phone: newDriver.phone,
        plateNumber: newDriver.plateNumber,
        vehicleType: newDriver.vehicleType,
        isVerified: true,
        isBanned: false,
        isOnline: false,
        rating: 5.0,
        createdAt: serverTimestamp(),
        role: 'driver',
      });

      alert('Driver Berhasil Didaftarkan!');
      setShowAddDriverModal(false);
      setNewDriver({
        name: '',
        email: '',
        phone: '',
        plateNumber: '',
        vehicleType: 'jek',
        password: '',
      });
      fetchDrivers();
    } catch (error) {
      console.error('Error adding driver:', error);
      alert('Gagal mendaftarkan driver: ' + error.message);
    } finally {
      setIsAddingDriver(false);
    }
  };

  const handleDeleteDriver = async (driver) => {
    if (
      !window.confirm(`Hapus driver ${driver.name}? Akun login dan datanya akan hilang permanen!`)
    )
      return;

    setIsDeleting(driver.id);
    try {
      // 1. Delete from Firebase Auth via Cloud Function
      const response = await fetch(
        'https://asia-southeast2-gb-delivery-41bf6.cloudfunctions.net/deleteUserAccount',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: driver.id }),
        }
      );

      const result = await response.json();
      if (!result.success && !result.error?.includes('auth/user-not-found')) {
        throw new Error(result.error || 'Gagal hapus akun Auth');
      }

      // 2. Delete from Firestore
      await deleteDoc(doc(db, 'drivers', driver.id));
      alert('Driver dan akun login berhasil dihapus!');
      fetchDrivers();
    } catch (error) {
      console.error('Error deleting driver:', error);
      alert('Gagal hapus driver: ' + error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpdateDriver = async (e) => {
    e.preventDefault();
    if (!editingDriver) return;

    setLoading(true);
    try {
      const driverRef = doc(db, 'drivers', editingDriver.id);
      await updateDoc(driverRef, {
        name: editingDriver.name,
        phone: editingDriver.phone,
        plateNumber: editingDriver.plateNumber,
        email: editingDriver.email,
        vehicleType: editingDriver.vehicleType,
      });

      alert('Data driver berhasil diperbarui!');
      setShowEditDriverModal(false);
      fetchDrivers();
    } catch (error) {
      console.error('Error updating driver:', error);
      alert('Gagal update driver: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleVerifyDriver = async (driverId, currentStatus) => {
    try {
      await updateDoc(doc(db, 'drivers', driverId), { isVerified: !currentStatus });
      fetchDrivers();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleBanUser = async (userId, collectionName, currentStatus) => {
    try {
      await updateDoc(doc(db, collectionName, userId), { isBanned: !currentStatus });
      if (collectionName === 'drivers') fetchDrivers();
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 gap-6">
        <div>
          <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">
            Driver Management
          </h3>
          <p className="text-sm text-on-surface-variant font-medium">
            Verifikasi pendaftaran driver dan kelola otorisasi akses
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Cari driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-container-highest border-none rounded-2xl px-6 py-3 text-sm w-full focus:ring-2 focus:ring-primary transition-all text-white"
            />
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary">
              search
            </span>
          </div>
          <button
            onClick={() => setShowAddDriverModal(true)}
            className="w-full sm:w-auto bg-primary text-black font-black px-6 py-3 rounded-2xl hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            Tambah Driver
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drivers
          .filter(
            (d) =>
              d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              d.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              d.plateNumber?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((driver) => (
            <div
              key={driver.id}
              className="bg-surface-container-low rounded-[2rem] p-6 border border-white/5 hover:border-primary/20 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDriver(driver);
                  }}
                  className="w-10 h-10 bg-error/10 text-error rounded-full flex items-center justify-center hover:bg-error hover:text-white transition-all border border-error/20"
                  title="Hapus Driver"
                >
                  {isDeleting === driver.id ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined text-sm">delete</span>
                  )}
                </button>
              </div>

              <div
                className="flex gap-4 mb-6 cursor-pointer"
                onClick={() => {
                  setEditingDriver(driver);
                  setShowEditDriverModal(true);
                }}
              >
                <img
                  src={driver.photoUrl || 'https://via.placeholder.com/150'}
                  alt={driver.name}
                  className="w-16 h-16 rounded-2xl object-cover border border-white/10"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-lg font-black text-white font-headline uppercase leading-tight">
                      {driver.name}
                    </h4>
                    <span
                      className={`h-2 w-2 rounded-full ${driver.isOnline ? 'bg-primary' : 'bg-zinc-600'}`}
                    ></span>
                  </div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    {driver.plateNumber || 'No Plate'}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[10px] text-yellow-500">
                      star
                    </span>
                    <span className="text-[10px] font-bold text-white">
                      {driver.rating || '5.0'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                <button
                  onClick={() => toggleVerifyDriver(driver.id, driver.isVerified)}
                  className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    driver.isVerified
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                      : 'bg-primary text-black'
                  }`}
                >
                  {driver.isVerified ? 'Verified' : 'Verify Now'}
                </button>
                <button
                  onClick={() => toggleBanUser(driver.id, 'drivers', driver.isBanned)}
                  className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    driver.isBanned
                      ? 'bg-error text-white'
                      : 'bg-error/10 text-error border border-error/20'
                  }`}
                >
                  {driver.isBanned ? 'Unban' : 'Ban Driver'}
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Add Driver Modal */}
      {showAddDriverModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setShowAddDriverModal(false)}
          ></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">
                  Pendaftaran Driver
                </h3>
              </div>
              <button
                onClick={() => setShowAddDriverModal(false)}
                className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-white">close</span>
              </button>
            </div>

            <form onSubmit={handleAddDriver} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Nama Lengkap
                </label>
                <input
                  required
                  type="text"
                  value={newDriver.name}
                  onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white"
                  placeholder="Budi Santoso"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    value={newDriver.email}
                    onChange={(e) => setNewDriver({ ...newDriver, email: e.target.value })}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white"
                    placeholder="driver@aro.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Password Default
                  </label>
                  <input
                    required
                    type="password"
                    value={newDriver.password}
                    onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white"
                    placeholder="******"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Nomor WhatsApp
                  </label>
                  <input
                    required
                    type="tel"
                    value={newDriver.phone}
                    onChange={(e) => setNewDriver({ ...newDriver, phone: e.target.value })}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white"
                    placeholder="0812..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Plat Nomor
                  </label>
                  <input
                    required
                    type="text"
                    value={newDriver.plateNumber}
                    onChange={(e) => setNewDriver({ ...newDriver, plateNumber: e.target.value })}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white"
                    placeholder="AG 1234 XX"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Tipe Kendaraan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewDriver({ ...newDriver, vehicleType: 'jek' })}
                    className={`py-3 rounded-xl font-bold text-xs transition-all ${newDriver.vehicleType === 'jek' ? 'bg-primary text-black' : 'bg-white/5 text-white'}`}
                  >
                    ARO JEK (Motor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDriver({ ...newDriver, vehicleType: 'car' })}
                    className={`py-3 rounded-xl font-bold text-xs transition-all ${newDriver.vehicleType === 'car' ? 'bg-primary text-black' : 'bg-white/5 text-white'}`}
                  >
                    ARO CAR (Mobil)
                  </button>
                </div>
              </div>

              <div className="pt-6">
                <button
                  disabled={isAddingDriver}
                  type="submit"
                  className="w-full bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm"
                >
                  {isAddingDriver ? 'Mendaftarkan...' : 'Daftarkan Driver Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {showEditDriverModal && editingDriver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setShowEditDriverModal(false)}
          ></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">person_edit</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">
                    Detail & Edit Driver
                  </h3>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                    {editingDriver.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditDriverModal(false)}
                className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
              >
                <span className="material-symbols-outlined text-white">close</span>
              </button>
            </div>

            <form
              onSubmit={handleUpdateDriver}
              className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-center mb-6">
                <div className="relative group">
                  <img
                    src={editingDriver.photoUrl || 'https://via.placeholder.com/150'}
                    alt={editingDriver.name}
                    className="w-24 h-24 rounded-3xl object-cover border-4 border-white/5 group-hover:border-primary/50 transition-all"
                  />
                  <div className="absolute inset-0 bg-black/50 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer">
                    <span className="material-symbols-outlined text-white">photo_camera</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Nama Lengkap
                </label>
                <input
                  required
                  type="text"
                  value={editingDriver.name}
                  onChange={(e) => setEditingDriver({ ...editingDriver, name: e.target.value })}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    value={editingDriver.email}
                    onChange={(e) => setEditingDriver({ ...editingDriver, email: e.target.value })}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Nomor WhatsApp
                  </label>
                  <input
                    required
                    type="tel"
                    value={editingDriver.phone}
                    onChange={(e) => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Plat Nomor
                  </label>
                  <input
                    required
                    type="text"
                    value={editingDriver.plateNumber}
                    onChange={(e) =>
                      setEditingDriver({ ...editingDriver, plateNumber: e.target.value })
                    }
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                    Tipe Kendaraan
                  </label>
                  <select
                    value={editingDriver.vehicleType}
                    onChange={(e) =>
                      setEditingDriver({ ...editingDriver, vehicleType: e.target.value })
                    }
                    className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary transition-all"
                  >
                    <option value="jek">ARO JEK (Motor)</option>
                    <option value="car">ARO CAR (Mobil)</option>
                  </select>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowEditDriverModal(false)}
                  className="flex-1 bg-white/5 text-white font-black py-4 rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs"
                >
                  Batal
                </button>
                <button
                  disabled={loading}
                  type="submit"
                  className="flex-2 bg-primary text-black font-black py-4 px-8 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Simpan Perubahan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverManagement;
