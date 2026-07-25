import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Set env vars before running: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, etc.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const seedData = async () => {
  try {
    console.log("Memulai seeding data sistem...");

    // 1. Setup Global Settings
    await setDoc(doc(db, "settings", "system"), {
      baseFare: 10000,
      ratePerKm: 2500,
      guestLimit: 100000,
      minDriverBalance: 5000,
      systemStatus: "online",
      updatedAt: new Date()
    });
    console.log("✅ Koleksi 'settings/system' berhasil diinisialisasi.");

    // 2. Info Penting: Admin harus ditambahkan manual di koleksi 'admins'
    // demi keamanan (karena firestore rules melarang write ke 'admins' via client).
    
    console.log("\n--- LANGKAH TERAKHIR ---");
    console.log("Silakan buka Firebase Console dan tambahkan UID Anda ke koleksi 'admins' secara manual.");
    console.log("Ini diperlukan agar Anda bisa mengakses Dashboard Admin.");

  } catch (error) {
    console.error("❌ Gagal melakukan seeding:", error);
  }
};

seedData();
