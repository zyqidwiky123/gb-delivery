import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// Copy from your src/firebase/config.js
const firebaseConfig = {
  apiKey: "AIzaSyDHfsq6wdr5_iQdKfDjIer2TVdQyQPLAJE",
  authDomain: "gb-delivery-41bf6.firebaseapp.com",
  projectId: "gb-delivery-41bf6",
  storageBucket: "gb-delivery-41bf6.firebasestorage.app",
  messagingSenderId: "512031290884",
  appId: "1:512031290884:web:e3c980592d19d134076751",
  measurementId: "G-M3Z1RM8GLK"
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
