import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BLITAR_CENTER } from '@aro/shared/mapConfig';
import { useUserStore } from '../store/userStore';
import { useAdminStore } from '../store/adminStore';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useOrderTracking } from '../hooks/useOrderTracking';
import OrderMap from '../components/tracking/OrderMap';
import OrderStatusCard from '../components/tracking/OrderStatusCard';
import CancelOrderModal from '../components/tracking/CancelOrderModal';
import RatingModal from '../components/tracking/RatingModal';
import SearchingOverlay from '../components/tracking/SearchingOverlay';
import NoDriverModal from '../components/tracking/NoDriverModal';
import { cancelOrder, rateOrder, updateOrderPaymentMethod } from '../firebase/orderService';

function Tracking() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const orderId = params.get('id');
  const { user, lastOrderId } = useUserStore();
  const { adminWhatsApp } = useAdminStore();
  const { currentLocation } = useCurrentLocation();
  const activeOrderId = orderId || lastOrderId;

  const {
    order,
    loading,
    error,
    driverProfile,
    route,
    driverPos,
    pickupPos,
    dropoffPos,
    showSuccessModal,
    setShowSuccessModal,
    showNoDriverModal,
    setShowNoDriverModal,
    mapRef,
    userInteracted,
    handleContactDriver,
    handleDownloadQRIS,
  } = useOrderTracking(activeOrderId);

  const [isExpanded, setIsExpanded] = useState(false);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const mapCenter = driverPos || pickupPos || BLITAR_CENTER;

  const handleCancelOrder = useCallback(async () => {
    if (!cancelReason) {
      alert('Silakan pilih alasan pembatalan');
      return;
    }
    setIsCancelling(true);
    try {
      await cancelOrder(activeOrderId, cancelReason, 'user');
      navigate('/');
    } catch {
      alert('Gagal membatalkan pesanan');
    } finally {
      setIsCancelling(false);
      setShowCancelModal(false);
    }
  }, [cancelReason, activeOrderId, navigate]);

  const handleSubmitRating = useCallback(async () => {
    if (rating === 0) {
      alert('Silakan pilih rating bintang terlebih dahulu.');
      return;
    }
    setIsSubmittingRating(true);
    try {
      await rateOrder(activeOrderId, rating, review);
      setRatingSubmitted(true);
      setTimeout(() => navigate('/'), 2000);
    } catch {
      alert('Gagal mengirim ulasan.');
    } finally {
      setIsSubmittingRating(false);
    }
  }, [rating, review, activeOrderId, navigate]);

  if (loading)
    return (
      <div className="bg-background min-h-screen flex items-center justify-center text-primary font-black italic">
        Memuat data pesanan...
      </div>
    );

  if (error)
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center text-on-surface p-6">
        <span className="material-symbols-outlined text-6xl text-error mb-4">error_outline</span>
        <p className="text-lg font-bold mb-4">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="bg-primary text-black font-bold px-6 py-3 rounded-full"
        >
          Kembali ke Home
        </button>
      </div>
    );

  if (!order) return null;

  return (
    <div
      data-theme="dark"
      className="bg-background min-h-screen text-on-background font-body flex flex-col overflow-hidden relative"
    >
      {order.status === 'searching' && (
        <SearchingOverlay order={order} onCancel={() => setShowCancelModal(true)} />
      )}

      <button
        onClick={() => navigate('/')}
        className="fixed top-6 left-6 z-[1000] w-12 h-12 rounded-2xl bg-surface/80 backdrop-blur-md flex items-center justify-center text-primary shadow-2xl border border-outline active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined">home</span>
      </button>

      <div
        className={`fixed top-6 right-6 z-[1000] backdrop-blur-md px-4 py-3 rounded-2xl border flex items-center gap-3 shadow-2xl ${
          order.status === 'no_driver'
            ? 'bg-red-500/20 border-red-500/40'
            : 'bg-surface/80 border-outline'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full animate-pulse ${
            order.status === 'no_driver'
              ? 'bg-red-400'
              : order.status === 'searching'
                ? 'bg-primary'
                : 'bg-green-400'
          }`}
        />
        <span className="text-[10px] font-black tracking-widest uppercase text-on-surface">
          {order.status === 'accepted'
            ? 'Driver Menuju Lokasi'
            : order.status === 'picked_up'
              ? 'Driver Menuju Tujuan'
              : order.status === 'searching'
                ? 'Mencari Driver...'
                : order.status === 'no_driver'
                  ? 'Driver Tidak Tersedia'
                  : 'Selesai'}
        </span>
      </div>

      <main className="absolute inset-0 z-0 h-full w-full">
        <OrderMap
          driverPos={driverPos}
          pickupPos={pickupPos}
          dropoffPos={dropoffPos}
          route={route}
          mapRef={mapRef}
          userInteracted={userInteracted}
          currentLocation={currentLocation}
          orderStatus={order?.status}
        />
      </main>

      <OrderStatusCard
        order={order}
        driverProfile={driverProfile}
        route={route}
        driverPos={driverPos}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        onContactDriver={handleContactDriver}
        showPaymentDetails={showPaymentDetails}
        onTogglePaymentDetails={() => setShowPaymentDetails(!showPaymentDetails)}
        onCancel={() => setShowCancelModal(true)}
        onPaymentMethodChange={(method) => updateOrderPaymentMethod(activeOrderId, method)}
        onDownloadQRIS={handleDownloadQRIS}
      >
        {(order.status === 'searching' || order.status === 'accepted') && (
          <button
            onClick={() => setShowCancelModal(true)}
            className="w-full mt-2 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 hover:text-error transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-xs">cancel</span>
            Batalkan Pesanan
          </button>
        )}
      </OrderStatusCard>

      <RatingModal
        show={showSuccessModal}
        order={order}
        rating={rating}
        onRatingChange={setRating}
        review={review}
        onReviewChange={setReview}
        onSubmit={handleSubmitRating}
        isSubmitting={isSubmittingRating}
        ratingSubmitted={ratingSubmitted}
        onSkip={() => navigate('/')}
      />

      <NoDriverModal
        show={showNoDriverModal}
        onClose={() => setShowNoDriverModal(false)}
        onRetry={() => navigate('/')}
        adminWhatsApp={adminWhatsApp}
      />

      <CancelOrderModal
        show={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setCancelReason('');
        }}
        onConfirm={handleCancelOrder}
        selectedReason={cancelReason}
        onReasonChange={setCancelReason}
        isCancelling={isCancelling}
      />
    </div>
  );
}

export default Tracking;
