import { create } from 'zustand';
import { db } from '@aro/shared/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export const usePromoStore = create((set) => ({
  adminWhatsApp: '6285748343842',
  categories: [
    'All',
    'Makanan',
    'Minuman',
    'Camilan',
    'Nasi',
    'Mie',
    'Bakso',
    'Seblak',
    'Ayam',
    'Bebek',
    'Cafe',
    'Pecel',
    'Lesehan',
    'Pentol',
    'Lalapan',
  ],
  promoHeadline: '',
  bentoPromos: [],
  vouchers: [],
  defaultDeliveryTime: '20-30',
  platformFeePercent: 10,
  pointsPerTenk: 1000,
  pointsToRedeem: 5000,

  initPromo: () => {
    const unsub = onSnapshot(doc(db, 'settings', 'platform'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({
          platformFeePercent: data.platformFeePercent || 10,
          pointsPerTenk: data.pointsPerTenk || 1000,
          pointsToRedeem: data.pointsToRedeem || 5000,
          adminWhatsApp: data.whatsapp || '6285748343842',
          categories: data.foodCategories || [
            'All',
            'Makanan',
            'Minuman',
            'Camilan',
            'Nasi',
            'Mie',
            'Bakso',
            'Seblak',
            'Ayam',
            'Bebek',
            'Cafe',
            'Pecel',
            'Lesehan',
            'Pentol',
            'Lalapan',
          ],
          promoHeadline: data.promoHeadline || '',
          bentoPromos: data.bentoPromos || [],
          vouchers: data.vouchers || [],
          defaultDeliveryTime: data.defaultDeliveryTime || '20-30',
        });
      }
    });
    return unsub;
  },
}));
