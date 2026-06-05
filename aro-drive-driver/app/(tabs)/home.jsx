import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useDriverStore } from '../../src/store/useDriverStore';
import MapComponent from '../../src/components/MapComponent';
import { 
  listenForAvailableOrders, 
  listenForActiveJobs,
  acceptOrder,
  rejectOrder,
  pickupOrder,
  completeOrder
} from '../../src/firebase/orderService';
import { updateDriverStatus, updateDriverLocation } from '../../src/firebase/driverService';
import * as Location from 'expo-location';
import { Bike, MapPin, CheckCircle2, XCircle, AlertCircle } from 'lucide-react-native';
import { AudioPlayer } from 'expo-audio';
import {
  startBackgroundService,
  stopBackgroundService,
  requestBackgroundLocationPermission,
} from '../../src/services/backgroundService';

const formatRupiah = (value) => (Number(value) || 0).toLocaleString('id-ID');
const getShoppingTotal = (order) => Number(order?.actualShoppingCost || order?.subtotal || 0);
const getPureDeliveryFee = (order) => Math.max(0, (Number(order?.deliveryFee) || 0) - (Number(order?.appServiceFee) || 0));
const getBillTotal = (order) => (
  Number(order?.total) ||
  getShoppingTotal(order) + (Number(order?.deliveryFee) || 0) + (Number(order?.pickupFee) || 0)
);
const needsShoppingCostInput = (order) => ['food', 'shop'].includes(order?.serviceType);

