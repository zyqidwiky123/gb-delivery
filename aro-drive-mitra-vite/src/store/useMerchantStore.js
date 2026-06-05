import { create } from 'zustand';
import { db, auth, storage } from '../firebase/config';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const useMerchantStore = create((set, get) => ({
  user: null,
  merchant: null,
  isLoading: true,
  unsubscribe: null,

  setUser: (user) => set({ user }),

  // Real-time listener for merchant data
  fetchMerchant: (uid) => {
    const prev = get().unsubscribe;
    if (prev) prev();

    set({ isLoading: true });
    const docRef = doc(db, "merchants", uid);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        set({ merchant: { id: docSnap.id, ...docSnap.data() }, isLoading: false });
      } else {
        set({ merchant: null, isLoading: false });
      }
    }, (error) => {
      console.error("Error listening to merchant:", error);
      set({ isLoading: false });
    });

    set({ unsubscribe: unsub });
  },

  updateMerchant: async (updates) => {
    const user = get().user;
    if (!user) return;

    try {
      const docRef = doc(db, "merchants", user.uid);
      await updateDoc(docRef, updates);
      // onSnapshot will auto-update the local state
    } catch (err) {
      console.error("Update failed:", err);
      throw err;
    }
  },

  // Upload image to Firebase Storage and return download URL
  uploadImage: async (file, path) => {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  },

  setLoading: (isLoading) => set({ isLoading }),

  logout: () => {
    const unsub = get().unsubscribe;
    if (unsub) unsub();
    auth.signOut();
    set({ user: null, merchant: null, unsubscribe: null });
  }
}));
