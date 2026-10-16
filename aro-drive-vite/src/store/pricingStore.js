import { create } from 'zustand';
import { db } from '@aro/shared/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export const usePricingStore = create((set) => ({
  baseFare: 10000,
  ratePerKm: 2500,
  minDistance: 3.5,
  weightFareRate: 2000,
  serviceFeePercent: 0,

  initPricing: () => {
    const unsub = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const jek = data.jek || {};
        const send = data.send || {};
        set({
          baseFare: jek.baseFare || 10000,
          ratePerKm: jek.ratePerKm || 2500,
          minDistance: jek.minDistance || 3.5,
          weightFareRate: send.weightFareRate || 2000,
          serviceFeePercent: 0,
        });
      }
    });
    return unsub;
  },
}));