export default function HomeScreen() {
  const user = useDriverStore((state) => state.user);
  const profile = useDriverStore((state) => state.profile);
  
  const [activeJobs, setActiveJobs] = useState([]);
  const [incomingOrders, setIncomingOrders] = useState([]);
  
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [costModal, setCostModal] = useState({ show: false, jobId: null, amount: '' });
  const lastKnownLocationRef = useRef(null);
  
  const prevOrderIdsRef = useRef([]);
  const audioPlayerRef = useRef(null);

  // Initialize AudioPlayer for incoming orders
  useEffect(() => {
    try {
      const player = new AudioPlayer(require('../../assets/sounds/notif_driver.mp3'));
      audioPlayerRef.current = player;
      console.log("[HomeScreen] AudioPlayer successfully initialized");
    } catch (err) {
      console.warn("[HomeScreen] Failed to initialize AudioPlayer:", err);
    }
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  // Request background location permission on app mount
  useEffect(() => {
    requestBackgroundLocationPermission();
  }, []);

  // 1. Subscribe to real-time Active Jobs and Available Orders when user is loaded
  useEffect(() => {
    if (!user?.uid) return;

    console.log("[HomeScreen] Setting up real-time Firestore order listeners for UID:", user.uid);

    // Subscribe to incoming offers
    const unsubscribeIncoming = listenForAvailableOrders(user.uid, (orders) => {
      console.log("[HomeScreen] Received incoming orders update:", orders.length);
      
      const newOrderIds = orders.map(o => o.id);
      const hasNewOrder = newOrderIds.some(id => !prevOrderIdsRef.current.includes(id));
      
      if (hasNewOrder && orders.length > 0) {
        console.log("[HomeScreen] New order detected via Firestore! Playing sound.");
        if (audioPlayerRef.current) {
          audioPlayerRef.current.play();
        }
      }
      
      prevOrderIdsRef.current = newOrderIds;
      setIncomingOrders(orders);
    });

    // Subscribe to active jobs
    const unsubscribeActive = listenForActiveJobs(user.uid, (jobs) => {
      console.log("[HomeScreen] Received active jobs update:", jobs.length);
      setActiveJobs(jobs);
    });

    return () => {
      unsubscribeIncoming();
      unsubscribeActive();
      console.log("[HomeScreen] Cleaned up real-time order listeners");
    };
  }, [user?.uid]);

  // 1.5 Real-time Location Tracking when ONLINE — send to Firestore drivers/{uid}
  useEffect(() => {
    if (!profile?.isOnline || !user?.uid) return;

    let locationSubscription;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[Location] Permission denied for foreground location');
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        (loc) => {
          const newLoc = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          };
          lastKnownLocationRef.current = newLoc;
          updateDriverLocation(user.uid, newLoc);
          console.log('[Location] Sent driver location to Firestore:', newLoc.lat.toFixed(4), newLoc.lng.toFixed(4));
        }
      );
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [profile?.isOnline, user?.uid]);

  // 1.6 Heartbeat — keep lastLocationUpdate fresh every 60s even when stationary
  useEffect(() => {
    if (!profile?.isOnline || !user?.uid) return;

    const heartbeatId = setInterval(() => {
      if (lastKnownLocationRef.current) {
        updateDriverLocation(user.uid, lastKnownLocationRef.current);
        console.log('[Heartbeat] Refreshed driver location timestamp');
      }
    }, 60000);

    return () => clearInterval(heartbeatId);
  }, [profile?.isOnline, user?.uid]);

  // Toggle online/offline status in Firebase + start/stop Foreground Service
  const toggleOnlineStatus = async () => {
    if (!user?.uid) return;
    const nextStatus = !profile?.isOnline;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await updateDriverStatus(user.uid, nextStatus);
      if (nextStatus) {
        // Driver ONLINE → start foreground service agar app tetap hidup di background
        await startBackgroundService(user.uid);
        console.log('[HomeScreen] Driver online — background service dimulai.');
      } else {
        // Driver OFFLINE → stop foreground service
        await stopBackgroundService();
        console.log('[HomeScreen] Driver offline — background service dihentikan.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal memperbarui status online.');
    } finally {
      setActionLoading(false);
    }
  };

  // Accept incoming offered order
  const handleAcceptOrder = async (orderId) => {
    if (!user?.uid || !profile) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await acceptOrder(orderId, user.uid, profile);
      Alert.alert("Berhasil", "Pesanan telah Anda ambil! Silakan menuju ke lokasi penjemputan.");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal mengambil pesanan.');
      Alert.alert("Gagal", err.message || 'Gagal mengambil pesanan.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject/skip incoming offered order
  const handleRejectOrder = async (orderId) => {
    if (!user?.uid) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await rejectOrder(orderId, user.uid);
      Alert.alert("Ditolak", "Pesanan ditolak dan dialihkan ke driver lain.");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menolak pesanan.');
    } finally {
      setActionLoading(false);
    }
  };

  // Pickup active order
  const handlePickupOrder = async (orderId, actualShoppingCost = null) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      const res = await pickupOrder(orderId, actualShoppingCost);
      if (res && res.status === 'intermediate') {
        Alert.alert("Pickup Berhasil", `Berhasil pickup pemberhentian ${res.done}/${res.total}. Silakan lanjutkan ke lokasi berikutnya.`);
      } else {
        Alert.alert("Pickup Selesai", "Seluruh pesanan sudah dipickup. Silakan antar ke alamat tujuan.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal melakukan pickup.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePickupPress = (order) => {
    if (needsShoppingCostInput(order)) {
      setCostModal({
        show: true,
        jobId: order.id,
        amount: getShoppingTotal(order) ? String(getShoppingTotal(order)) : '',
      });
      return;
    }

    const totalPickups = order.pickups?.length || 1;
    const nextPickup = (order.pickupsDone || 0) + 1;
    const message = totalPickups > 1
      ? `Konfirmasi sudah menjemput pesanan di titik ke-${nextPickup} dari ${totalPickups}?`
      : 'Konfirmasi sudah menjemput barang/kustomer?';

    Alert.alert('Konfirmasi Pickup', message, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, Pickup', onPress: () => handlePickupOrder(order.id) },
    ]);
  };

  const handleSubmitShoppingCost = () => {
    const amount = Number(costModal.amount);
    if (costModal.amount === '' || Number.isNaN(amount) || amount < 0) {
      Alert.alert('Nominal Tidak Valid', 'Mohon masukkan total belanja asli sesuai struk.');
      return;
    }

    const jobId = costModal.jobId;
    setCostModal({ show: false, jobId: null, amount: '' });
    handlePickupOrder(jobId, amount);
  };

  // Complete active order
  const handleCompleteOrder = async (order) => {
    setActionLoading(true);
    setErrorMsg('');
    try {
      const finalPrice = getBillTotal(order);
      await completeOrder(order.id, finalPrice);
      Alert.alert("Pekerjaan Selesai! 🎉", "Terima kasih, Bos! Saldo dompet Anda telah diperbarui sesuai tarif.");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menyelesaikan pesanan.');
    } finally {
      setActionLoading(false);
    }
  };

  const activeJob = activeJobs[0];

  return (
    <View className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="pt-14 pb-4 px-6 bg-zinc-900/80 border-b border-zinc-800 flex-row justify-between items-center z-10">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-lime-400 overflow-hidden items-center justify-center">
            {profile?.photoUrl ? (
              <Image source={{ uri: profile.photoUrl }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <Bike size={20} color="#a3e635" />
            )}
          </View>
          <View>
            <Text className="font-bold text-sm text-lime-100">Mitra Aktif</Text>
            <Text className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{profile?.name || "MEMUAT..."}</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          onPress={toggleOnlineStatus}
          disabled={actionLoading}
          className={`flex-row items-center px-3 py-1.5 rounded-full border ${profile?.isOnline ? 'bg-lime-400/10 border-lime-400/20' : 'bg-zinc-800 border-zinc-700'} ${actionLoading ? 'opacity-50' : ''}`}
        >
          {actionLoading ? (
            <ActivityIndicator size="small" color="#a3e635" className="mr-1" />
          ) : (
            <View className={`w-2 h-2 rounded-full mr-2 ${profile?.isOnline ? 'bg-lime-400' : 'bg-zinc-500'}`} />
          )}
          <Text className={`text-[11px] font-bold ${profile?.isOnline ? 'text-lime-400' : 'text-zinc-400'}`}>
            {profile?.isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-6" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Map Component */}
        <View className="mb-6">
           <MapComponent activeJob={activeJob} />
        </View>

        {errorMsg ? (
          <View className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl mb-6 flex-row items-center gap-2">
            <AlertCircle size={16} color="#ef4444" />
            <Text className="text-red-500 text-xs font-semibold flex-1">{errorMsg}</Text>
          </View>
        ) : null}

        {/* Active Jobs Section */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between px-2 mb-4">
            <Text className="font-extrabold text-xl text-white italic">Pekerjaan Aktif</Text>
            <View className="bg-lime-400/10 px-2 py-1 rounded">
              <Text className="text-lime-400 text-[10px] font-bold">{activeJobs.length} AKTIF</Text>
            </View>
          </View>
          
          {activeJob ? (
            <View className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
              <View className="flex-row justify-between items-center border-b border-zinc-800 pb-3 mb-4">
                <View>
                  <Text className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Tipe Layanan</Text>
                  <Text className="text-lime-400 font-extrabold text-lg uppercase italic">{activeJob.serviceType || 'jek'}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Status Pekerjaan</Text>
                  <View className={`px-2.5 py-0.5 rounded-full mt-1 ${activeJob.status === 'accepted' ? 'bg-sky-400/10' : 'bg-lime-400/10'}`}>
                    <Text className={`text-[10px] font-extrabold uppercase ${activeJob.status === 'accepted' ? 'text-sky-400' : 'text-lime-400'}`}>
                      {activeJob.status === 'accepted' ? 'Menuju Pickup' : 'Mengantar'}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="space-y-4 mb-5">
                <View className="flex-row gap-3">
                  <MapPin size={16} color="#38bdf8" className="mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-[10px] text-zinc-500 font-bold uppercase">Lokasi Penjemputan</Text>
                    <Text className="text-zinc-200 text-sm font-semibold mt-0.5">
                      {activeJob.pickupAddress || activeJob.pickupName || 'Koordinat Peta'}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <MapPin size={16} color="#ef4444" className="mt-0.5" />
                  <View className="flex-1">
                    <Text className="text-[10px] text-zinc-500 font-bold uppercase">Lokasi Pengantaran</Text>
                    <Text className="text-zinc-200 text-sm font-semibold mt-0.5">
                      {activeJob.dropoffAddress || activeJob.dropoffName || 'Koordinat Peta'}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 mb-5 flex-row justify-between items-center">
                <View>
                  <Text className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Ongkir Driver</Text>
                  <Text className="text-white font-extrabold text-xl">
                    Rp {formatRupiah(getPureDeliveryFee(activeJob))}
                  </Text>
                </View>
                {activeJob.customerPhone && (
                  <View className="items-end">
                    <Text className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Pelanggan</Text>
                    <Text className="text-zinc-300 font-bold text-xs">{activeJob.customerName || 'Pelanggan ARO'}</Text>
                  </View>
                )}
              </View>

              <View className="bg-lime-400/5 p-4 rounded-xl border border-lime-400/10 mb-5">
                <Text className="text-[9px] text-lime-400 font-black uppercase tracking-widest mb-3 border-b border-lime-400/20 pb-1 italic">Rincian Pembayaran</Text>
                <View className="gap-2">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-zinc-400 text-[11px]">Total Belanja</Text>
                    <Text className="text-white text-[11px] font-bold">Rp {formatRupiah(getShoppingTotal(activeJob))}</Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-zinc-400 text-[11px]">Ongkir (Murni)</Text>
                    <Text className="text-white text-[11px] font-bold">Rp {formatRupiah(getPureDeliveryFee(activeJob))}</Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="text-zinc-400 text-[11px]">Biaya Layanan</Text>
                    <Text className="text-white text-[11px] font-bold">Rp {formatRupiah(activeJob.appServiceFee)}</Text>
                  </View>
                  {Number(activeJob.pickupFee) > 0 && (
                    <View className="flex-row justify-between items-center">
                      <Text className="text-yellow-400 text-[11px] font-bold">Biaya Jemput</Text>
                      <Text className="text-yellow-400 text-[11px] font-bold">Rp {formatRupiah(activeJob.pickupFee)}</Text>
                    </View>
                  )}
                  <View className="pt-2 mt-1 border-t border-lime-400/20 flex-row justify-between items-center">
                    <Text className="text-[10px] font-black text-lime-400 uppercase tracking-widest">Total Tagihan</Text>
                    <Text className="text-lime-400 text-sm font-black italic">Rp {formatRupiah(getBillTotal(activeJob))}</Text>
                  </View>
                </View>
              </View>

              {activeJob.status === 'accepted' ? (
                <TouchableOpacity
                  onPress={() => handlePickupPress(activeJob)}
                  disabled={actionLoading}
                  className="w-full bg-sky-500 py-4 rounded-xl flex-row items-center justify-center gap-2 shadow-lg"
                >
                  {actionLoading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <CheckCircle2 size={18} color="white" />
                      <Text className="text-white font-black text-center text-sm uppercase tracking-wider">SAYA SUDAH SAMPAI / PICKUP</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => handleCompleteOrder(activeJob)}
                  disabled={actionLoading}
                  className="w-full bg-lime-400 py-4 rounded-xl flex-row items-center justify-center gap-2 shadow-lg"
                >
                  {actionLoading ? <ActivityIndicator color="#000" /> : (
                    <>
                      <CheckCircle2 size={18} color="black" />
                      <Text className="text-black font-black text-center text-sm uppercase tracking-wider">SELESAIKAN PENGANTARAN</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View className="bg-zinc-900 p-8 rounded-2xl border border-dashed border-zinc-800 items-center">
              <Text className="text-sm text-zinc-500 text-center font-medium">Belum ada pekerjaan aktif saat ini.</Text>
            </View>
          )}
        </View>

        {/* Incoming Orders Section */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between px-2 mb-4">
            <Text className="font-extrabold text-xl text-white italic">Tawaran Pesanan Masuk</Text>
            <View className="bg-lime-400/20 px-2 py-1 rounded">
              <Text className="text-lime-400 text-[10px] font-bold">{incomingOrders.length} DITAWARKAN</Text>
            </View>
          </View>
          
          {incomingOrders.length > 0 ? (
            <View className="space-y-4">
              {incomingOrders.map((order) => (
                <View key={order.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl relative overflow-hidden">
                  <View className="absolute top-0 right-0 bg-lime-400/10 px-3 py-1 rounded-bl-xl border-l border-b border-zinc-800">
                    <Text className="text-lime-400 text-[9px] font-black uppercase tracking-wider">{order.serviceType || 'jek'}</Text>
                  </View>

                  <Text className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider mb-3">Pesanan Baru Ditemukan!</Text>
                  
                  <View className="space-y-3 mb-5">
                    <View className="flex-row gap-2.5">
                      <View className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5" />
                      <View className="flex-1">
                        <Text className="text-[9px] text-zinc-500 font-bold uppercase">Jemput</Text>
                        <Text className="text-zinc-300 text-xs font-semibold leading-4">
                          {order.pickupAddress || order.pickupName || 'Titik Jemput'}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row gap-2.5">
                      <View className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                      <View className="flex-1">
                        <Text className="text-[9px] text-zinc-500 font-bold uppercase">Antar</Text>
                        <Text className="text-zinc-300 text-xs font-semibold leading-4">
                          {order.dropoffAddress || order.dropoffName || 'Titik Antar'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View className="flex-row justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800/60 mb-5">
                    <View>
                      <Text className="text-[8px] text-zinc-500 font-bold uppercase">Pendapatan Bersih</Text>
                      <Text className="text-lime-400 font-black text-lg">
                        Rp {formatRupiah(getPureDeliveryFee(order))}
                      </Text>
                    </View>
                    {order.distance && (
                      <View className="items-end">
                        <Text className="text-[8px] text-zinc-500 font-bold uppercase">Estimasi Jarak</Text>
                        <Text className="text-zinc-300 font-extrabold text-sm">{order.distance} km</Text>
                      </View>
                    )}
                  </View>

                  <View className="bg-black/20 p-3 rounded-xl border border-zinc-800/60 mb-5 gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-500 text-[10px]">Belanja</Text>
                      <Text className="text-zinc-300 text-[10px]">Rp {formatRupiah(getShoppingTotal(order))}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-500 text-[10px]">Ongkir (Driver)</Text>
                      <Text className="text-zinc-300 text-[10px]">Rp {formatRupiah(getPureDeliveryFee(order))}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-zinc-500 text-[10px]">Biaya Layanan</Text>
                      <Text className="text-zinc-300 text-[10px]">Rp {formatRupiah(order.appServiceFee)}</Text>
                    </View>
                  </View>

                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => handleRejectOrder(order.id)}
                      disabled={actionLoading}
                      className="flex-1 bg-zinc-800 border border-zinc-700 py-3.5 rounded-xl items-center justify-center flex-row gap-1.5"
                    >
                      <XCircle size={14} color="#a1a1aa" />
                      <Text className="text-zinc-400 font-extrabold text-xs uppercase tracking-wider">LEWATI</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleAcceptOrder(order.id)}
                      disabled={actionLoading}
                      className="flex-[2] bg-lime-400 py-3.5 rounded-xl items-center justify-center flex-row gap-1.5 shadow-lg"
                    >
                      <CheckCircle2 size={14} color="black" />
                      <Text className="text-black font-black text-xs uppercase tracking-wider">TERIMA SEKARANG</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-zinc-900 p-8 rounded-2xl border border-dashed border-zinc-800 items-center">
              <Text className="text-sm text-zinc-500 text-center font-medium">Belum ada tawaran pesanan masuk.{"\n"}Sambil menunggu, ngopi dulu!</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={costModal.show}
        onRequestClose={() => setCostModal({ show: false, jobId: null, amount: '' })}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/80 items-center justify-center px-4"
        >
          <View className="w-full bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-2xl">
            <Text className="text-white font-extrabold text-xl mb-2">Total Belanja Asli</Text>
            <Text className="text-zinc-400 text-sm leading-5 mb-6">
              Masukkan total harga belanjaan sesuai struk asli tanpa ongkir. Nominal ini akan mengupdate tagihan customer.
            </Text>

            <View className="relative mb-6">
              <Text className="absolute left-4 top-4 text-zinc-500 font-bold z-10">Rp</Text>
              <TextInput
                value={costModal.amount}
                onChangeText={(amount) => setCostModal((current) => ({ ...current, amount }))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#52525b"
                className="bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white font-extrabold text-lg"
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setCostModal({ show: false, jobId: null, amount: '' })}
                className="flex-1 py-3 rounded-xl border border-zinc-700 items-center"
              >
                <Text className="text-white font-bold text-sm">Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitShoppingCost}
                className="flex-1 py-3 rounded-xl bg-lime-400 items-center"
              >
                <Text className="text-black font-black text-sm uppercase tracking-widest">Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
