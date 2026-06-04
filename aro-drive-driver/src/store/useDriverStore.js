import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useDriverStore = create(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      driverLocation: { latitude: 0, longitude: 0 },
      authLoading: true,
      profileLoading: true,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      updateProfile: (profilePatch) => {
        const currentProfile = get().profile || {};
        set({ profile: { ...currentProfile, ...profilePatch } });
      },
      setDriverLocation: (loc) => set({ driverLocation: loc }),
      setAuthLoading: (loading) => set({ authLoading: loading }),
      setProfileLoading: (loading) => set({ profileLoading: loading }),
      clearData: () =>
        set({
          user: null,
          profile: null,
          driverLocation: { latitude: 0, longitude: 0 },
          authLoading: false,
          profileLoading: false,
        }),
    }),
    {
      name: 'driver-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profile: state.profile,
        driverLocation: state.driverLocation,
        // Exclude user (Firebase auth object) and loading states
      }),
    }
  )
);
