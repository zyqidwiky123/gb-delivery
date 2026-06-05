import React, { useState } from 'react';
import { auth } from '../firebase/config';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { ChevronLeft, Shield, Save, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';

function Security() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(false);

    if (newPw.length < 6) { setError('Password baru minimal 6 karakter.'); return; }
    if (newPw !== confirmPw) { setError('Konfirmasi password tidak cocok.'); return; }

    setSaving(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);
      setSuccess(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Password saat ini salah.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Terlalu banyak percobaan. Coba lagi nanti.');
      } else {
        setError('Gagal mengubah password: ' + err.message);
      }
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-dark">
      <header className="bg-surface/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/settings" className="text-white/40 hover:text-white transition-colors"><ChevronLeft size={24} /></Link>
          <h2 className="font-headline font-bold text-lg">Keamanan</h2>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <div className="card mb-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="text-primary" size={20} />
            <h3 className="font-bold">Ganti Password</h3>
          </div>
          <p className="text-xs text-white/40">Pastikan menggunakan password yang kuat dan unik.</p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-sm font-medium">{error}</div>}
          {success && <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-xl text-sm font-medium">✓ Password berhasil diubah!</div>}

          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Password Saat Ini</label>
            <div className="relative">
              <input type={showCurrent ? 'text' : 'password'} className="input-field w-full pr-12" placeholder="••••••••" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60">
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Password Baru</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} className="input-field w-full pr-12" placeholder="Minimal 6 karakter" value={newPw} onChange={e => setNewPw(e.target.value)} required />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60">
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Konfirmasi Password Baru</label>
            <input type="password" className="input-field w-full" placeholder="Ulangi password baru" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full py-4 mt-4 shadow-lg shadow-primary/20">
            {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={20} /><span>Ubah Password</span></>}
          </button>
        </form>

        <div className="mt-8 bg-white/5 rounded-xl p-4">
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mb-1">Email Akun</p>
          <p className="text-sm text-white/60">{auth.currentUser?.email || '-'}</p>
        </div>
      </main>
    </div>
  );
}

export default Security;
