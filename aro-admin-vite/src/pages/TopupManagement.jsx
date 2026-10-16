import React, { useEffect } from 'react';
import { db } from '@aro/shared/firebase';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { useAdminStore } from '../store/adminStore';

function TopupManagement() {
  const { topupRequests, setTopupRequests } = useAdminStore();

  useEffect(() => {
    fetchTopupRequests();
  }, []);

  const fetchTopupRequests = async () => {
    try {
      const q = query(collection(db, 'topup_requests'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setTopupRequests(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching topups:', error);
    }
  };

  const handleApproveTopup = async (request) => {
    if (
      !window.confirm(
        `Setujui Top-up Rp ${request.amount.toLocaleString()} untuk ${request.driverName}?`
      )
    )
      return;
    try {
      await updateDoc(doc(db, 'topup_requests', request.id), {
        status: 'approved',
        updatedAt: serverTimestamp(),
      });
      const driverRef = doc(db, 'drivers', request.driverId);
      const driverDoc = await getDoc(driverRef);
      const currentBalance = driverDoc.exists() ? driverDoc.data().balance || 0 : 0;
      await updateDoc(driverRef, { balance: Number(currentBalance) + Number(request.amount) });
      alert('Top-up Berhasil Disetujui!');
      fetchTopupRequests();
    } catch (error) {
      console.error('Error approving topup:', error);
      alert('Gagal menyetujui top-up.');
    }
  };

  const handleRejectTopup = async (reqId) => {
    if (!window.confirm('Tolak permintaan top-up ini?')) return;
    try {
      await updateDoc(doc(db, 'topup_requests', reqId), {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });
      fetchTopupRequests();
    } catch (error) {
      console.error('Error rejecting topup:', error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5">
        <div>
          <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">
            Top-up Approval
          </h3>
          <p className="text-sm text-on-surface-variant font-medium">
            Review permintaan saldo driver
          </p>
        </div>
        <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl md:rounded-3xl flex items-center justify-center text-primary">
          <span className="material-symbols-outlined text-2xl md:text-3xl">
            account_balance_wallet
          </span>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-[2rem] overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                <th className="px-8 py-5">Driver</th>
                <th className="px-4 py-5">Nominal</th>
                <th className="px-4 py-5">Metode</th>
                <th className="px-4 py-5">Status</th>
                <th className="px-4 py-5">Waktu</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {topupRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-8 py-20 text-center text-sm font-bold text-on-surface-variant uppercase tracking-widest italic opacity-50"
                  >
                    Belum ada permintaan top-up.
                  </td>
                </tr>
              ) : (
                topupRequests.map((req) => (
                  <tr key={req.id} className="group hover:bg-white/5 transition-colors">
                    <td className="px-8 py-5">
                      <p className="font-bold text-sm text-white">{req.driverName}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase font-mono">
                        {req.driverId?.slice(-8)}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <p className="font-black text-primary font-headline">
                        Rp {req.amount?.toLocaleString('id-ID')}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase text-on-surface-variant">
                        {req.method}
                      </span>
                    </td>
                    <td className="px-4 py-5">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          req.status === 'pending'
                            ? 'bg-yellow-500/10 text-yellow-500'
                            : req.status === 'approved'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-error/10 text-error'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-[10px] font-medium text-on-surface-variant">
                      {req.createdAt?.toDate().toLocaleString('id-ID')}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {req.status === 'pending' && (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleApproveTopup(req)}
                            className="bg-primary text-black font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest active:scale-90 transition-all"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectTopup(req.id)}
                            className="bg-error/10 text-error font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest border border-error/20 active:scale-90 transition-all"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default TopupManagement;
