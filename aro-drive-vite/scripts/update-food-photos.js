import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc, query, where } from "firebase/firestore";

// Script ini digunakan untuk mengupdate foto restoran/warung secara massal.
// Jalankan dengan: node --env-file=.env src/utils/update-food-photos.js

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- KONFIGURASI FOTO ---
// Masukkan nama restoran (harus persis sama dengan yang ada di Firestore) 
// dan URL foto yang ingin abang pasang.
const photoUpdates = [
  { 
    name: "Warung Mak Ti", 
    imageUrl: "https://lh5.googleusercontent.com/p/AF1QipMTv_S0G_X_v2G5yK2X9jY7jH1X6yJ5g6h7y8=w400-h300-k-no" 
  },
  { 
    name: "Soto Daging Bok Ireng", 
    imageUrl: "https://lh5.googleusercontent.com/p/AF1QipN9_S0G_X_v2G5yK2X9jY7jH1X6yJ5g6h7y8=w400-h300-k-no" 
  },
  // Tambah baris lagi sesuai kebutuhan abang...
];

async function updatePhotos() {
  console.log("Memulai proses update foto...");
  let count = 0;

  try {
    for (const update of photoUpdates) {
      // Cari dokumen berdasarkan nama
      const q = query(collection(db, "merchants"), where("name", "==", update.name));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn(`⚠️ Restoran "${update.name}" tidak ditemukan di database.`);
        continue;
      }

      // Update setiap dokumen yang cocok (biasanya cuma satu)
      for (const document of querySnapshot.docs) {
        const merchantRef = doc(db, "merchants", document.id);
        await updateDoc(merchantRef, {
          image: update.imageUrl
        });
        console.log(`✅ Berhasil update foto untuk: ${update.name}`);
        count++;
      }
    }

    console.log(`\nSelesai! Total ${count} restoran berhasil diupdate fotonya.`);
    process.exit(0);

  } catch (error) {
    console.error("❌ Terjadi kesalahan saat update:", error.message);
    process.exit(1);
  }
}

updatePhotos();
