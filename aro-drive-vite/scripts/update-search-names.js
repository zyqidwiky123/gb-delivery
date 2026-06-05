import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_GOOGLE_MAPS_API_KEY,
  authDomain: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${process.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: "542387115867",
  appId: "1:542387115867:web:86b460d3d63b27b9c6f50b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateSearchNames() {
  console.log("Starting migration: Adding searchName field to all merchants...");
  
  try {
    const querySnapshot = await getDocs(collection(db, "merchants"));
    let count = 0;
    let batch = writeBatch(db);
    let batchSize = 0;

    for (const document of querySnapshot.docs) {
      const data = document.data();
      const name = data.name || "";
      const searchName = name.toLowerCase();

      // Only update if searchName is missing or incorrect
      if (data.searchName !== searchName) {
        batch.update(doc(db, "merchants", document.id), { searchName });
        count++;
        batchSize++;
      }

      // Firestore batch limit is 500
      if (batchSize === 500) {
        await batch.commit();
        console.log(`Committed ${count} updates...`);
        batch = writeBatch(db);
        batchSize = 0;
      }
    }

    if (batchSize > 0) {
      await batch.commit();
    }

    console.log(`Migration completed successfully! Total merchants updated: ${count}`);
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrateSearchNames();
