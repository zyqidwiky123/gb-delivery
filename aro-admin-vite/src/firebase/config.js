import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
