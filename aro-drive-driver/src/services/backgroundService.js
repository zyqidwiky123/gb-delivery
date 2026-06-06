/**
 * backgroundService.js
 *
 * Foreground Service untuk ARO DRIVE Driver.
 * Menjaga aplikasi tetap aktif di background sehingga:
 * 1. Lokasi driver terus dikirim ke Firestore → sistem dispatch bisa menemukan driver
 * 2. FCM push notification tetap dapat diterima oleh Google Play Services
 *
 * Menggunakan: react-native-background-actions + react-native-geolocation-service
 */

import BackgroundActions from 'react-native-background-actions';
import Geolocation from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid } from 'react-native';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

// ─── Konfigurasi notifikasi persistent Foreground Service ─────────────────────
const BACKGROUND_OPTIONS = {
  taskName: 'ARO Driver Service',
  taskTitle: 'ARO DRIVE Aktif',
  taskDesc: 'Lokasi Anda sedang dipantau untuk menerima pesanan.',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  foregroundServiceType: ['location'],
  color: '#a3e635',
  linkingURI: 'arodrivedriver://',
  parameters: {
    delay: 10000, // interval update lokasi (ms)
  },
};

// ─── Task yang berjalan di background ─────────────────────────────────────────
/**
 * @param {object} taskData - Parameter yang diterima dari BackgroundActions.start()
 * @param {string} taskData.driverId - UID driver yang sedang online
 */
const backgroundTask = async (taskData) => {
  const { driverId } = taskData;

  if (!driverId) {
    console.warn('[BackgroundService] driverId tidak ditemukan, service berhenti.');
    return;
  }

  console.log('[BackgroundService] ✅ Service dimulai untuk driver:', driverId);

  // Loop terus berjalan selama service aktif
  while (BackgroundActions.isRunning()) {
    try {
      const location = await getCurrentPosition();

      if (location) {
        const driverRef = doc(db, 'drivers', driverId);
        await updateDoc(driverRef, {
          location: {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          },
          lastLocationUpdate: serverTimestamp(),
        });
        console.log(
          `[BackgroundService] 📍 Lokasi dikirim: ${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`
        );
      }
    } catch (err) {
      console.warn('[BackgroundService] ⚠️ Gagal kirim lokasi:', err.message);
    }

    // Tunggu interval sebelum update berikutnya
    await sleep(taskData.delay ?? 10000);
  }
};

// ─── Helper: Dapatkan posisi GPS sekali ───────────────────────────────────────
const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        console.warn('[BackgroundService] GPS error:', error.code, error.message);
        resolve(null); // Jangan reject agar loop tidak berhenti
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 5000,
        forceRequestLocation: true,
      }
    );
  });

// ─── Helper: Sleep / delay ────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Helper: Request izin lokasi background (Android) ─────────────────────────
export const requestBackgroundLocationPermission = async () => {
  if (Platform.OS !== 'android') return true;

  try {
    // Request foreground dulu (wajib sebelum background)
    const fgStatus = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Izin Lokasi',
        message: 'ARO DRIVE membutuhkan akses lokasi untuk mengirim posisi Anda ke sistem.',
        buttonPositive: 'Izinkan',
        buttonNegative: 'Tolak',
      }
    );

    if (fgStatus !== PermissionsAndroid.RESULTS.GRANTED) {
      console.warn('[BackgroundService] Izin foreground location ditolak');
      return false;
    }

    // Request background location (Android 10+)
    const bgStatus = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: 'Izin Lokasi Background',
        message:
          'Agar ARO DRIVE bisa mengirim posisi Anda saat aplikasi diminimize, pilih "Izinkan Setiap Saat" pada layar izin berikutnya.',
        buttonPositive: 'Lanjutkan',
        buttonNegative: 'Batal',
      }
    );

    const granted = bgStatus === PermissionsAndroid.RESULTS.GRANTED;
    if (!granted) {
      console.warn('[BackgroundService] Izin background location ditolak. Service tetap berjalan dengan foreground-only.');
    }
    return true; // Tetap lanjutkan meski background ditolak
  } catch (err) {
    console.error('[BackgroundService] Error saat request permission:', err);
    return false;
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Mulai Foreground Service.
 * Panggil saat driver menekan tombol ONLINE.
 * @param {string} driverId - UID driver
 */
export const startBackgroundService = async (driverId) => {
  if (Platform.OS !== 'android') {
    console.log('[BackgroundService] Foreground Service hanya tersedia di Android.');
    return;
  }

  if (BackgroundActions.isRunning()) {
    console.log('[BackgroundService] Service sudah berjalan, skip.');
    return;
  }

  try {
    await BackgroundActions.start(backgroundTask, {
      ...BACKGROUND_OPTIONS,
      parameters: {
        ...BACKGROUND_OPTIONS.parameters,
        driverId,
      },
    });
    console.log('[BackgroundService] ✅ Foreground Service berhasil dimulai.');
  } catch (err) {
    console.error('[BackgroundService] ❌ Gagal memulai service:', err);
  }
};

/**
 * Hentikan Foreground Service.
 * Panggil saat driver menekan tombol OFFLINE.
 */
export const stopBackgroundService = async () => {
  if (Platform.OS !== 'android') return;

  try {
    await BackgroundActions.stop();
    console.log('[BackgroundService] 🛑 Foreground Service dihentikan.');
  } catch (err) {
    console.error('[BackgroundService] ❌ Gagal menghentikan service:', err);
  }
};

/**
 * Cek apakah Foreground Service sedang berjalan.
 */
export const isBackgroundServiceRunning = () => {
  if (Platform.OS !== 'android') return false;
  return BackgroundActions.isRunning();
};
