import { AnimatePresence } from 'framer-motion';
import { motion } from 'framer-motion';
import DriverInfoCard from './DriverInfoCard';

export default function OrderStatusCard({
  order,
  driverProfile,
  route,
  driverPos,
  isExpanded,
  onToggleExpand,
  onContactDriver,
  showPaymentDetails,
  onTogglePaymentDetails,
  onCancel,
  onPaymentMethodChange,
  onDownloadQRIS,
  children,
}) {
  if (!order || order.status === 'searching') return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1000] pointer-events-none">
      <div className="max-w-xl mx-auto relative pointer-events-auto">
        <AnimatePresence>
          {order.status === 'accepted' && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="flex justify-end pr-6 mb-4"
            >
              <div className="bg-surface-container/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-outline shadow-2xl flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Tiba dalam
                </span>
                <div className="flex items-baseline gap-1 text-primary">
                  <span className="text-3xl font-headline font-black italic">
                    {route?.durationSeconds
                      ? Math.ceil(route.durationSeconds / 60)
                      : order.distance
                        ? Math.ceil(order.distance * 3) + 2
                        : 8}
                  </span>
                  <span className="text-sm font-bold">min</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          layout
          initial={false}
          animate={{ height: isExpanded ? 'auto' : '110px' }}
          transition={{ type: 'spring', damping: 25, stiffness: 180, mass: 0.6 }}
          className="bg-surface/90 backdrop-blur-md rounded-t-[2.5rem] shadow-[0_-12px_48px_rgba(0,0,0,0.6)] border-t border-outline overflow-hidden will-change-[height,transform]"
        >
          <div
            onClick={onToggleExpand}
            className="flex flex-col items-center pt-3 pb-4 cursor-pointer active:bg-on-surface/5 transition-colors"
          >
            <div className="w-10 h-1 bg-on-surface/10 rounded-full mb-1"></div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/40">
              {isExpanded ? 'Tarik kebawah' : 'Ketuk untuk detail'}
            </p>
          </div>

          <div className="px-6 pb-8">
            <DriverInfoCard
              driverProfile={driverProfile}
              order={order}
              onContactDriver={onContactDriver}
            />

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  layout
                  initial={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                  exit={{ opacity: 0, filter: 'blur(10px)', y: 20 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="space-y-4"
                >
                  <div className="bg-surface-container p-4 rounded-2xl border border-outline space-y-3 shadow-inner text-on-surface">
                    <div className="flex justify-between items-center border-b border-outline pb-3">
                      <div>
                        <p className="text-[8px] uppercase font-bold tracking-widest text-primary/60">
                          Layanan {order.serviceType?.toUpperCase()}
                        </p>
                        <p className="font-bold text-xs text-on-surface mt-0.5">
                          {order.status === 'accepted'
                            ? 'Driver Menuju Lokasi'
                            : order.status === 'searching'
                              ? 'Mohon tunggu sebentar...'
                              : 'Pesanan Telah Selesai'}
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 border border-primary/30">
                        <span className="material-symbols-outlined text-primary text-sm">
                          {order.serviceType === 'food'
                            ? 'restaurant'
                            : order.serviceType === 'ride'
                              ? 'directions_bike'
                              : 'package_2'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-start pt-1">
                      <div>
                        <p className="text-[8px] uppercase font-bold tracking-widest text-primary/60">
                          Total Pembayaran
                        </p>
                        <div className="flex flex-col items-start gap-1">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-headline font-black text-on-surface italic">
                              Rp {order.total?.toLocaleString()}
                            </span>
                          </div>
                          {order.actualShoppingCost !== undefined && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30">
                              Sesuai Struk Belanja
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] uppercase font-bold text-primary tracking-widest mb-0.5">
                          Metode
                        </p>
                        <p className="text-[10px] font-bold text-on-surface uppercase">
                          {order.paymentMethod}
                        </p>
                      </div>
                    </div>

                    {order.pickupFee > 0 && (
                      <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-yellow-500 uppercase tracking-widest">
                          <span>Jarak Jemput Driver</span>
                          <span>
                            {order.pickupDistance ? `${order.pickupDistance.toFixed(1)} KM` : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-yellow-500 uppercase tracking-widest">
                          <span>Biaya Penjemputan</span>
                          <span>+Rp {order.pickupFee.toLocaleString()}</span>
                        </div>
                        <p className="text-[8px] text-yellow-500/70 font-medium leading-normal italic mt-1">
                          *Biaya ini otomatis ditambahkan untuk kompensasi driver menjemput dari
                          jarak jauh (&gt;3km).
                        </p>
                      </div>
                    )}

                    {!order.customer?.isGuest &&
                    ['searching', 'accepted', 'picked_up', 'on_route'].includes(order.status) ? (
                      <div className="mt-3 pt-3 border-t border-outline">
                        <p className="text-[8px] uppercase font-bold text-primary tracking-widest mb-2">
                          Pilih Metode Pembayaran
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'TUNAI', label: 'Tunai', icon: 'payments' },
                            { id: 'TRANSFER', label: 'Transfer', icon: 'account_balance' },
                            { id: 'QRIS', label: 'QRIS', icon: 'qr_code_2' },
                          ].map((method) => (
                            <button
                              key={method.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onPaymentMethodChange?.(method.id);
                              }}
                              className={`flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl border transition-all ${
                                order.paymentMethod === method.id
                                  ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgb(var(--primary)/0.1)]'
                                  : 'bg-on-surface/5 border-transparent hover:border-outline'
                              }`}
                            >
                              <span
                                className={`material-symbols-outlined text-[16px] ${order.paymentMethod === method.id ? 'text-primary' : 'text-on-surface-variant'}`}
                              >
                                {method.icon}
                              </span>
                              <span
                                className={`text-[8px] font-bold ${order.paymentMethod === method.id ? 'text-on-surface' : 'text-on-surface-variant'}`}
                              >
                                {method.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      order.customer?.isGuest && (
                        <div className="mt-3 pt-3 border-t border-outline flex items-center justify-between">
                          <p className="text-[8px] uppercase font-bold text-on-surface-variant tracking-widest">
                            Metode Pembayaran
                          </p>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
                            <span className="material-symbols-outlined text-[12px] text-primary">
                              payments
                            </span>
                            <span className="text-[8px] font-bold text-on-surface uppercase">
                              Tunai (Guest)
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {(order.paymentMethod === 'TRANSFER' || order.paymentMethod === 'QRIS') &&
                    ['accepted', 'picked_up', 'on_route'].includes(order.status) && (
                      <div className="mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePaymentDetails?.();
                          }}
                          className="w-full flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-sm">
                              {order.paymentMethod === 'QRIS' ? 'qr_code_2' : 'account_balance'}
                            </span>
                            <span className="text-xs font-bold text-on-surface">
                              Lihat Detail Pembayaran
                            </span>
                          </div>
                          <span
                            className={`material-symbols-outlined text-primary text-sm transition-transform ${showPaymentDetails ? 'rotate-180' : ''}`}
                          >
                            expand_more
                          </span>
                        </button>

                        {showPaymentDetails && (
                          <div className="mt-2 bg-surface-container-highest p-4 rounded-xl border border-outline space-y-3 shadow-xl max-h-[200px] overflow-y-auto">
                            {order.paymentMethod === 'TRANSFER' ? (
                              <div className="space-y-3">
                                {driverProfile?.bankAccounts &&
                                driverProfile.bankAccounts.length > 0 ? (
                                  driverProfile.bankAccounts.map((acc, idx) => (
                                    <div
                                      key={acc.id || idx}
                                      className="bg-on-surface/5 border border-outline p-3 rounded-xl space-y-1"
                                    >
                                      <div className="flex justify-between items-start">
                                        <span className="text-[8px] font-black text-primary uppercase tracking-widest">
                                          {acc.bankName}
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(acc.accountNumber);
                                            alert('Salin Rekening Berhasil!');
                                          }}
                                          className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary"
                                        >
                                          <span className="material-symbols-outlined text-[10px]">
                                            content_copy
                                          </span>
                                        </button>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-sm font-headline font-black text-on-surface italic">
                                          {acc.accountNumber}
                                        </span>
                                        <span className="text-[8px] font-bold text-on-surface-variant uppercase">
                                          A.N. {acc.accountHolder}
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-4 text-center bg-on-background/5 rounded-xl border border-dashed border-on-background/10">
                                    <p className="text-[10px] text-on-background/40 italic">
                                      Driver belum mengisi info rekening
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-3">
                                {driverProfile?.qrisUrl ? (
                                  <div className="flex flex-col items-center gap-4 w-full">
                                    <div className="bg-white p-3 rounded-2xl shadow-2xl">
                                      <img
                                        src={driverProfile.qrisUrl}
                                        alt="QRIS Driver"
                                        className="max-w-[180px] h-auto rounded-lg"
                                      />
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDownloadQRIS?.(driverProfile.qrisUrl);
                                      }}
                                      className="flex items-center gap-2 px-6 py-3 bg-primary text-black rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                                    >
                                      <span className="material-symbols-outlined text-sm">
                                        download
                                      </span>
                                      Simpan QRIS
                                    </button>
                                  </div>
                                ) : (
                                  <div className="p-4 bg-on-background/5 rounded-xl border border-dashed border-on-background/10 text-center w-full">
                                    <p className="text-[10px] text-on-background/40 italic">
                                      Driver belum mengunggah QRIS
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  {(order.status === 'searching' || order.status === 'accepted') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancel?.();
                      }}
                      className="w-full mt-2 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 hover:text-error transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-xs">cancel</span>
                      Batalkan Pesanan
                    </button>
                  )}

                  {children}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
