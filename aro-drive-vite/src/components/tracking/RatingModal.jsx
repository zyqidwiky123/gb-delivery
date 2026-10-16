export default function RatingModal({
  show,
  order,
  rating,
  onRatingChange,
  review,
  onReviewChange,
  onSubmit,
  isSubmitting,
  ratingSubmitted,
  onSkip,
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[1001] bg-background/95 backdrop-blur-xl flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface rounded-[2.5rem] p-8 border border-outline shadow-2xl text-center space-y-6">
        {!ratingSubmitted ? (
          <>
            <div className="w-20 h-20 bg-primary rounded-3xl mx-auto flex items-center justify-center rotate-12 shadow-lg mb-2">
              <span className="material-symbols-outlined text-black text-4xl font-black">star</span>
            </div>

            <div>
              <h2 className="font-headline font-black text-2xl text-on-surface mb-1 italic uppercase">
                Kasih Rating Bang!
              </h2>
              <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold">
                Gimana pelayanan driver tadi?
              </p>
            </div>

            <div className="flex justify-center gap-3 my-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => onRatingChange(star)}
                  className={`p-2 transition-all active:scale-90 ${rating >= star ? 'text-primary scale-110' : 'text-on-surface-variant/40 hover:text-on-surface-variant'}`}
                >
                  <span
                    className={`material-symbols-outlined text-4xl ${rating >= star ? 'filled' : ''}`}
                  >
                    star
                  </span>
                </button>
              ))}
            </div>

            <textarea
              placeholder="Tulis ulasan singkat (opsional)..."
              value={review}
              onChange={(e) => onReviewChange(e.target.value)}
              className="w-full bg-surface-container border border-outline rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary/30 outline-none transition-all resize-none h-24"
            />

            <div className="bg-surface-container-high rounded-2xl p-4 border border-outline flex items-center justify-between">
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Poin Didapat
                </p>
                <p className="text-2xl font-headline font-black text-on-surface italic">
                  +{order?.earnedPoints || 0}
                </p>
              </div>
              <span className="material-symbols-outlined text-primary/40 text-4xl">loyalty</span>
            </div>

            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="w-full py-5 bg-primary text-primary-fg font-headline font-black rounded-3xl uppercase tracking-[0.2em] text-sm active:scale-95 transition-all shadow-[0_10px_30px_rgb(var(--primary)/0.2)]"
            >
              {isSubmitting ? 'MENGIRIM...' : 'KIRIM ULASAN'}
            </button>

            <button
              onClick={onSkip}
              className="text-on-surface-variant/40 text-[10px] font-black uppercase tracking-widest hover:text-on-surface transition-colors"
            >
              Nanti Saja
            </button>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center space-y-4 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.3)]">
              <span className="material-symbols-outlined text-on-background text-4xl font-black">
                check
              </span>
            </div>
            <h2 className="font-headline font-black text-2xl text-on-surface italic uppercase">
              Terima Kasih!
            </h2>
            <p className="text-on-surface-variant text-sm">Ulasan kamu sangat berarti buat kami.</p>
          </div>
        )}
      </div>
    </div>
  );
}
