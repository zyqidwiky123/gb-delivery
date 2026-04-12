import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

export const useUserStore = create(
  persist(
    (set) => ({
      user: null, // null means unknown, object means logged in member
      isAdmin: false,
      isGuestMode: false, // true means explicitly chose Guest
      loyaltyPoints: 0, // Poin loyalitas khusus Member
      vouchers: [],
      savedAddresses: [], // [{ id, label, address, lat, lng, type }]
      lastOrderId: null, // Track last order especially for guests
      
      // Actions
      login: (userData) => set({ user: userData, isAdmin: userData.isAdmin || false, isGuestMode: false }),
      logout: () => set({ 
        user: null, 
        isAdmin: false, 
        isGuestMode: false, 
        loyaltyPoints: 0, 
        vouchers: [],
        savedAddresses: [] // Clear on logout
      }),
      setGuestMode: (status) => set((state) => ({ 
        isGuestMode: status, 
        user: null, 
        isAdmin: false,
        savedAddresses: status ? [] : state.savedAddresses // Clear if entering Guest Mode
      })),
      setAdminStatus: (status) => set({ isAdmin: status }),
      setLastOrderId: (id) => set({ lastOrderId: id }),
      addPoints: (amount) => set((state) => ({ loyaltyPoints: state.loyaltyPoints + amount })),
      redeemVoucher: (cost) => set((state) => ({ 
        loyaltyPoints: state.loyaltyPoints - cost,
        vouchers: [...state.vouchers, { id: Date.now(), type: 'FREE_DELIVERY', title: 'Gratis Ongkir' }]
      })),
      addSavedAddress: async (address) => {
        const id = Date.now();
        const newAddr = { id, ...address };
        set((state) => {
          const updated = [...state.savedAddresses, newAddr];
          // Sync to Firestore if user is logged in
          if (state.user?.id) {
            updateDoc(doc(db, "users", state.user.id), {
              savedAddresses: updated
            }).catch(e => console.error("Sync Error:", e));
          }
          return { savedAddresses: updated };
        });
      },
      removeSavedAddress: async (id) => {
        set((state) => {
          const updated = state.savedAddresses.filter(a => a.id !== id);
          // Sync to Firestore if user is logged in
          if (state.user?.id) {
            updateDoc(doc(db, "users", state.user.id), {
              savedAddresses: updated
            }).catch(e => console.error("Sync Error:", e));
          }
          return { savedAddresses: updated };
        });
      },
      updateUser: async (updates) => {
        set((state) => {
          if (!state.user) return state;
          const updatedUser = { ...state.user, ...updates };
          
          // Sync to Firestore
          updateDoc(doc(db, "users", state.user.id), updates)
            .catch(e => console.error("Firestore Update Error:", e));
            
          return { user: updatedUser };
        });
      },
    }),
    {
      name: 'aro-user-storage', // key di localStorage
      partialize: (state) => ({
        user: state.user,
        isAdmin: state.isAdmin,
        isGuestMode: state.isGuestMode,
        loyaltyPoints: state.loyaltyPoints,
        vouchers: state.vouchers,
        savedAddresses: state.savedAddresses,
        lastOrderId: state.lastOrderId,
      }),
    }
  )
);
