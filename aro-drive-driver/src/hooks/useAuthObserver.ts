// src/hooks/useAuthObserver.ts
import { useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { observeDriverProfile } from '../firebase/driverService';
import { useDriverStore } from '../store/useDriverStore';
import { DriverProfile } from '../types';

/**
 * Custom hook that watches Firebase auth state and driver profile.
 * It updates the Zustand store and provides two loading flags:
 *  - authLoading: true while auth state is being resolved.
 *  - profileLoading: true while driver profile subscription is being set up.
 */
export const useAuthObserver = () => {
  const setUser = useDriverStore(state => state.setUser);
  const setProfile = useDriverStore(state => state.setProfile);
  const clearData = useDriverStore(state => state.clearData);
  const setAuthLoading = useDriverStore(state => state.setAuthLoading);
  const setProfileLoading = useDriverStore(state => state.setProfileLoading);

  useEffect(() => {
    setAuthLoading(true);
    let profileUnsubscribe: (() => void) | null = null;
    const authUnsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      setAuthLoading(false);
      if (user) {
        setUser(user);
        setProfileLoading(true);
        if (profileUnsubscribe) profileUnsubscribe();
        profileUnsubscribe = observeDriverProfile(user.uid, (profile: DriverProfile | null) => {
          setProfile(profile);
          setProfileLoading(false);
        });
      } else {
        if (profileUnsubscribe) {
          profileUnsubscribe();
          profileUnsubscribe = null;
        }
        clearData();
        setProfileLoading(false);
      }
    });
    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, [clearData, setAuthLoading, setProfile, setProfileLoading, setUser]);
};
