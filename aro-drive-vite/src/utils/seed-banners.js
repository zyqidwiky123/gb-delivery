import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

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

const banners = [
  {
    title: "Diskon 40% Resto Pilihan Blitar",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC314hAH0qtydOJ2PtWn_yYa6Y2tkN5XfUoYW2Dko5xtIQl4r6N9tuza6wvvILT_X2SsFKT17ANwjhrnlkH4CxSN_tQVaJcn3oS4ke2AUk0xFUkjMvs7mfR9X8vTrCCqdy8kQymagQLWemdfluxvMsYtVxe8jZM9IceRThIwlWoSPYpbybQQdEr1D0sZNdt6S48MBLVxKZeFRhLXrLrF2Fij45YLt4sIKYpf1qZ1NvptvtdQgnWZuEjzLMGGhcJIWgvfJFBi92-9Qw",
    link: "/food",
    active: true
  },
  {
    title: "Flash Sale Aro Jek Hanya Rp 5.000!",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCzrWf2UPEagcsj98VvlyXklKQifImY5urlI42UDBu8hxUZvKhrgEmjkU3t4Lv3ZHuyW0YZAGoADy-u2dV57y2bLmRTrDHwe1aKT8m42HtqZfMgox6xOplV_Zbnb3MVlfMcc8NjvGvU97Yt_6AEnpEWXCzQga7Wp4Ux7GIgL62uOW3D7CMdeJV9mYibBOFfV_zLsG2Zm1TXhXI5nRpyTEb07ZKMIgM7u8EH_aRm7XnbsFw-q3T9s0cqybtkVL9hXJeaNTdrj7khHu0",
    link: "/ride",
    active: true
  }
];

async function seed() {
  console.log("Seeding banners...");
  try {
    for (const banner of banners) {
      await addDoc(collection(db, "banners"), banner);
      console.log(`✅ Added: ${banner.title}`);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

seed();
