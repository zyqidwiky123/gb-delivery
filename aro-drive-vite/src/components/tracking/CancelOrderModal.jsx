const CANCEL_REASONS = [
  'Salah alamat / detail pesanan',
  'Driver terlalu jauh / lama',
  'Ganti metode pembayaran',
  'Ingin merubah pesanan',
  'Lainnya',
];

export default function CancelOrderModal({
  show,
  onClose,
  onConfirm,
  selectedReason,
  onReasonChange,
  isCancelling,
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-background/80 backdrop-blur-md flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface rounded-[2.5rem] border border-outline shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 border-b border-outline flex justify-between items-start">
          <div>
            <h3 className="text-xl font-black text-on-surface italic uppercase tracking-tight">
              Batalkan Pesanan?
            </h3>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-1">
              Beritahu kami alasannya
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-on-surface/5 rounded-full flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-on-surface">close</span>
          </button>
        </div>

        <div className="p-8 space-y-3">
          {CANCEL_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => onReasonChange(reason)}
              className={`w-full p-4 rounded-2xl text-left text-sm font-bold transition-all border ${selectedReason === reason ? 'bg-primary/10 border-primary text-primary' : 'bg-on-surface/5 border-transparent text-on-surface-variant hover:bg-on-surface/10'}`}
            >
              {reason}
            </button>
          ))}

          <div className="pt-6">
            <button
              disabled={isCancelling || !selectedReason}
              onClick={onConfirm}
              className="w-full py-5 bg-error text-on-error font-headline font-black rounded-3xl uppercase tracking-[0.2em] text-sm active:scale-95 transition-all shadow-lg disabled:opacity-40"
            >
              {isCancelling ? 'MEMBATALKAN...' : 'KONFIRMASI PEMBATALAN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
