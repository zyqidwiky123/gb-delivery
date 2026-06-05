import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, query, where, updateDoc } from "firebase/firestore";
import axios from "axios";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDHfsq6wdr5_iQdKfDjIer2TVdQyQPLAJE",
  authDomain: "gb-delivery-41bf6.firebaseapp.com",
  projectId: "gb-delivery-41bf6",
  storageBucket: "gb-delivery-41bf6.firebasestorage.app",
  messagingSenderId: "512031290884",
  appId: "1:512031290884:web:e3c980592d19d134076751",
  measurementId: "G-M3Z1RM8GLK"
};

const MAPS_API_KEY = "AIzaSyAMdIaOkJQ8t_rokwEDkBWTJjjw9tmYzUk";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const keywords = [
  "Indomaret", 
  "Alfamart", 
  "Pasar", 
  "Pasar Tradisional", 
  "Supermarket", 
  "Minimarket", 
  "Toko Kelontong", 
  "Apotek"
];

const fetchAndSaveShops = async () => {
  try {
    console.log("🚀 Memulai proses migrasi dan penarikan data...");

    // 1. Migrasi data lama ke type: 'food'
    const merchantsRef = collection(db, "merchants");
    const snapshot = await getDocs(merchantsRef);
    let migratedCount = 0;
    
    for (const d of snapshot.docs) {
      if (!d.data().type) {
        await updateDoc(doc(db, "merchants", d.id), { type: 'food' });
        migratedCount++;
      }
    }
    console.log(`✅ Berhasil migrasi ${migratedCount} merchant lama ke type: 'food'`);

    // 2. Tarik data baru via Google Places
    for (const kw of keywords) {
      console.log(`🔍 Mencari: ${kw}...`);
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(kw + " Blitar")}&key=${MAPS_API_KEY}`;
      
      const response = await axios.get(url);
      const results = response.data.results || [];
      
      console.log(`Found ${results.length} results for ${kw}`);

      for (const place of results) {
        const shopId = place.place_id;
        const shopData = {
          name: place.name,
          address: place.formatted_address,
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          rating: place.rating || 0,
          image: place.photos?.[0] 
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${MAPS_API_KEY}`
            : null,
          type: 'shop',
          category: kw,
          place_id: shopId,
          updatedAt: new Date()
        };

        await setDoc(doc(db, "merchants", shopId), shopData, { merge: true });
      }
    }

    console.log("✨ Semua data berhasil diperbarui!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Terjadi kesalahan:", error.message);
    process.exit(1);
  }
};

fetchAndSaveShops();
