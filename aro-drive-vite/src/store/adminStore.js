import { create } from 'zustand';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useOrderStore } from './orderStore';

export const useAdminStore = create((set, get) => ({
  // Pricing Settings
  baseFare: 10000,
  ratePerKm: 2500,
  minDistance: 3.5,
  weightFareRate: 2000, // Tarif per kelipatan 2 KG (setelah 1 KG pertama)
  adminWhatsApp: "6285748343842",
  categories: ['All', 'Makanan', 'Minuman', 'Camilan', 'Nasi', 'Mie', 'Bakso', 'Seblak', 'Ayam', 'Bebek', 'Cafe', 'Pecel', 'Lesehan', 'Pentol', 'Lalapan'],
  promoHeadline: '',
  bentoPromos: [],
  vouchers: [],
  defaultDeliveryTime: '20-30',
  platformFeePercent: 10,
  pointsPerTenk: 1000,
  ui: {
    home: {
      joinMemberTitle: 'Join Member Sekarang!',
      registerBtn: 'Daftar Sekarang',
      rideLabel: 'ARO JEK',
      rideSub: 'Antar',
      foodLabel: 'ARO FOOD',
      foodSub: 'Lapar?',
      sendLabel: 'ARO SEND',
      sendSub: 'Kirim',
      shopLabel: 'ARO TIP',
      shopSub: 'Belanja',
      trendingLabel: 'Lagi Trending di Blitar',
      seeAll: 'Lihat Semua'
    },
    welcome: {
      title: 'ARO DRIVE',
      subtitle: 'Aplikasi layanan serba ada untuk kebutuhan sehari-hari Anda.',
      memberBtn: 'Masuk sbg Member',
      guestBtn: 'Lanjut sbg Guest',
      installBtn: 'Install Aplikasi ARO DRIVE',
      alreadyInstalled: 'Aplikasi Sudah Terpasang',
      or: 'ATAU'
    },
    aroFood: {
      detectingLoc: 'Mendeteksi lokasi...',
      chooseLoc: 'Pilih Lokasi Pengiriman',
      searchPlaceholder: 'Mau makan apa hari ini?',
      loadingMsg: 'Menghidangkan rekomendasi...',
      topRatedLabel: 'Top Rated🔥',
      exploreLabel: 'Eksplorasi Rasa',
      modalTitle: 'Kirim Ke Mana?',
      mapBtn: 'Pilih di Peta'
    },
    foodSearch: {
      placeholder: 'Contoh: Mie Gacoan, Nasi Goreng...',
      trendingLabel: 'Sedang Trending 🔥',
      noResultsTitle: 'Hmm, tidak ketemu',
      noResultsDesc: 'Kami tidak dapat menemukan "{query}". Coba gunakan kata kunci lain.',
      clearBtn: 'Hapus Pencarian'
    },
    merchantDetail: {
      manualOrderTitle: 'Tulis Pesanan Manual',
      fastOrder: 'Fast Order',
      placeholder: 'Tulis menu & jumlahnya...\nContoh:\n- Nasi Goreng Spesial 2\n- Es Teh Manis 2',
      addBtn: 'Tambahkan Ke Keranjang',
      disclaimer: 'Pesanan akan diproses oleh driver sesuai ketersediaan di outlet.',
      operatingHours: 'Jam Operasional',
      noHours: 'Data jadwal belum tersedia',
      adminTitle: 'Admin: Kelola Menu',
      photoList: 'Daftar Menu Foto',
      searchingMaps: 'Mencari Menu di Maps...',
      noPhoto: 'Foto Menu Belum Tersedia',
      scrollHint: 'Geser Horizontal untuk Lihat Menu ↔️',
      tipsTitle: 'Tips Memesan',
      tipsDesc: 'Sebutkan porsi, tingkat kepedasan, atau request khusus di kolom pesanan agar driver lebih mudah membelikan.'
    },
    aroRide: {
      title: 'ARO JEK',
      subtitle: 'Jemputan Cepat & Aman',
      pickupLabel: 'Titik Jemput',
      dropoffLabel: 'Titik Tujuan',
      pickupPlaceholder: 'Mau dijemput di mana?',
      dropoffPlaceholder: 'Mau ke mana hari ini?',
      carComingSoon: 'fitur belum tersedia, system akan terus mengupdate. terima kasih',
      confirmBtn: 'GAS JALAN!',
    },
    aroSend: {
      title: 'Kirim Paket',
      subtitle: 'Layanan Antar Barang Satset',
      senderTitle: 'Data Pengirim',
      receiverTitle: 'Data Penerima',
      itemPlaceholder: 'Contoh: Dokumen',
      confirmBtn: 'Pesan Sekarang',
    },
    aroShop: {
      title: 'ARO SHOP',
      subtitle: 'Belanja Apa Saja, Kami Antar',
      searchPlaceholder: 'Cari Toko atau Pasar...',
      addressPlaceholder: 'Contoh: Pasar Legi Blitar',
      itemPlaceholder: 'Contoh:\n- Susu Ultra 1L (2)\n- Telur 1kg',
      confirmBtn: 'GAS BELANJA!',
    },
    checkout: {
      title: 'Checkout',
      guestNamePlaceholder: 'Nama Lengkap',
      guestWaPlaceholder: 'No. WhatsApp (Aktif)',
      confirmBtn: 'GAS ORDER!',
      emptyCart: 'Keranjang Kosong',
    },
    header: {
      loginBtn: 'Login / Daftar'
    },
    nav: {
      beranda: 'Beranda',
      aktivitas: 'Aktivitas',
      pay: 'Pay',
      lacak: 'Lacak',
      akun: 'Akun'
    },
    common: {
      loadingPeta: 'Memuat peta...',
      errorLocation: 'Gagal mendapatkan lokasi. Pastikan GPS aktif.',
      errorIncomplete: 'Mohon lengkapi semua data dan titik di peta.',
    }
  },
  isLoading: false,
  
  // Dashboard Metrics
  totalRevenue: 2450000,
  totalOrders: 154,
  activeDrivers: 12,
  
  // Actions
  // Real-time synchronization
  initSettings: () => {
    const unsubPlatform = onSnapshot(doc(db, "settings", "platform"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({ 
          platformFeePercent: data.platformFeePercent || 10,
          pointsPerTenk: data.pointsPerTenk || 1000,
          pointsToRedeem: data.pointsToRedeem || 5000,
          adminWhatsApp: data.whatsapp || "6285748343842",
          categories: data.foodCategories || ['All', 'Makanan', 'Minuman', 'Camilan', 'Nasi', 'Mie', 'Bakso', 'Seblak', 'Ayam', 'Bebek', 'Cafe', 'Pecel', 'Lesehan', 'Pentol', 'Lalapan'],
          promoHeadline: data.promoHeadline || '',
          bentoPromos: data.bentoPromos || [],
          vouchers: data.vouchers || [],
          defaultDeliveryTime: data.defaultDeliveryTime || "20-30",
          ui: {
            ...get().ui,
            ...(data.ui || {})
          }
        });
      }
    });



    const unsubPricing = onSnapshot(doc(db, "settings", "pricing"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const jek = data.jek || {};
        const send = data.send || {};
        set({ 
          baseFare: jek.baseFare || 10000,
          ratePerKm: jek.ratePerKm || 2500,
          minDistance: jek.minDistance || 3.5,
          weightFareRate: send.weightFareRate || 2000,
          serviceFeePercent: 0 // Explicitly set to 0 as per previous user request
        });
      }
    });

    return () => {
      unsubPlatform();
      unsubPricing();
    };
  },

  updatePricing: async (base, rate, serviceFee, weightFare, minDistance = 3.5) => {
    set({ isLoading: true });
    try {
      await updateDoc(doc(db, "settings", "pricing"), {
        jek: {
          baseFare: base,
          ratePerKm: rate,
          minDistance
        },
        send: {
          weightFareRate: weightFare
        },
        tip: {
          weightFareRate: weightFare
        },
        updatedAt: new Date()
      });
      set({ baseFare: base, ratePerKm: rate, serviceFeePercent: serviceFee, weightFareRate: weightFare });
    } catch (error) {
      console.error("Error updating settings:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateStats: (stats) => set((state) => ({ ...state, ...stats })),
}));

