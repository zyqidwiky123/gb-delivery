import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@aro/shared/firebase';
import { getRoute } from '@aro/shared/mapProvider';
import { useUserStore } from '../store/userStore';

export function useOrderTracking(orderId) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  // FASE 2: rute OSM { coords: [{lat,lng}], distanceMeters, durationSeconds }
  // (pengganti DirectionsResult Google; fallback garis lurus jika OSRM gagal)
  const [route, setRoute] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showNoDriverModal, setShowNoDriverModal] = useState(false);

  const mapRef = useRef(null);
  const userInteracted = useRef(false);
  const pointsAdded = useRef(false);
  const lastRouteOrigin = useRef(null);
  const lastRouteDest = useRef(null);
  const lastPanPos = useRef(null);

  const { user, addPoints } = useUserStore();

  useEffect(() => {
    if (!orderId) {
      setError('Belum ada pesanan aktif yang dapat dilacak.');
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'orders', orderId),
      (docSnap) => {
        setLoading(false);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrder(data);
          if (data.status === 'completed') {
            setShowSuccessModal(true);
            if (user && !pointsAdded.current && data.earnedPoints > 0) {
              addPoints(data.earnedPoints);
              pointsAdded.current = true;
            }
          } else if (data.status === 'no_driver') {
            setShowNoDriverModal(true);
          } else if (data.status === 'cancelled' || data.status === 'canceled') {
            setError('Pesanan ini telah dibatalkan.');
          }
        } else {
          setError('Pesanan tidak ditemukan atau sudah kedaluwarsa.');
        }
      },
      (err) => {
        setLoading(false);
        setError('Gagal memuat data pesanan.');
        console.error('Error fetching order:', err);
      }
    );

    return () => unsubscribe();
  }, [orderId, user]);

  useEffect(() => {
    const driverId = order?.driverId || order?.driver?.id;
    if (!driverId) return;

    const unsubscribe = onSnapshot(doc(db, 'drivers', driverId), (docSnap) => {
      if (docSnap.exists()) {
        setDriverProfile(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, [order?.driverId, order?.driver?.id]);

  const toLatLng = (arr) => {
    if (!arr) return null;
    if (Array.isArray(arr)) return { lat: arr[0], lng: arr[1] };
    return arr;
  };

  const driverPos = order ? toLatLng(order.driverLocation) : null;
  const pickupPos = order ? toLatLng(order.pickup) : null;
  const dropoffPos = order ? toLatLng(order.dropoff) : null;

  useEffect(() => {
    if (!order || !driverPos) {
      setRoute(null);
      return;
    }

    let destination = null;
    if (order.status === 'accepted') {
      destination = pickupPos || dropoffPos;
    } else if (order.status === 'picked_up') {
      destination = dropoffPos;
    }

    const dist = (p1, p2) => {
      if (!p1 || !p2) return 999;
      return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2)) * 111320;
    };

    const shouldUpdate =
      !route ||
      dist(lastRouteOrigin.current, driverPos) > 40 ||
      dist(lastRouteDest.current, destination) > 5;

    if (driverPos && destination && shouldUpdate) {
      let cancelled = false;
      getRoute(driverPos, destination)
        .then((result) => {
          if (cancelled) return;
          setRoute(result);
          lastRouteOrigin.current = driverPos;
          lastRouteDest.current = destination;
        })
        .catch((err) => {
          console.error('Error fetching route:', err);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [order?.status, driverPos, pickupPos, dropoffPos]);

  useEffect(() => {
    if (!mapRef.current || !driverPos || userInteracted.current) return;

    const dist = (p1, p2) => {
      if (!p1 || !p2) return 999;
      return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2)) * 111320;
    };

    const d = dist(lastPanPos.current, driverPos);
    if (!lastPanPos.current || d > 15) {
      mapRef.current.panTo(driverPos);
      lastPanPos.current = driverPos;
    }
  }, [driverPos]);

  const handleContactDriver = useCallback(() => {
    const phone = driverProfile?.whatsapp || driverProfile?.phone || order?.driver?.phone || '';
    if (!phone) {
      alert('Nomor driver belum tersedia');
      return;
    }

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith('62')) {
      cleanPhone = '62' + cleanPhone;
    }

    const waMessage =
      order?.serviceType === 'food'
        ? 'Halo Bang Driver, saya customer ARO-FOOD. Pesanan saya sudah diproses?'
        : 'Halo Bang Driver, saya customer ARO-DRIVE. Posisi dimana ya?';
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`, '_blank');
  }, [driverProfile, order]);

  const handleDownloadQRIS = useCallback(
    async (url) => {
      if (!url) return;
      const fileName = `QRIS_${orderId}.png`;

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url + (url.includes('?') ? '&' : '?') + 'ts=' + Date.now();
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        return;
      } catch (e) {
        console.warn('Canvas download failed, trying fetch...', e);
      }

      try {
        const response = await fetch(url, { mode: 'cors' });
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error('All download methods failed:', err);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    [orderId]
  );

  return {
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
  };
}
