import React, { useState, useEffect } from 'react';
import { db } from '@aro/shared/firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { useAdminStore } from '../store/adminStore';

function UserManagement() {
  const [loading, setLoading] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);

  const { users, setUsers, vouchers } = useAdminStore();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('loyaltyPoints', 'desc'));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setUsers(list);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserPoints = async (userId, newPoints) => {
    setIsSavingUser(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        loyaltyPoints: Number(newPoints),
      });
      alert('Poin Berhasil Diperbarui!');
      fetchUsers();
    } catch (error) {
      console.error('Error updating points:', error);
      alert('Gagal memperbarui poin.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleAddVoucherToUser = async (userId, template) => {
    setIsSavingUser(true);
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) throw new Error('User not found');

      const currentVouchers = userDoc.data().vouchers || [];
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (template.expiryDays || 30));

      const voucherToGrant = {
        id: Date.now().toString(),
        templateId: template.id || null,
        code: template.code || '',
        type: template.type || 'FREE_DELIVERY',
        title: template.title || 'Voucher Spesial Admin',
        value: template.value || 0,
        minOrder: template.minOrder || 0,
        expiryDate: expiryDate.toISOString(),
        createdAt: new Date().toISOString(),
        used: false,
      };

      await updateDoc(userRef, {
        vouchers: [...currentVouchers, voucherToGrant],
      });

      alert(`Voucher "${voucherToGrant.title}" Berhasil Diberikan!`);
      fetchUsers();
    } catch (error) {
      console.error('Error adding voucher:', error);
      alert('Gagal memberikan voucher.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (
      !window.confirm(
        `Hapus user ${user.displayName || 'ini'}? Akun login dan datanya akan hilang permanen!`
      )
    )
      return;

    setIsDeleting(user.id);
    try {
      // 1. Delete from Firebase Auth via Cloud Function
      const response = await fetch(
        'https://asia-southeast2-gb-delivery-41bf6.cloudfunctions.net/deleteUserAccount',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.id }),
        }
      );

      const result = await response.json();
      if (!result.success && !result.error?.includes('auth/user-not-found')) {
        throw new Error(result.error || 'Gagal hapus akun Auth');
      }

      // 2. Delete from Firestore
      await deleteDoc(doc(db, 'users', user.id));
      alert('User dan akun login berhasil dihapus!');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Gagal hapus user: ' + error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5">
        <div>
          <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">
            User Management
          </h3>
          <p className="text-sm text-on-surface-variant font-medium">
            Kelola poin dan voucher member
          </p>
        </div>
        <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl md:rounded-3xl flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-2xl md:text-3xl">group</span>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-[2rem] overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                <th className="px-8 py-5">User</th>
                <th className="px-4 py-5 text-center">Tipe</th>
                <th className="px-4 py-5 text-center">Loyalty Points</th>
                <th className="px-4 py-5 text-center">Active Vouchers</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-8 py-20 text-center text-sm font-bold text-on-surface-variant uppercase tracking-widest italic opacity-50"
                  >
                    Belum ada user terdaftar.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="group hover:bg-white/5 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center overflow-hidden border border-white/10">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-on-surface-variant">
                              person
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-white">
                            {user.displayName || 'Anonymous'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant uppercase font-mono">
                            {user.email || user.id.slice(-8)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          user.isGuest
                            ? 'bg-white/5 text-on-surface-variant'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {user.isGuest ? 'Guest' : 'Member'}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <p className="font-black text-primary font-headline text-lg">
                        {user.loyaltyPoints || 0} PTS
                      </p>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-white">
                        {(user.vouchers?.filter((v) => !v.used) || []).length} Vouchers
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setShowEditUserModal(true);
                          }}
                          className="bg-white/5 text-white font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest border border-white/10 active:scale-90 transition-all hover:bg-primary hover:text-black hover:border-primary"
                        >
                          Edit Loyalitas
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          disabled={isDeleting === user.id}
                          className="bg-error/10 text-error font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest border border-error/20 active:scale-90 transition-all hover:bg-error hover:text-black disabled:opacity-50 flex items-center justify-center"
                        >
                          {isDeleting === user.id ? (
                            <span className="material-symbols-outlined text-sm animate-spin">
                              sync
                            </span>
                          ) : (
                            'Hapus'
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setShowEditUserModal(false)}
          ></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">military_tech</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">
                    Loyalty Management
                  </h3>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                    {editingUser.displayName || editingUser.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditUserModal(false)}
                className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"
              >
                <span className="material-symbols-outlined text-white">close</span>
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Points Adjustment */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Update Loyalty Points
                </label>
                <div className="flex gap-4">
                  <input
                    type="number"
                    defaultValue={editingUser.loyaltyPoints || 0}
                    id="pointsInput"
                    className="flex-1 bg-surface-container-highest border-none rounded-xl py-4 px-6 text-xl font-black text-primary focus:ring-2 focus:ring-primary transition-all"
                  />
                  <button
                    onClick={() =>
                      handleUpdateUserPoints(
                        editingUser.id,
                        document.getElementById('pointsInput').value
                      )
                    }
                    disabled={isSavingUser}
                    className="bg-primary text-black font-black px-8 rounded-xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                  >
                    Update
                  </button>
                </div>
              </div>

              <div className="h-px bg-white/5 w-full"></div>

              {/* Grant Voucher */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Grant Special Voucher
                </label>
                <div className="space-y-3">
                  {vouchers.length > 0 ? (
                    <select
                      id="voucherTemplateSelect"
                      className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-6 text-sm font-bold text-white focus:ring-2 focus:ring-primary transition-all appearance-none"
                    >
                      {vouchers.map((v, i) => (
                        <option key={i} value={i}>
                          {v.title} ({v.code || 'Tanpa Kode'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Contoh: Voucher Kompensasi Delay"
                      id="voucherTitleInput"
                      className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-6 text-sm font-bold text-white focus:ring-2 focus:ring-primary transition-all"
                    />
                  )}
                  <button
                    onClick={() => {
                      if (vouchers.length > 0) {
                        const idx = document.getElementById('voucherTemplateSelect').value;
                        handleAddVoucherToUser(editingUser.id, vouchers[idx]);
                      } else {
                        handleAddVoucherToUser(editingUser.id, {
                          title: document.getElementById('voucherTitleInput').value,
                          type: 'FREE_DELIVERY',
                          expiryDays: 30,
                        });
                      }
                    }}
                    disabled={isSavingUser}
                    className="w-full bg-secondary text-black font-black py-4 rounded-xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">card_giftcard</span>
                    Berikan Voucher
                  </button>
                </div>
                <p className="text-[10px] text-on-surface-variant text-center font-medium italic">
                  * Voucher yang diberikan otomatis berjenis GRATIS ONGKIR.
                </p>
              </div>

              {/* Current Vouchers List */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  Voucher Saat Ini ({(editingUser.vouchers || []).length})
                </label>
                <div className="space-y-2">
                  {(editingUser.vouchers || []).length === 0 ? (
                    <p className="text-xs text-on-surface-variant italic">
                      User tidak memiliki voucher.
                    </p>
                  ) : (
                    editingUser.vouchers.map((v, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border flex justify-between items-center ${v.used ? 'bg-white/5 border-white/5 opacity-50' : 'bg-primary/5 border-primary/20'}`}
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{v.title}</p>
                          <p className="text-[9px] text-on-surface-variant uppercase">
                            {v.type} • {v.used ? 'TELAH DIGUNAKAN' : 'AKTIF'}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant text-sm">
                          {v.used ? 'check_circle' : 'confirmation_number'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
