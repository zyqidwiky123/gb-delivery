import { db } from './config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const getDriverProfile = async (uid) => {
  try {
    const driverRef = doc(db, 'drivers', uid);
    const snap = await getDoc(driverRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null; // Profile doesn't exist yet
  } catch (err) {
    console.error("Error fetching driver profile:", err);
    return null;
  }
};

export const createDriverProfile = async (uid, email) => {
  try {
    const driverRef = doc(db, 'drivers', uid);
    // Real testing metadata as per user request
    const mockProfile = {
      name: "Marco",
      email: email,
      vehicleType: "Honda Scoopy 2025 cream (2026)",
      plateNumber: "AG 1234 ARO",
      rating: 4.9,
      level: "Mitra Utama",
      isOnline: true, // New field
      photoUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAr5XAajWHWnCVcEoi2VhomU2RRi1oJj14RBhltVEwmTbfEKW_i84dn2BDkUz9qAQj07nsW1VB0znDXOW5qiwlc18aHqhw7Gb53jOgqu22HqidGCHExwD202ID9AIWBaNt6MkzajfHVnmrUTACMJknmlViLwxT-oUuNyAm-gWNyh8y73S-6_JDv5sLo-ZwmgEHwjPyTeaqbJyqf_UDWD4h30dkfYwiVwaVX5dP2bncVn6yn1IfcqPjFpKBz4VY49nkar4KuReEa7jY"
    };

    await setDoc(driverRef, mockProfile);
    
    // Crucial: Set role in 'users' collection for security rules
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { 
      role: 'driver',
      displayName: mockProfile.name,
      email: mockProfile.email,
      isActive: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return mockProfile;
  } catch (err) {
    console.error("Error creating driver profile:", err);
    throw err;
  }
};

export const updateDriverStatus = async (uid, isOnline) => {
  try {
    const driverRef = doc(db, 'drivers', uid);
    await setDoc(driverRef, { isOnline }, { merge: true });
    return true;
  } catch (err) {
    console.error("Error updating online status:", err);
    return false;
  }
};
