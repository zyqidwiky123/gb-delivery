import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, doc, deleteDoc } from 'firebase/firestore';

function AdminMerchants() {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "merchants"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMerchants(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (merchantId, merchantName) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus merchant "${merchantName}"? Data yang dihapus tidak dapat dikembalikan.`)) {
      try {
        await deleteDoc(doc(db, "merchants", merchantId));
        alert(`Merchant ${merchantName} berhasil dihapus.`);
      } catch (error) {
        console.error("Error deleting merchant:", error);
        alert("Gagal menghapus merchant. Coba lagi.");
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-[#080808] text-on-background font-body">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#111] border-r border-on-background/5 hidden md:flex flex-col">
        <div className="p-8">
           <h1 className="font-['Plus_Jakarta_Sans'] font-black text-2xl italic text-primary tracking-tighter">ARO ADMIN</h1>
        </div>
        
        <nav className="flex-grow px-4 space-y-2">
           <Link to="/admin" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-on-background/5 hover:text-on-background transition-all">
              <span className="material-symbols-outlined text-xl">dashboard</span>
              <span className="font-bold text-sm">Dashboard</span>
           </Link>
           <Link to="/admin/orders" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-on-background/5 hover:text-on-background transition-all">
              <span className="material-symbols-outlined text-xl">list_alt</span>
              <span className="font-bold text-sm">Semua Pesanan</span>
           </Link>
           <Link to="/admin/merchants" className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 text-primary group border border-primary/20">
              <span className="material-symbols-outlined text-xl">store</span>
              <span className="font-bold text-sm">Kelola Merchant</span>
           </Link>
           <Link to="/admin/orders/create" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-on-background/5 hover:text-on-background transition-all">
               <span className="material-symbols-outlined text-xl">add_circle</span>
               <span className="font-bold text-sm">Buat Pesanan</span>
            </Link>
            <Link to="/admin/settings" className="flex items-center gap-3 p-4 rounded-xl text-zinc-500 hover:bg-on-background/5 hover:text-on-background transition-all">
               <span className="material-symbols-outlined text-xl">settings</span>
               <span className="font-bold text-sm">Pengaturan Tarif</span>
            </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-8 md:p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
            <div>
               <h2 className="text-3xl font-headline font-black italic tracking-tight mb-1 uppercase">Kelola Merchant</h2>
               <p className="text-zinc-500 text-sm font-medium">Manajemen data merchant ARO Food & ARO Shop.</p>
            </div>
            <div className="flex bg-[#111] p-1 rounded-xl border border-on-background/5">
                <button className="px-6 py-2 bg-primary text-black font-black uppercase text-[10px] rounded-lg tracking-widest">Semua</button>
            </div>
        </header>

        {loading ? (
          <div className="p-20 text-center animate-pulse text-zinc-500 font-black uppercase tracking-widest italic text-xl">
             Loading Data Merchant...
          </div>
        ) : (
          <div className="bg-[#111] rounded-[2.5rem] border border-on-background/5 overflow-hidden shadow-2xl overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                   <tr className="bg-[#1a1a1a] text-zinc-500 text-[10px] uppercase font-black tracking-widest border-b border-on-background/5">
                      <th className="px-8 py-6">Info Merchant</th>
                      <th className="px-8 py-6">Kategori</th>
                      <th className="px-8 py-6">Rating</th>
                      <th className="px-8 py-6 text-right">Aksi</th>
                   </tr>
                </thead>
                <tbody>
                   {merchants.map((merchant) => (
                      <tr key={merchant.id} className="border-b border-on-background/5 hover:bg-on-background/5 transition-colors group">
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               {merchant.image ? (
                                  <img src={merchant.image} alt={merchant.name} className="w-12 h-12 rounded-xl object-cover border border-on-background/5" />
                               ) : (
                                  <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-on-background/5">
                                     <span className="material-symbols-outlined text-primary text-xl">store</span>
                                  </div>
                               )}
                               <div>
                                  <p className="text-sm font-bold text-on-background">{merchant.name || 'Unnamed Merchant'}</p>
                                  <p className="text-[10px] text-zinc-500 font-bold max-w-[200px] truncate">{merchant.address || '-'}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{merchant.category || merchant.type || '-'}</span>
                         </td>
                         <td className="px-8 py-6">
                            <div className="flex items-center gap-1">
                               <span className="material-symbols-outlined text-yellow-400 text-sm">star</span>
                               <span className="text-sm font-bold">{merchant.rating || '0.0'}</span>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-right">
                            <button 
                               onClick={() => handleDelete(merchant.id, merchant.name || 'Unnamed Merchant')} 
                               className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                               title="Hapus Merchant"
                            >
                               <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminMerchants;
