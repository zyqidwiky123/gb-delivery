import React, { useState, useRef, useEffect } from 'react';
import { useMerchantStore } from '../store/useMerchantStore';
import { ChevronLeft, CreditCard, Camera, Save, Trash2, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const paymentInfoSchema = yup.object({
  bankName: yup.string().required('Nama bank wajib diisi'),
  bankAccountNumber: yup
    .string()
    .matches(/^\d+$/, 'Nomor rekening hanya boleh berisi angka')
    .min(8, 'Nomor rekening minimal 8 digit')
    .required('Nomor rekening wajib diisi'),
  bankAccountName: yup.string().required('Nama pemilik rekening wajib diisi'),
});

function PaymentInfo() {
  const { merchant, updateMerchant, uploadImage, user } = useMerchantStore();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const qrisInputRef = useRef(null);
  const [qrisPreview, setQrisPreview] = useState(merchant?.qrisUrl || null);
  const [qrisFile, setQrisFile] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isLoading },
  } = useForm({
    resolver: yupResolver(paymentInfoSchema),
    defaultValues: {
      bankName: merchant?.bankName || '',
      bankAccountNumber: merchant?.bankAccountNumber || '',
      bankAccountName: merchant?.bankAccountName || '',
    },
  });

  // Sync form-hook-form values when merchant data arrives
  useEffect(() => {
    if (merchant) {
      setValue('bankName', merchant.bankName || '');
      setValue('bankAccountNumber', merchant.bankAccountNumber || '');
      setValue('bankAccountName', merchant.bankAccountName || '');
      setQrisPreview(merchant.qrisUrl || null);
    }
  }, [merchant, setValue]);

  const handleQrisSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 5 * 1024 * 1024) { if(file) alert('Max 5MB'); return; }
    setQrisFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setQrisPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      const updates = { 
        bankName: data.bankName,
        bankAccountNumber: data.bankAccountNumber,
        bankAccountName: data.bankAccountName
      };
      if (qrisFile) { 
        updates.qrisUrl = await uploadImage(qrisFile, `merchants/${user.uid}/qris`); 
      }
      else if (!qrisPreview && merchant?.qrisUrl) { 
        updates.qrisUrl = null; 
      }
      await updateMerchant(updates);
      setSuccess(true); 
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) { 
      alert("Gagal menyimpan: " + err.message); 
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-dark">
      <header className="bg-surface/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/settings" className="text-white/40 hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </Link>
          <h2 className="font-headline font-bold text-lg">Pembayaran</h2>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit(handleSave)} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5"><QrCode size={12} />Foto QRIS</label>
            <div className="relative">
              <div onClick={() => qrisInputRef.current?.click()} className="w-full h-56 bg-white/5 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/30 transition-colors overflow-hidden">
                {qrisPreview ? <img src={qrisPreview} alt="QRIS" className="w-full h-full object-contain p-4" /> : <><Camera size={40} className="text-white/20 mb-2" /><span className="text-xs text-white/30">Tap untuk upload foto QRIS</span></>}
              </div>
              {qrisPreview && <button type="button" onClick={() => { setQrisFile(null); setQrisPreview(null); }} className="absolute top-3 right-3 w-8 h-8 bg-red-500/80 text-white rounded-full flex items-center justify-center"><Trash2 size={14} /></button>}
            </div>
            <input ref={qrisInputRef} type="file" accept="image/*" onChange={handleQrisSelect} className="hidden" />
          </div>
          <div className="card space-y-4">
            <div className="flex items-center gap-2 mb-2"><CreditCard size={16} className="text-primary" /><h3 className="font-bold text-sm">Informasi Rekening</h3></div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Nama Bank</label>
              <input 
                {...register('bankName')}
                type="text" 
                className={`input-field w-full ${errors.bankName ? 'border-destructive' : ''}`}
                placeholder="BRI, BCA, Mandiri"
              />
              {errors.bankName && (
                <p className="mt-1 text-destructive text-sm">{errors.bankName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Nomor Rekening</label>
              <input 
                {...register('bankAccountNumber')}
                type="text" 
                className={`input-field w-full ${errors.bankAccountNumber ? 'border-destructive' : ''}`}
                placeholder="1234567890"
              />
              {errors.bankAccountNumber && (
                <p className="mt-1 text-destructive text-sm">{errors.bankAccountNumber.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-1.5">Nama Pemilik</label>
              <input 
                {...register('bankAccountName')}
                type="text" 
                className={`input-field w-full ${errors.bankAccountName ? 'border-destructive' : ''}`}
                placeholder="Sesuai buku rekening"
              />
              {errors.bankAccountName && (
                <p className="mt-1 text-destructive text-sm">{errors.bankAccountName.message}</p>
              )}
            </div>
          </div>
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-4"><p className="text-xs text-white/40"><strong className="text-primary">Catatan:</strong> Pembayaran tunai tetap via driver. QRIS untuk non-tunai.</p></div>
          {success && <div className="bg-primary/10 border border-primary/20 text-primary p-3 rounded-xl text-sm font-medium text-center">✓ Berhasil disimpan!</div>}
          <button type="submit" disabled={saving} className="btn-primary w-full py-4 shadow-lg shadow-primary/20">
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Save size={20} />
                <span>Simpan</span>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

export default PaymentInfo;