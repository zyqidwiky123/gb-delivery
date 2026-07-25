import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const config = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, "merchants"));
  const snap = await getDocs(q);
  console.log("Merchants found:", snap.size);
  snap.forEach(doc => {
    const data = doc.data();
    if (data.name && data.name.toLowerCase().includes("pentol aro")) {
      console.log("Found Merchant:", doc.id, data.name, data.email);
    }
  });
  
  const q2 = query(collection(db, "orders"));
  const snap2 = await getDocs(q2);
  console.log("Orders found:", snap2.size);
  let orderCount = 0;
  snap2.forEach(doc => {
    const data = doc.data();
    if (data.merchantName && data.merchantName.toLowerCase().includes("pentol aro")) {
      orderCount++;
      console.log("Order:", doc.id, "merchantId:", data.merchantId, "status:", data.status);
    }
  });
  console.log("Total orders for pentol aro:", orderCount);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
