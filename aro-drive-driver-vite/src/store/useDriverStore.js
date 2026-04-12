import { create } from 'zustand';
import { db } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

export const useDriverStore = create((set) => ({
  user: null, // Firebase Auth user object
  profile: null, // Firestore driver document
  isLoading: true, // App initialization loading state
  
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  updateProfile: async (updatedFields) => {
    set((state) => {
      if (!state.user) return state;
      
      // Async sync to Firestore
      updateDoc(doc(db, "drivers", state.user.uid), updatedFields)
        .catch(e => console.error("Driver Store Sync Error:", e));
        
      return { 
        profile: state.profile ? { ...state.profile, ...updatedFields } : null 
      };
    });
  },
  setLoading: (isLoading) => set({ isLoading }),
  clearData: () => set({ user: null, profile: null })
}));
