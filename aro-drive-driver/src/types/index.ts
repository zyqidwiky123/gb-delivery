// src/types/index.ts

export interface DriverProfile {
  // add fields as per your Firestore driver document structure
  // example fields
  name?: string;
  phone?: string;
  whatsapp?: string;
  photoUrl?: string;
  isOnline?: boolean;
  rating?: number;
  level?: string;
  vehicleType?: string;
  plateNumber?: string;
  qrisUrl?: string;
  balance?: number;
  bankAccounts?: Array<{
    id: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  }>;
  location?: { latitude: number; longitude: number };
}

export interface DriverStoreState {
  user: any | null; // Firebase Auth user (you can replace with firebase.User type later)
  profile: DriverProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  // driver location persisted in store
  driverLocation: { latitude: number; longitude: number };
  // other flags can be added as needed
  setUser: (user: any | null) => void;
  setProfile: (profile: DriverProfile | null) => void;
  updateProfile: (profilePatch: Partial<DriverProfile>) => void;
  setDriverLocation: (loc: { latitude: number; longitude: number }) => void;
  clearData: () => void;
  setAuthLoading: (loading: boolean) => void;
  setProfileLoading: (loading: boolean) => void;
}

// Added ActiveJob interface for current job details used in map components
export interface ActiveJob {
  id: string; // Firestore order document ID
  // additional fields can be added as needed, e.g., pickup, dropoff, status
}
