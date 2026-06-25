import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { db, storage } from '../firebase/config';
import { 
  collection, getDocs, updateDoc, doc, deleteField, query, orderBy, getDoc, setDoc, serverTimestamp, deleteDoc, addDoc, arrayUnion, arrayRemove, onSnapshot 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';



const getDownloadURLWithRetry = async (storageRef, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await getDownloadURL(storageRef);
    } catch (error) {
      if (error.code === 'storage/object-not-found' && i < retries - 1) {
        console.warn(`[Storage] Object not found, retrying in ${delay}ms... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw error;
      }
    }
  }
};

function Dashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { 
    baseFare, setBaseFare, 
    ratePerKm, setRatePerKm, 
    platformFeePercent, setPlatformFee,
    pointsPerTenk, setPointsPerTenk,
    pointsToRedeem, setPointsToRedeem,
    adminUser, setAdminUser,
    pricing, setServicePricing, setAllPricing,
    activeDrivers, totalOrdersToday,
    banners, setBanners,
    drivers, setDrivers,
    transactions, setTransactions,
    topupRequests, setTopupRequests,
    users, setUsers,
    bentoPromos, setBentoPromos,
    vouchers, setVouchers
  } = useAdminStore();

  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [showMenuGalleryModal, setShowMenuGalleryModal] = useState(false);
  const [selectedMerchantMenu, setSelectedMerchantMenu] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: '',
    email: '',
    phone: '',
    plateNumber: '',
    vehicleType: 'jek',
    password: ''
  });
  const [editingDriver, setEditingDriver] = useState(null);
  const [showEditDriverModal, setShowEditDriverModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);

  const [showAddMerchantModal, setShowAddMerchantModal] = useState(false);
  const [isAddingMerchant, setIsAddingMerchant] = useState(false);
  const [newMerchant, setNewMerchant] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    category: 'makanan',
    type: 'food'
  });
  
  // Account Settings States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Banner Edits State
  const [bannerEdits, setBannerEdits] = useState({});

  // User Management State
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Banner Management State
  const [showAddBannerModal, setShowAddBannerModal] = useState(false);
  const [newBanner, setNewBanner] = useState({
    title: '',
    link: '',
    targetAudience: 'all',
    active: true,
    image: 'https://via.placeholder.com/800x450?text=Klik+Ganti+Gambar'
  });
  
  // Bento & Voucher States
  const [showAddBentoModal, setShowAddBentoModal] = useState(false);
  const [editingBento, setEditingBento] = useState(null);
  const [newBento, setNewBento] = useState({
    title: '',
    subtitle: '',
    icon: 'star',
    color: 'primary',
    link: ''
  });

  const [showAddVoucherModal, setShowAddVoucherModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [newVoucher, setNewVoucher] = useState({
    code: '',
    title: '',
    type: 'FREE_DELIVERY',
    value: 0,
    minOrder: 0,
    expiryDays: 30,
    active: true
  });

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAdminUser(user);
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    if (activeTab === 'Overview') {
      fetchOverviewData();
    }
    if (activeTab === 'Food') {
      fetchMerchants();
    }
    if (activeTab === 'Drivers') {
      fetchDrivers();
    }
    if (activeTab === 'Transactions') {
      fetchTransactions();
    }
    if (activeTab === 'Banners') {
      fetchBanners();
    }
    if (activeTab === 'Topups') {
      fetchTopupRequests();
    }
    if (activeTab === 'Users') {
      fetchUsers();
    }
    if (activeTab === 'Tarif' || activeTab === 'Settings' || activeTab === 'Promos') {
      const unsubPricing = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
        if (docSnap.exists()) setAllPricing(docSnap.data());
      });
      const unsubPlatform = onSnapshot(doc(db, 'settings', 'platform'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPointsPerTenk(data.pointsPerTenk || 1);
          setPointsToRedeem(data.pointsToRedeem || 50);
          setBentoPromos(data.bentoPromos || []);
          setVouchers(data.vouchers || []);
        }
      });
      return () => { unsubPricing(); unsubPlatform(); };
    }
  }, [activeTab]);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      // Real-time calculation of revenue (from completed orders today)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const filteredToday = orders.filter(o => o.createdAt?.toDate() >= startOfToday);
      
      const todayTotal = filteredToday
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.serviceFee || 0), 0);
      
      const activeDriversCount = (await getDocs(query(collection(db, "drivers"), orderBy("isOnline", "desc"))))
        .docs.filter(d => d.data().isOnline).length;

      useAdminStore.getState().updateMetrics(activeDriversCount, filteredToday.length);
      // We'll use local state for revenue display
      setMetrics({ revenue: todayTotal, drivers: activeDriversCount, orders: filteredToday.length });
    } catch (error) {
      console.error("Error fetching overview:", error);
    } finally {
      setLoading(false);
    }
  };

  const [metrics, setMetrics] = useState({ revenue: 0, drivers: 0, orders: 0 });

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "drivers"), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDrivers(list);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(list);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "banners"));
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Fetch Pricing
      const pricingDoc = await getDoc(doc(db, "settings", "pricing"));
      if (pricingDoc.exists()) {
        setAllPricing(pricingDoc.data());
      }
      
      // Fetch Platform Settings
      const platformDoc = await getDoc(doc(db, "settings", "platform"));
      if (platformDoc.exists()) {
        const data = platformDoc.data();
        setPlatformFee(data.platformFeePercent);
        setPointsPerTenk(data.pointsPerTenk);
        setPointsToRedeem(data.pointsToRedeem);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopupRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "topup_requests"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTopupRequests(list);
    } catch (error) {
      console.error("Error fetching topups:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), orderBy("loyaltyPoints", "desc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(list);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveTopup = async (request) => {
    if (!window.confirm(`Setujui Top-up Rp ${request.amount.toLocaleString()} untuk ${request.driverName}?`)) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "topup_requests", request.id), {
        status: 'approved',
        updatedAt: serverTimestamp()
      });

      const driverRef = doc(db, "drivers", request.driverId);
      const driverDoc = await getDoc(driverRef);
      const currentBalance = driverDoc.exists() ? (driverDoc.data().balance || 0) : 0;
      
      await updateDoc(driverRef, {
        balance: Number(currentBalance) + Number(request.amount)
      });

      alert("Top-up Berhasil Disetujui!");
      fetchTopupRequests();
    } catch (error) {
      console.error("Error approving topup:", error);
      alert("Gagal menyetujui top-up.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectTopup = async (reqId) => {
    if (!window.confirm("Tolak permintaan top-up ini?")) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "topup_requests", reqId), {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });
      fetchTopupRequests();
    } catch (error) {
      console.error("Error rejecting topup:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserPoints = async (userId, newPoints) => {
    setIsSavingUser(true);
    try {
      await updateDoc(doc(db, "users", userId), {
        loyaltyPoints: Number(newPoints)
      });
      alert("Poin Berhasil Diperbarui!");
      fetchUsers();
    } catch (error) {
      console.error("Error updating points:", error);
      alert("Gagal memperbarui poin.");
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleAddVoucherToUser = async (userId, template) => {
    setIsSavingUser(true);
    try {
      const userRef = doc(db, "users", userId);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) throw new Error("User not found");
      
      const currentVouchers = userDoc.data().vouchers || [];
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (template.expiryDays || 30));

      const voucherToGrant = {
        id: Date.now().toString(),
        templateId: template.id || null,
        code: template.code || '',
        type: template.type || 'FREE_DELIVERY',
        title: template.title || 'Voucher Spesial Admin',
        value: template.value || 0,
        minOrder: template.minOrder || 0,
        expiryDate: expiryDate.toISOString(),
        createdAt: new Date().toISOString(),
        used: false
      };
      
      await updateDoc(userRef, {
        vouchers: [...currentVouchers, voucherToGrant]
      });
      
      alert(`Voucher "${voucherToGrant.title}" Berhasil Diberikan!`);
      fetchUsers();
    } catch (error) {
      console.error("Error adding voucher:", error);
      alert("Gagal memberikan voucher.");
    } finally {
      setIsSavingUser(false);
    }
  };

  const convertToWebP = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const webpFile = new File([blob], `${file.name.split('.')[0]}.webp`, {
                  type: 'image/webp',
                  lastModified: Date.now(),
                });
                resolve(webpFile);
              } else {
                reject(new Error('Gagal mengonversi ke WebP'));
              }
            },
            'image/webp',
            0.85
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleBannerUpload = async (bannerId, file) => {
    if (!file) return;
    setUploadingId(bannerId);
    try {
      const webpFile = await convertToWebP(file);
      const storageRef = ref(storage, `banners/${bannerId}.webp`);
      await uploadBytes(storageRef, webpFile);
      const downloadURL = await getDownloadURLWithRetry(storageRef);

      const bannerRef = doc(db, "banners", bannerId);
      await updateDoc(bannerRef, { imageUrl: downloadURL });
      fetchBanners();
    } catch (error) {
      console.error("Error uploading banner:", error);
      alert("Gagal mengunggah banner: " + error.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleUpdateBannerMetadata = async (bannerId) => {
    const edit = bannerEdits[bannerId];
    if (!edit) return;

    try {
      setLoading(true);
      const bannerRef = doc(db, "banners", bannerId);
      await updateDoc(bannerRef, {
        title: edit.title || "",
        link: edit.link || "",
        targetAudience: edit.targetAudience || "all",
        active: edit.active !== undefined ? edit.active : true
      });
      alert("Metadata Banner Berhasil Diperbarui!");
      fetchBanners();
    } catch (error) {
      console.error("Error updating banner metadata:", error);
      alert("Gagal memperbarui banner: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBanner = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, "banners"), {
        ...newBanner,
        createdAt: serverTimestamp()
      });
      alert("Banner Berhasil Ditambahkan!");
      setShowAddBannerModal(false);
      setNewBanner({
        title: '',
        link: '',
        targetAudience: 'all',
        active: true,
        image: 'https://via.placeholder.com/800x450?text=Klik+Ganti+Gambar'
      });
      fetchBanners();
    } catch (error) {
      console.error("Error adding banner:", error);
      alert("Gagal menambah banner: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBanner = async (bannerId) => {
    if (!window.confirm("Hapus banner ini permanen?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "banners", bannerId));
      alert("Banner Berhasil Dihapus!");
      fetchBanners();
    } catch (error) {
      console.error("Error deleting banner:", error);
      alert("Gagal menghapus banner.");
    } finally {
      setLoading(false);
    }
  };

  const toggleVerifyDriver = async (driverId, currentStatus) => {
    try {
      await updateDoc(doc(db, "drivers", driverId), { isVerified: !currentStatus });
      fetchDrivers();
    } catch (error) {
      console.error(error);
    }
  };

  const toggleVerifyMerchant = async (merchantId, currentStatus, currentReviewsCount) => {
    try {
      const updates = { verified: !currentStatus };
      if (currentReviewsCount === undefined) updates.reviewsCount = 0;
      await updateDoc(doc(db, "merchants", merchantId), updates);
      fetchMerchants();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAdminCancelOrder = async (transaction) => {
    if (!window.confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return;
    
    setLoading(true);
    try {
      const orderRef = doc(db, "orders", transaction.id);
      await updateDoc(orderRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: 'admin',
        cancelReason: 'Dibatalkan oleh Admin'
      });
      
      // Release driver if assigned
      if (transaction.driverId) {
        const driverRef = doc(db, "drivers", transaction.driverId);
        await updateDoc(driverRef, { status: "online" });
      }
      
      alert('Pesanan berhasil dibatalkan');
      setSelectedTransaction(null);
      fetchTransactions();
    } catch (error) {
      console.error("Error cancelling order:", error);
      alert('Gagal membatalkan pesanan');
    } finally {
      setLoading(false);
    }
  };

  const toggleBanUser = async (userId, collectionName, currentStatus) => {
    try {
      await updateDoc(doc(db, collectionName, userId), { isBanned: !currentStatus });
      if (collectionName === 'drivers') fetchDrivers();
      // If we had a members list, we'd refresh that too
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert("Isi kedua field password!");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Password tidak cocok!");
      return;
    }
    if (newPassword.length < 6) {
      alert("Password minimal 6 karakter!");
      return;
    }

    setPasswordLoading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, newPassword);
        alert("Password berhasil diperbarui!");
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert("Sesi berakhir, silakan login ulang.");
      }
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        alert("Sesi keamanan berakhir. Silakan Logout lalu Login kembali untuk mengganti password.");
      } else {
        alert("Gagal ganti password: " + error.message);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAddDriver = async (e) => {
    e.preventDefault();
    setIsAddingDriver(true);

    const secondaryConfig = {
      apiKey: "AIzaSyDHfsq6wdr5_iQdKfDjIer2TVdQyQPLAJE",
      authDomain: "gb-delivery-41bf6.firebaseapp.com",
      projectId: "gb-delivery-41bf6",
      storageBucket: "gb-delivery-41bf6.firebasestorage.app",
      messagingSenderId: "512031290884",
      appId: "1:512031290884:web:e3c980592d19d134076751"
    };

    let secondaryApp;
    try {
      secondaryApp = initializeApp(secondaryConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        newDriver.email, 
        newDriver.password
      );
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "drivers", uid), {
        name: newDriver.name,
        email: newDriver.email,
        phone: newDriver.phone,
        plateNumber: newDriver.plateNumber,
        vehicleType: newDriver.vehicleType,
        isVerified: true,
        isBanned: false,
        isOnline: false,
        rating: 5.0,
        createdAt: serverTimestamp(),
        role: 'driver'
      });

      alert("Driver Berhasil Didaftarkan!");
      setShowAddDriverModal(false);
      setNewDriver({ name: '', email: '', phone: '', plateNumber: '', vehicleType: 'jek', password: '' });
      fetchDrivers();
    } catch (error) {
      console.error("Error adding driver:", error);
      alert("Gagal mendaftarkan driver: " + error.message);
    } finally {
      setIsAddingDriver(false);
    }
  };

  const handleAddMerchant = async (e) => {
    e.preventDefault();
    setIsAddingMerchant(true);

    const secondaryConfig = {
      apiKey: "AIzaSyDHfsq6wdr5_iQdKfDjIer2TVdQyQPLAJE",
      authDomain: "gb-delivery-41bf6.firebaseapp.com",
      projectId: "gb-delivery-41bf6",
      storageBucket: "gb-delivery-41bf6.firebasestorage.app",
      messagingSenderId: "512031290884",
      appId: "1:512031290884:web:e3c980592d19d134076751"
    };

    let secondaryApp;
    try {
      const appName = `SecondaryApp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      secondaryApp = initializeApp(secondaryConfig, appName);
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        newMerchant.email, 
        newMerchant.password
      );
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "merchants", uid), {
        name: newMerchant.name,
        email: newMerchant.email,
        phone: newMerchant.phone,
        address: newMerchant.address,
        category: newMerchant.category,
        type: newMerchant.type || 'food',
        verified: true,
        isOpen: true,
        rating: 5.0,
        reviewsCount: 0,
        createdAt: serverTimestamp(),
        role: 'merchant'
      });

      alert("Mitra Merchant Berhasil Didaftarkan!");
      setShowAddMerchantModal(false);
      setNewMerchant({ name: '', email: '', phone: '', address: '', category: 'makanan', type: 'food', password: '' });
      fetchMerchants();
    } catch (error) {
      console.error("Error adding merchant:", error);
      alert("Gagal mendaftarkan merchant: " + error.message);
    } finally {
      setIsAddingMerchant(false);
    }
  };

  const handleDeleteDriver = async (driver) => {
    if (!window.confirm(`Hapus driver ${driver.name}? Akun login dan datanya akan hilang permanen!`)) return;

    setIsDeleting(driver.id);
    try {
      // 1. Delete from Firebase Auth via Cloud Function
      const response = await fetch('https://asia-southeast2-gb-delivery-41bf6.cloudfunctions.net/deleteUserAccount', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: driver.id })
      });

      const result = await response.json();
      if (!result.success && !result.error?.includes('auth/user-not-found')) {
        throw new Error(result.error || 'Gagal hapus akun Auth');
      }

      // 2. Delete from Firestore
      await deleteDoc(doc(db, "drivers", driver.id));
      alert("Driver dan akun login berhasil dihapus!");
      fetchDrivers();
    } catch (error) {
      console.error("Error deleting driver:", error);
      alert("Gagal hapus driver: " + error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Hapus user ${user.displayName || 'ini'}? Akun login dan datanya akan hilang permanen!`)) return;

    setIsDeleting(user.id);
    try {
      // 1. Delete from Firebase Auth via Cloud Function
      const response = await fetch('https://asia-southeast2-gb-delivery-41bf6.cloudfunctions.net/deleteUserAccount', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.id })
      });

      const result = await response.json();
      if (!result.success && !result.error?.includes('auth/user-not-found')) {
        throw new Error(result.error || 'Gagal hapus akun Auth');
      }

      // 2. Delete from Firestore
      await deleteDoc(doc(db, "users", user.id));
      alert("User dan akun login berhasil dihapus!");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Gagal hapus user: " + error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeleteMerchant = async (merchant) => {
    if (!window.confirm(`Hapus merchant ${merchant.name || 'ini'}? Data merchant akan hilang permanen!`)) return;

    setIsDeleting(merchant.id);
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        throw new Error('Sesi admin berakhir. Silakan login ulang.');
      }

      const response = await fetch('https://asia-southeast2-gb-delivery-41bf6.cloudfunctions.net/deleteMerchant', { 
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ merchantId: merchant.id })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal hapus merchant');
      }

      alert("Merchant berhasil dihapus!");
      fetchMerchants();
    } catch (error) {
      console.error("Error deleting merchant:", error);
      alert("Gagal hapus merchant: " + error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUpdateDriver = async (e) => {
    e.preventDefault();
    if (!editingDriver) return;

    setLoading(true);
    try {
      const driverRef = doc(db, "drivers", editingDriver.id);
      await updateDoc(driverRef, {
        name: editingDriver.name,
        phone: editingDriver.phone,
        plateNumber: editingDriver.plateNumber,
        email: editingDriver.email,
        vehicleType: editingDriver.vehicleType
      });

      alert("Data driver berhasil diperbarui!");
      setShowEditDriverModal(false);
      fetchDrivers();
    } catch (error) {
      console.error("Error updating driver:", error);
      alert("Gagal update driver: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMerchants = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "merchants"), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMerchants(list);
    } catch (error) {
      console.error("Error fetching merchants:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (merchantId, files) => {
    if (!files || files.length === 0) return;
    
    // Capture files immediately as Array to avoid stale FileList references
    const fileArray = Array.from(files);
    
    setUploadingId(merchantId);
    try {
      // Fetch fresh merchant data from Firestore to get accurate state
      const merchantRef = doc(db, "merchants", merchantId);
      const merchantSnap = await getDoc(merchantRef);
      const merchantData = merchantSnap.exists() ? merchantSnap.data() : {};
      const hasOriginal = !!merchantData.originalMenuImage;
      
      const newUrls = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        // Sanitize filename: remove special chars, keep extension
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const safeName = `menu_${Date.now()}_${i}.${ext}`;
        const storagePath = `manual_menus/${merchantId}/${safeName}`;
        const storageRef = ref(storage, storagePath);
        
        // Upload and use the snapshot's ref to get download URL
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURLWithRetry(snapshot.ref);
        newUrls.push(downloadURL);
      }

      if (newUrls.length === 0) {
        alert("Tidak ada foto yang berhasil diunggah.");
        return;
      }

      const updateData = {};

      // Only delete legacy 'menu' field if it actually exists
      if (merchantData.menu !== undefined) {
        updateData.menu = deleteField();
      }

      if (newUrls.length > 0) {
        // Smart logic: Promote the first new photo to originalMenuImage
        updateData.originalMenuImage = newUrls[0];
        
        const thumbnailsToAdd = [...newUrls.slice(1)];
        // Demote old originalMenuImage to thumbnails so it is not lost
        if (merchantData.originalMenuImage) {
          thumbnailsToAdd.push(merchantData.originalMenuImage);
        }
        
        if (thumbnailsToAdd.length > 0) {
          updateData.menu_thumbnails = arrayUnion(...thumbnailsToAdd);
        }
      }

      await updateDoc(merchantRef, updateData);

      alert(`Menu berhasil diunggah! (${newUrls.length} foto)`);
      fetchMerchants(); // Refresh list
    } catch (error) {
      console.error("Upload error:", error);
      alert("Gagal mengunggah menu: " + error.message);
    } finally {
      setUploadingId(null);
    }
  };
  const handleDeleteMenuPhoto = async (merchantId, photoUrl, isOriginal) => {
    if (!window.confirm("Hapus foto ini dari galeri merchant?")) return;

    try {
      const merchantRef = doc(db, "merchants", merchantId);
      const updateData = {};

      if (isOriginal) {
        // Jika menghapus foto utama, promosikan thumbnail pertama (jika ada) atau hapus field
        if (selectedMerchantMenu.menu_thumbnails && selectedMerchantMenu.menu_thumbnails.length > 0) {
          const firstThumb = selectedMerchantMenu.menu_thumbnails[0];
          updateData.originalMenuImage = firstThumb;
          updateData.menu_thumbnails = arrayRemove(firstThumb);
        } else {
          updateData.originalMenuImage = deleteField();
        }
      } else {
        updateData.menu_thumbnails = arrayRemove(photoUrl);
      }

      await updateDoc(merchantRef, updateData);
      
      // Update local state untuk feedback instan
      const updatedMerchant = { ...selectedMerchantMenu };
      if (isOriginal) {
        if (selectedMerchantMenu.menu_thumbnails && selectedMerchantMenu.menu_thumbnails.length > 0) {
          updatedMerchant.originalMenuImage = selectedMerchantMenu.menu_thumbnails[0];
          updatedMerchant.menu_thumbnails = selectedMerchantMenu.menu_thumbnails.slice(1);
        } else {
          delete updatedMerchant.originalMenuImage;
        }
      } else {
        updatedMerchant.menu_thumbnails = selectedMerchantMenu.menu_thumbnails.filter(url => url !== photoUrl);
      }
      setSelectedMerchantMenu(updatedMerchant);
      
      // Juga update list merchant utama agar sinkron
      setMerchants(prev => prev.map(m => m.id === merchantId ? updatedMerchant : m));
      
      alert("Foto berhasil dihapus");
    } catch (error) {
      console.error("Delete photo error:", error);
      alert("Gagal menghapus foto: " + error.message);
    }
  };

  const handleSyncPopularity = async (merchant) => {
    setUploadingId(merchant.id);
    try {
      const response = await fetch('https://asia-southeast2-gb-delivery-41bf6.cloudfunctions.net/syncMerchantPopularityFromMaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchantId: merchant.id
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync popularity');
      }

      alert(`Berhasil sinkronisasi popularitas! (${result.reviewsCount} ulasan)`);
      fetchMerchants();
    } catch (error) {
      console.error("Sync popularity error:", error);
      alert("Gagal sinkronisasi: " + error.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleSaveBento = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      let newList;
      if (editingBento !== null) {
        newList = [...bentoPromos];
        newList[editingBento] = newBento;
      } else {
        newList = [...bentoPromos, newBento];
      }
      
      await updateDoc(doc(db, 'settings', 'platform'), {
        bentoPromos: newList
      });
      
      setShowAddBentoModal(false);
      alert('Bento Promo Berhasil Disimpan!');
    } catch (err) {
      console.error(err);
      alert('Gagal simpan bento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVoucher = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      let newList;
      if (editingVoucher !== null) {
        newList = [...vouchers];
        newList[editingVoucher] = newVoucher;
      } else {
        newList = [...vouchers, { ...newVoucher, id: Date.now().toString() }];
      }
      
      await updateDoc(doc(db, 'settings', 'platform'), {
        vouchers: newList
      });
      
      setShowAddVoucherModal(false);
      alert('Template Voucher Berhasil Disimpan!');
    } catch (err) {
      console.error(err);
      alert('Gagal simpan voucher: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVoucher = async (index) => {
    if (!window.confirm('Hapus template voucher ini?')) return;
    try {
      setLoading(true);
      const newList = vouchers.filter((_, i) => i !== index);
      await updateDoc(doc(db, 'settings', 'platform'), {
        vouchers: newList
      });
      alert('Voucher berhasil dihapus');
    } catch (err) {
      console.error(err);
      alert('Gagal hapus voucher: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredMerchants = merchants.filter(m => 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const menuItems = [
    { id: 'Overview', icon: 'dashboard', label: 'Overview' },
    { id: 'Drivers', icon: 'local_shipping', label: 'Drivers' },
    { id: 'Users', icon: 'group', label: 'Users' },
    { id: 'Food', icon: 'restaurant', label: 'Kelola Merchant' },
    { id: 'Transactions', icon: 'payments', label: 'Transactions' },
    { id: 'Topups', icon: 'account_balance_wallet', label: 'Topups' },
    { id: 'Banners', icon: 'ads_click', label: 'Banners' },
    { id: 'Promos', icon: 'loyalty', label: 'Promos' },
    { id: 'Tarif', icon: 'sell', label: 'Tarif' },
    { id: 'Settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <div className="bg-background text-on-surface antialiased overflow-x-hidden min-h-screen relative">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* SideNavBar */}
      <aside className={`h-screen w-64 fixed left-0 top-0 flex flex-col bg-[#0e0e0e] border-r border-white/5 z-50 transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex flex-col h-full py-6">
          <div className="px-6 mb-10">
            <h1 className="text-2xl font-black text-[#f3ffca] tracking-tighter font-headline">Aro Drive</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-medium mt-1">Admin Terminal</p>
          </div>
          <nav className="flex-1 space-y-1">
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-6 py-3 transition-all duration-200 active:scale-95 ${
                  activeTab === item.id 
                    ? 'text-[#f3ffca] bg-[#262626] rounded-r-full font-bold border-l-4 border-[#f3ffca]' 
                    : 'text-gray-500 hover:text-[#f3ffca] hover:bg-[#131313] border-l-4 border-transparent'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-headline tracking-tight">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="px-6 mt-auto space-y-3">
            <Link
              to="/admin/orders/create"
              onClick={() => setIsSidebarOpen(false)}
              className="w-full bg-[#f3ffca] text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:shadow-[0_0_20px_rgba(243,255,202,0.3)] transition-all active:scale-95 group"
            >
              <span className="material-symbols-outlined text-xl group-hover:rotate-12 transition-transform">add_circle</span>
              <span className="font-headline tracking-tighter uppercase italic">Buat Pesanan</span>
            </Link>
            <button className="w-full bg-white/5 text-on-surface-variant font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors border border-white/5">
              <span className="material-symbols-outlined text-sm">campaign</span>
              Broadcast Alert
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="w-full bg-error/10 text-error font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-error/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* TopAppBar */}
      <header className="fixed top-0 right-0 w-full md:w-[calc(100%-16rem)] h-16 z-40 bg-[#0e0e0e]/60 backdrop-blur-xl border-b border-white/5">
        <div className="flex justify-between items-center px-4 md:px-8 h-full">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-white p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="text-lg font-bold text-white font-headline">Admin Portal</h2>
            <div className="h-4 w-px bg-white/10"></div>
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="text-xs font-medium uppercase tracking-widest font-label">Status:</span>
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
              <span className="text-xs font-bold text-primary">Live</span>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden lg:relative lg:group lg:block">
              <input className="bg-surface-container-low border-none rounded-full px-4 py-1.5 text-sm w-64 focus:ring-1 focus:ring-[#f3ffca] text-on-surface placeholder:text-gray-600 transition-all" placeholder="Search operations..." type="text" />
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">search</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-gray-400 hover:text-[#f3ffca] transition-colors relative">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-0 right-0 h-2 w-2 bg-error rounded-full border border-background"></span>
              </button>
              <button className="text-gray-400 hover:text-[#f3ffca] transition-colors">
                <span className="material-symbols-outlined">help_outline</span>
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-white leading-none">Super Admin</p>
                  <p className="text-[10px] text-on-surface-variant font-medium uppercase tracking-tighter">Master Access</p>
                </div>
                <img alt="Super Admin" className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/10 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCxcz1taIWZuXhNzE4Kk8oX_K9kT3igqduygNAUgv7_mTFp-ymwFm4L7ke1X76c_myYezYuZT9zekztDR3w5IV4Lgug2NioMihbUn5oQ-zEWNovvdARWlUM-meti753-l48VVcuClnG81nXwpnYadPnldhulNhPKo6MBKQcNG_mtAOs5Hz7k0ch-FbGfdgDxPLJ1GvQlQJB6eYPHC6Ni-X7we4GomSYlkde5kTLUHJMvCa-IknsHAV3RuT4ANIU5qG82r3eByVnFWA" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content Canvas */}
      <main className="ml-0 md:ml-64 pt-24 pb-12 px-4 md:px-8 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'Overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Stats Box */}
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-7 bg-surface-container-low rounded-3xl p-8 relative overflow-hidden flex flex-col justify-between min-h-[240px]">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant font-label">Total Pendapatan Fee (Hari Ini)</span>
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full font-bold">REAL-TIME</span>
                    </div>
                    <h3 className="text-6xl font-black text-primary font-headline tracking-tighter mb-2">
                      Rp {metrics.revenue.toLocaleString('id-ID')}
                    </h3>
                    <p className="text-on-surface-variant text-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-primary text-sm">trending_up</span>
                      <span className="font-bold text-primary">+12.5%</span> dari hari sebelumnya
                    </p>
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-surface-container-highest rounded-3xl p-6 flex flex-col justify-between">
                    <span className="material-symbols-outlined text-primary">electric_bolt</span>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-1">Active Drivers</p>
                      <p className="text-3xl font-bold font-headline">{metrics.drivers}</p>
                    </div>
                  </div>
                  <div className="bg-surface-container-highest rounded-3xl p-6 flex flex-col justify-between">
                    <span className="material-symbols-outlined text-secondary">restaurant_menu</span>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-1">Orders Today</p>
                      <p className="text-3xl font-bold font-headline">{metrics.orders}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transactions Table Preview */}
              <div className="bg-surface-container-low rounded-3xl overflow-hidden border border-white/5">
                <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Transaksi Terbaru</h4>
                  <button onClick={() => setActiveTab('Transactions')} className="text-primary text-xs font-bold hover:underline">Lihat Semua</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                        <th className="px-8 py-4">Order ID</th>
                        <th className="px-4 py-4">Layanan</th>
                        <th className="px-4 py-4">Total</th>
                        <th className="px-8 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {transactions.slice(0, 5).map(order => (
                        <tr key={order.id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => { setSelectedTransaction(order); setActiveTab('Transactions'); }}>
                          <td className="px-8 py-5 text-sm font-bold font-headline">#{order.id.slice(-6).toUpperCase()}</td>
                          <td className="px-4 py-5 text-xs font-medium uppercase">{order.serviceType}</td>
                          <td className="px-4 py-5 text-sm font-bold">Rp {order.total?.toLocaleString('id-ID')}</td>
                          <td className="px-8 py-5 text-right">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                              order.status === 'completed' ? 'bg-primary/10 text-primary' : 'bg-yellow-500/10 text-yellow-500'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Food' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 gap-6">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">Food Merchant Management</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Kelola daftar warung dan upload foto menu fisik untuk manual order</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                  <div className="relative w-full sm:w-64">
                    <input 
                      type="text" 
                      placeholder="Cari warung/resto..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-surface-container-highest border-none rounded-2xl px-6 py-3 text-sm w-full focus:ring-2 focus:ring-primary transition-all text-white"
                    />
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary">search</span>
                  </div>
                  <button 
                    onClick={() => setShowAddMerchantModal(true)}
                    className="w-full sm:w-auto bg-primary text-black font-black px-6 py-3 rounded-2xl hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                  >
                    <span className="material-symbols-outlined text-sm">storefront</span>
                    Tambah Merchant
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-primary uppercase tracking-[0.3em]">Memuat Merchant...</p>
                </div>
              ) : (
                <div className="space-y-12">
                  {['makanan', 'minuman', 'camilan', 'bakso', 'seblak', 'nasi', 'mie', 'ayam', 'others'].map(catId => {
                    const merchantsInCat = filteredMerchants.filter(m => {
                      if (catId === 'others') {
                        return !['makanan', 'minuman', 'camilan', 'bakso', 'seblak', 'nasi', 'mie', 'ayam'].includes(m.category);
                      }
                      return m.category === catId;
                    });

                    if (merchantsInCat.length === 0) return null;

                    return (
                      <div key={catId} className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="h-[2px] flex-1 bg-white/5"></div>
                          <h4 className="text-lg font-black text-primary font-headline uppercase italic tracking-widest px-6 border border-primary/20 rounded-full py-2 bg-primary/5 shadow-lg shadow-primary/5">
                            {catId === 'others' ? 'Lainnya' : catId.charAt(0).toUpperCase() + catId.slice(1)}
                          </h4>
                          <div className="h-[2px] flex-1 bg-white/5"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {merchantsInCat.map((m) => (
                            <div key={m.id} className="bg-surface-container-low rounded-[2rem] p-6 border border-white/5 hover:border-primary/20 transition-all group relative overflow-hidden">
                              <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center overflow-hidden border border-white/5">
                                  {m.image && !m.image.includes('storage.googleapis.com') ? (
                                    <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                                  ) : m.originalMenuImage ? (
                                    <img src={m.originalMenuImage} alt={m.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="material-symbols-outlined text-primary">storefront</span>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  {m.originalMenuImage ? (
                                    <span className="px-3 py-1 bg-green-500/10 text-green-500 text-[10px] font-black uppercase rounded-full border border-green-500/20">
                                      Menu OK ({1 + (m.menu_thumbnails?.length || 0)} Foto)
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 bg-error/10 text-error text-[10px] font-black uppercase rounded-full border border-error/20">Belum Ada Menu</span>
                                  )}
                                  {m.verified ? (
                                    <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-full border border-primary/20 flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[12px]">verified</span> Verified
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 bg-zinc-500/10 text-zinc-500 text-[10px] font-black uppercase rounded-full border border-white/5">Pending Review</span>
                                  )}
                                </div>
                              </div>
                              
                              <h4 className="text-lg font-black text-white font-headline mb-1 uppercase tracking-tight">{m.name}</h4>
                                <div className="flex items-center gap-2 mb-6">
                                  <p className="text-xs text-on-surface-variant font-medium line-clamp-1 flex-1">{m.address || "Kab. Blitar"}</p>
                                  <button 
                                    onClick={async () => {
                                      const newType = m.type === 'shop' ? 'food' : 'shop';
                                      try {
                                        const updates = { type: newType };
                                        if (m.reviewsCount === undefined) updates.reviewsCount = 0;
                                        await updateDoc(doc(db, "merchants", m.id), updates);
                                        fetchMerchants();
                                      } catch (e) { alert(e.message); }
                                    }}
                                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${m.type === 'shop' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}
                                  >
                                    {m.type === 'shop' ? 'SHOP' : 'FOOD'}
                                  </button>
                                  {m.reviewsCount !== undefined && (
                                    <div className="flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                                      <span className="material-symbols-outlined text-[12px] text-primary">trending_up</span>
                                      <span className="text-[10px] font-black text-primary">{m.reviewsCount}</span>
                                    </div>
                                  )}
                                </div>
                              
                              <div className="pt-4 border-t border-white/5 space-y-4">
                                {/* Verify Toggle */}
                                <button 
                                  onClick={() => toggleVerifyMerchant(m.id, m.verified, m.reviewsCount)}
                                  className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                    m.verified ? 'bg-error/10 text-error border border-error/20 hover:bg-error hover:text-white' : 'bg-primary text-black hover:shadow-lg active:scale-95'
                                  }`}
                                >
                                  {m.verified ? 'Unverify Merchant' : 'Verify Merchant Now'}
                                </button>

                                <div className="flex gap-3">
                                  <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest cursor-pointer transition-all ${
                                    uploadingId === m.id ? 'bg-zinc-800 text-zinc-500' : 'bg-white/5 text-white border border-white/10 hover:bg-white/10 active:scale-95'
                                  }`}>
                                    <span className="material-symbols-outlined text-sm">
                                      {uploadingId === m.id ? 'sync' : 'upload_file'}
                                    </span>
                                    {uploadingId === m.id ? 'SABAR...' : 'Menu'}
                                    <input 
                                      type="file" 
                                      className="hidden" 
                                      accept="image/*"
                                      multiple
                                      disabled={uploadingId === m.id}
                                      onChange={(e) => handlePhotoUpload(m.id, e.target.files)}
                                    />
                                  </label>
                                  
                                  {(m.originalMenuImage || (m.menu_thumbnails && m.menu_thumbnails.length > 0)) && (
                                    <button 
                                      onClick={() => {
                                        setSelectedMerchantMenu(m);
                                        setShowMenuGalleryModal(true);
                                      }}
                                      className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white hover:bg-white/10 transition-all border border-white/10"
                                    >
                                      <span className="material-symbols-outlined text-sm">visibility</span>
                                    </button>
                                  )}
                                </div>
                                
                                  <div className="flex gap-3">

                                    <button 
                                      onClick={() => handleSyncPopularity(m)}
                                      disabled={uploadingId === m.id}
                                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${
                                        uploadingId === m.id ? 'bg-white/5 text-white/30' : 'border border-primary/20 bg-primary/10 text-primary hover:bg-primary hover:text-black active:scale-95'
                                      }`}
                                    >
                                      <span className="material-symbols-outlined text-sm">trending_up</span>
                                      Popularity
                                    </button>
                                   {m.image && (
                                      <button 
                                        onClick={() => window.open(m.image, '_blank')}
                                        className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white border border-white/10 hover:bg-white/20"
                                      >
                                        <span className="material-symbols-outlined text-sm">image</span>
                                      </button>
                                    )}
                                  </div>
                                  <button 
                                    onClick={() => handleDeleteMerchant(m)}
                                    disabled={isDeleting === m.id}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all bg-error/10 text-error border border-error/20 hover:bg-error hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isDeleting === m.id ? (
                                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                      <span className="material-symbols-outlined text-sm">delete</span>
                                    )}
                                    Hapus Merchant
                                  </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {activeTab === 'Drivers' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 gap-6">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">Driver Management</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Verifikasi pendaftaran driver dan kelola otorisasi akses</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                  <div className="relative w-full sm:w-64">
                    <input 
                      type="text" 
                      placeholder="Cari driver..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-surface-container-highest border-none rounded-2xl px-6 py-3 text-sm w-full focus:ring-2 focus:ring-primary transition-all text-white"
                    />
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary">search</span>
                  </div>
                  <button 
                    onClick={() => setShowAddDriverModal(true)}
                    className="w-full sm:w-auto bg-primary text-black font-black px-6 py-3 rounded-2xl hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                  >
                    <span className="material-symbols-outlined text-sm">person_add</span>
                    Tambah Driver
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {drivers.filter(d => 
                  d.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  d.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  d.plateNumber?.toLowerCase().includes(searchQuery.toLowerCase())
                ).map(driver => (
                  <div key={driver.id} className="bg-surface-container-low rounded-[2rem] p-6 border border-white/5 hover:border-primary/20 transition-all group relative overflow-hidden">
                    <div className="absolute top-4 right-4 z-10">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteDriver(driver); }}
                        className="w-10 h-10 bg-error/10 text-error rounded-full flex items-center justify-center hover:bg-error hover:text-white transition-all border border-error/20"
                        title="Hapus Driver"
                      >
                        {isDeleting === driver.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-sm">delete</span>}
                      </button>
                    </div>

                    <div className="flex gap-4 mb-6 cursor-pointer" onClick={() => { setEditingDriver(driver); setShowEditDriverModal(true); }}>
                      <img src={driver.photoUrl || 'https://via.placeholder.com/150'} alt={driver.name} className="w-16 h-16 rounded-2xl object-cover border border-white/10" />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="text-lg font-black text-white font-headline uppercase leading-tight">{driver.name}</h4>
                          <span className={`h-2 w-2 rounded-full ${driver.isOnline ? 'bg-primary' : 'bg-zinc-600'}`}></span>
                        </div>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{driver.plateNumber || 'No Plate'}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="material-symbols-outlined text-[10px] text-yellow-500">star</span>
                          <span className="text-[10px] font-bold text-white">{driver.rating || '5.0'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                      <button 
                        onClick={() => toggleVerifyDriver(driver.id, driver.isVerified)}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          driver.isVerified ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-primary text-black'
                        }`}
                      >
                        {driver.isVerified ? 'Verified' : 'Verify Now'}
                      </button>
                      <button 
                        onClick={() => toggleBanUser(driver.id, 'drivers', driver.isBanned)}
                        className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          driver.isBanned ? 'bg-error text-white' : 'bg-error/10 text-error border border-error/20'
                        }`}
                      >
                        {driver.isBanned ? 'Unban' : 'Ban Driver'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Transactions' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5">
                <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic mb-2 text-shadow-glow">Riwayat Transaksi</h3>
                <div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant font-medium">
                  <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-primary"></span> Completed</span>
                  <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-yellow-500"></span> Pending / OntheWay</span>
                  <span className="flex items-center gap-1 shrink-0"><span className="h-2 w-2 rounded-full bg-error"></span> Cancelled</span>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-3xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                        <th className="px-8 py-4">Order ID</th>
                        <th className="px-4 py-4">Layanan</th>
                        <th className="px-4 py-4">Customer</th>
                        <th className="px-4 py-4">Driver</th>
                        <th className="px-4 py-4">Total</th>
                        <th className="px-8 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {transactions.filter(o => 
                        o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        o.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map(order => (
                        <tr key={order.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-8 py-5">
                            <p className="text-sm font-bold font-headline">#{order.id.slice(-6).toUpperCase()}</p>
                            <p className="text-[10px] text-on-surface-variant">{order.createdAt?.toDate().toLocaleString('id-ID')}</p>
                          </td>
                          <td className="px-4 py-5 font-bold uppercase text-[10px]">{order.serviceType}</td>
                          <td className="px-4 py-5 text-xs font-medium">{order.customer?.name || 'Guest'}</td>
                          <td className="px-4 py-5 text-xs font-medium">{order.driverId?.slice(-6).toUpperCase() || '-'}</td>
                          <td className="px-4 py-5 text-sm font-bold text-primary">Rp {order.total?.toLocaleString('id-ID')}</td>
                          <td className="px-8 py-5 text-right">
                            <button 
                              onClick={() => setSelectedTransaction(order)}
                              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Banners' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">Banner Management</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Kelola gambar promosi yang tampil di dashboard aplikasi user</p>
                </div>
                <button 
                  onClick={() => setShowAddBannerModal(true)}
                  className="bg-primary text-black font-black px-8 py-4 rounded-2xl flex items-center gap-2 hover:shadow-[0_0_20px_rgba(202,253,0,0.3)] transition-all active:scale-95 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined">add_circle</span>
                  TAMBAH BANNER BARU
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {banners.map(banner => (
                  <div key={banner.id} className="bg-surface-container-low rounded-[2rem] p-6 border border-white/5 space-y-6">
                    <div className="aspect-[21/9] w-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 relative group">
                      <img src={banner.imageUrl || banner.image} alt={banner.id} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-[10px] font-black text-white uppercase tracking-widest bg-black/60 px-4 py-2 rounded-full">Preview Banner</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Judul Banner</label>
                        <input 
                          type="text" 
                          placeholder="Contoh: Diskon Ongkir 50%"
                          value={bannerEdits[banner.id]?.title ?? banner.title ?? ''}
                          onChange={(e) => setBannerEdits({...bannerEdits, [banner.id]: {...(bannerEdits[banner.id] || {title: banner.title, link: banner.link}), title: e.target.value}})}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white text-sm font-bold focus:ring-2 focus:ring-primary transition-all"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Target Link (Path / URL)</label>
                        <input 
                          type="text" 
                          placeholder="Contoh: /food atau /ride"
                          value={bannerEdits[banner.id]?.link ?? banner.link ?? ''}
                          onChange={(e) => setBannerEdits({...bannerEdits, [banner.id]: {...(bannerEdits[banner.id] || {title: banner.title, link: banner.link, targetAudience: banner.targetAudience}), link: e.target.value}})}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white text-sm font-bold focus:ring-2 focus:ring-primary transition-all"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Target Audience</label>
                        <select 
                          value={bannerEdits[banner.id]?.targetAudience ?? banner.targetAudience ?? 'all'}
                          onChange={(e) => setBannerEdits({...bannerEdits, [banner.id]: {...(bannerEdits[banner.id] || {title: banner.title, link: banner.link, targetAudience: banner.targetAudience}), targetAudience: e.target.value}})}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white text-sm font-bold focus:ring-2 focus:ring-primary transition-all appearance-none"
                        >
                          <option value="all" className="bg-surface-container-highest">Semua Pengguna</option>
                          <option value="member" className="bg-surface-container-highest">Member Saja</option>
                          <option value="guest" className="bg-surface-container-highest">Guest Saja</option>
                        </select>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => handleUpdateBannerMetadata(banner.id)}
                          className="flex-[2] bg-white/5 hover:bg-white/10 text-white border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                          Simpan Teks & Link
                        </button>
                        
                        <label className={`flex-1 flex items-center justify-center px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                          uploadingId === banner.id ? 'bg-zinc-800 text-zinc-500' : 'bg-primary text-black hover:shadow-lg active:scale-95'
                        }`}>
                          {uploadingId === banner.id ? 'Sabar...' : 'Ganti Gambar'}
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => handleBannerUpload(banner.id, e.target.files[0])}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">ID: {banner.id}</span>
                        <button 
                          onClick={() => handleDeleteBanner(banner.id)}
                          className="text-error hover:text-red-400 transition-colors"
                          title="Hapus Banner"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className={`h-2 w-2 rounded-full ${banner.active ? 'bg-primary' : 'bg-zinc-600'}`}></span>
                         <button 
                            onClick={() => {
                              setBannerEdits({...bannerEdits, [banner.id]: {
                                ...(bannerEdits[banner.id] || {title: banner.title, link: banner.link, targetAudience: banner.targetAudience}), 
                                active: !banner.active
                              }});
                              // Auto save toggle
                              setTimeout(() => handleUpdateBannerMetadata(banner.id), 100);
                            }}
                            className="text-[10px] font-black text-white uppercase hover:text-primary transition-colors"
                         >
                           {banner.active ? 'Active' : 'Inactive'}
                         </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Promos' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {/* Loyalty & Points Section */}
               <div className="bg-surface-container-low rounded-3xl p-8 space-y-8 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase">Program Loyalty</h3>
                    <p className="text-sm text-on-surface-variant font-medium">Atur bagi hasil admin dan poin member</p>
                  </div>
                  <span className="material-symbols-outlined text-primary text-4xl">loyalty</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-[#f3ffca]">Dapat 1 Poin Setiap Belanja (Rp)</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="text-primary font-bold">1 Poin / </span>
                      </div>
                      <input 
                        type="number" 
                        value={pointsPerTenk}
                        onChange={(e) => setPointsPerTenk(Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-24 pr-4 text-on-surface font-bold focus:ring-2 focus:ring-primary transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-[#f3ffca]">Poin Dibutuhkan Untuk Voucher</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                        <span className="text-primary font-bold">Poin</span>
                      </div>
                      <input 
                        type="number" 
                        value={pointsToRedeem}
                        onChange={(e) => setPointsToRedeem(Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-4 pr-16 text-on-surface font-bold focus:ring-2 focus:ring-primary transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <button 
                    onClick={async () => {
                      try {
                        const settingsRef = doc(db, 'settings', 'platform');
                        await setDoc(settingsRef, {
                          pointsPerTenk,
                          pointsToRedeem
                        }, { merge: true });
                        alert('Settings Loyalty Berhasil Disimpan!');
                      } catch (err) {
                        console.error(err);
                        alert('Gagal simpan settings: ' + err.message);
                      }
                    }}
                    className="kinetic-gradient bg-primary text-black font-black px-8 py-4 rounded-2xl active:scale-95 transition-all shadow-xl shadow-primary/20 uppercase tracking-widest text-sm"
                  >
                    Simpan Settings Loyalty
                  </button>
                </div>
              </div>

              {/* Bento Promos Section */}
              <div className="bg-surface-container-low rounded-3xl p-8 space-y-8 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase">Bento Promo Grid</h3>
                    <p className="text-sm text-on-surface-variant font-medium">Kelola kotak promo yang tampil di home user</p>
                  </div>
                  <button 
                    onClick={() => {
                      setNewBento({ title: '', subtitle: '', icon: 'star', color: 'primary', link: '' });
                      setEditingBento(null);
                      setShowAddBentoModal(true);
                    }}
                    className="bg-primary text-black font-black px-6 py-3 rounded-xl flex items-center gap-2 hover:shadow-lg active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Tambah Bento
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bentoPromos.map((promo, idx) => promo && (
                    <div key={idx} className="bg-surface-container-highest/30 rounded-2xl p-6 border border-white/5 group relative overflow-hidden">
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingBento(idx);
                            setNewBento(promo);
                            setShowAddBentoModal(true);
                          }}
                          className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button 
                          onClick={async () => {
                            if (!window.confirm('Hapus promo ini?')) return;
                            const newList = bentoPromos.filter((_, i) => i !== idx);
                            try {
                              await updateDoc(doc(db, 'settings', 'platform'), { bentoPromos: newList });
                              alert('Promo dihapus!');
                            } catch (e) { alert(e.message); }
                          }}
                          className="w-8 h-8 bg-error/10 text-error rounded-full flex items-center justify-center hover:bg-error hover:text-white transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>

                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className={`text-${promo.color} text-[10px] font-black tracking-widest uppercase`}>{promo.subtitle}</p>
                          <h4 className="text-lg font-bold text-white whitespace-pre-line">{promo.title}</h4>
                          {promo.link && (
                            <p className="text-[9px] text-on-surface-variant font-medium mt-2 italic">Link: {promo.link}</p>
                          )}
                        </div>
                        <span className={`material-symbols-outlined text-4xl text-${promo.color}/30`}>{promo.icon}</span>
                      </div>
                    </div>
                  ))}
                  {bentoPromos.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-white/5 rounded-3xl">
                      <span className="material-symbols-outlined text-4xl mb-2">grid_view</span>
                      <p className="text-xs font-bold uppercase tracking-widest">Belum ada promo bento</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vouchers & Discounts Section */}
              <div className="bg-surface-container-low rounded-3xl p-8 space-y-8 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">Voucher Templates</h3>
                    <p className="text-sm text-on-surface-variant font-medium">Kelola template voucher yang bisa dibagikan ke user</p>
                  </div>
                  <button 
                    onClick={() => {
                      setNewVoucher({
                        code: '',
                        title: '',
                        type: 'FREE_DELIVERY',
                        value: 0,
                        minOrder: 0,
                        expiryDays: 30,
                        active: true
                      });
                      setEditingVoucher(null);
                      setShowAddVoucherModal(true);
                    }}
                    className=" kinetic-gradient bg-secondary text-black font-black px-6 py-3 rounded-xl flex items-center gap-2 hover:shadow-lg active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                  >
                    <span className="material-symbols-outlined text-sm">confirmation_number</span>
                    Buat Voucher Baru
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {vouchers.map((v, idx) => v && (
                    <div key={idx} className="bg-surface-container-highest/30 rounded-2xl p-6 border border-white/5 group relative overflow-hidden">
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingVoucher(idx);
                            setNewVoucher(v);
                            setShowAddVoucherModal(true);
                          }}
                          className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteVoucher(idx)}
                          className="w-8 h-8 bg-error/10 text-error rounded-full flex items-center justify-center hover:bg-error hover:text-white transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-secondary">local_activity</span>
                        </div>
                        <div>
                          <p className="text-xs font-black text-white">{v.code || 'NO CODE'}</p>
                          <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">{(v.type || 'FREE_DELIVERY').replace('_', ' ')}</p>
                        </div>
                      </div>

                      <h4 className="text-lg font-bold text-white mb-2">{v.title || 'Voucher Tanpa Judul'}</h4>
                      
                      <div className="flex flex-wrap gap-2 mt-4">
                        <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                          <p className="text-[8px] text-on-surface-variant font-black uppercase">Min. Order</p>
                          <p className="text-xs font-bold text-white">Rp {(v.minOrder || 0).toLocaleString()}</p>
                        </div>
                        <div className="px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                          <p className="text-[8px] text-on-surface-variant font-black uppercase">Expiry</p>
                          <p className="text-xs font-bold text-white">{v.expiryDays || 30} Hari</p>
                        </div>
                        {(v.value || 0) > 0 && (
                          <div className="px-3 py-1 bg-primary/10 rounded-lg border border-primary/20">
                            <p className="text-[8px] text-primary font-black uppercase">Value</p>
                            <p className="text-xs font-bold text-primary">{v.type === 'PERCENTAGE' ? `${v.value}%` : `Rp ${(v.value || 0).toLocaleString()}`}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {vouchers.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-on-surface-variant border-2 border-dashed border-white/5 rounded-3xl">
                      <span className="material-symbols-outlined text-4xl mb-2">confirmation_number</span>
                      <p className="text-xs font-bold uppercase tracking-widest">Belum ada template voucher</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Settings' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-surface-container-low rounded-3xl p-8 space-y-8 border border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase">Pengaturan Akun</h3>
                    <p className="text-sm text-on-surface-variant font-medium">Kelola keamanan akses dashboard admin</p>
                  </div>
                  <span className="material-symbols-outlined text-secondary text-4xl">manage_accounts</span>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email Admin</label>
                    <div className="bg-surface-container-highest/50 p-4 rounded-2xl text-white font-bold border border-white/5">
                      {adminUser?.email || 'Admin ARO-DRIVE'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Password Baru</label>
                      <input 
                        type="password" 
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-4 text-on-surface font-bold focus:ring-2 focus:ring-secondary transition-all"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-on-surface-variant">Konfirmasi Password</label>
                      <input 
                        type="password" 
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-surface-container-highest border-none rounded-2xl py-4 px-4 text-on-surface font-bold focus:ring-2 focus:ring-secondary transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex flex-wrap gap-4">
                    <button 
                      onClick={handleUpdatePassword}
                      disabled={passwordLoading}
                      className="kinetic-gradient bg-secondary text-black font-black px-8 py-4 rounded-2xl active:scale-95 disabled:opacity-50 transition-all shadow-xl shadow-secondary/20 uppercase tracking-widest text-sm"
                    >
                      {passwordLoading ? 'Memproses...' : 'Ganti Password Sekarang'}
                    </button>
                    
                    <button 
                      onClick={async () => {
                        try {
                           const auth = getAuth();
                           if (auth.currentUser?.email) {
                             alert("Fitur Bantuan Keamanan sedang disiapkan. Sementara pakai ganti password langsung di atas ya Bang.");
                           }
                        } catch (err) {}
                      }}
                      className="bg-white/5 hover:bg-white/10 text-white font-bold px-8 py-4 rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-[10px] border border-white/10"
                    >
                      Bantuan Keamanan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Tarif' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">Manajemen Tarif</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Atur biaya dasar dan tarif per KM</p>
                </div>
                <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl md:rounded-3xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl md:text-3xl">payments</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ARO JEK */}
                <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#f3ffca]/10 rounded-2xl flex items-center justify-center text-[#f3ffca]">
                      <span className="material-symbols-outlined">moped</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white font-headline uppercase italic">Aro Jek</h4>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Layanan Transport Motor</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Dasar</label>
                        <input 
                          type="number" 
                          value={pricing?.jek?.baseFare || 0}
                          onChange={(e) => setServicePricing('jek', 'baseFare', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min Distance (KM)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={pricing?.jek?.minDistance || 0}
                          onChange={(e) => setServicePricing('jek', 'minDistance', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Per KM</label>
                        <input 
                          type="number" 
                          value={pricing?.jek?.ratePerKm || 0}
                          onChange={(e) => setServicePricing('jek', 'ratePerKm', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#f3ffca]">Bagi Hasil Admin (%)</label>
                        <input 
                          type="number" 
                          value={pricing?.jek?.commission || 0}
                          onChange={(e) => setServicePricing('jek', 'commission', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-primary font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ARO CAR */}
                <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined">directions_car</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white font-headline uppercase italic">Aro Car</h4>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Layanan Transport Mobil</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Dasar</label>
                        <input 
                          type="number" 
                          value={pricing?.car?.baseFare || 0}
                          onChange={(e) => setServicePricing('car', 'baseFare', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min Distance (KM)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={pricing?.car?.minDistance || 0}
                          onChange={(e) => setServicePricing('car', 'minDistance', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Per KM</label>
                        <input 
                          type="number" 
                          value={pricing?.car?.ratePerKm || 0}
                          onChange={(e) => setServicePricing('car', 'ratePerKm', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Bagi Hasil Admin (%)</label>
                        <input 
                          type="number" 
                          value={pricing?.car?.commission || 0}
                          onChange={(e) => setServicePricing('car', 'commission', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-secondary font-bold focus:ring-2 focus:ring-secondary"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ARO FOOD */}
                <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">restaurant</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white font-headline uppercase italic">Aro Food</h4>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Pengantaran Makanan</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Biaya Antar Dasar</label>
                        <input 
                          type="number" 
                          value={pricing?.food?.baseFare || 0}
                          onChange={(e) => setServicePricing('food', 'baseFare', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min Distance (KM)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={pricing?.food?.minDistance || 0}
                          onChange={(e) => setServicePricing('food', 'minDistance', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Per KM</label>
                        <input 
                          type="number" 
                          value={pricing?.food?.ratePerKm || 0}
                          onChange={(e) => setServicePricing('food', 'ratePerKm', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Bagi Hasil Admin (%)</label>
                        <input 
                          type="number" 
                          value={pricing?.food?.commission || 0}
                          onChange={(e) => setServicePricing('food', 'commission', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-primary font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ARO SEND */}
                <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined">package_2</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white font-headline uppercase italic">Aro Send</h4>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Kirim Barang / Paket</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Dasar</label>
                      <input 
                        type="number" 
                        value={pricing?.send?.baseFare || 0}
                        onChange={(e) => setServicePricing('send', 'baseFare', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif /KM</label>
                      <input 
                        type="number" 
                        value={pricing?.send?.ratePerKm || 0}
                        onChange={(e) => setServicePricing('send', 'ratePerKm', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Fee Admin (%)</label>
                      <input 
                        type="number" 
                        value={pricing?.send?.commission || 0}
                        onChange={(e) => setServicePricing('send', 'commission', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-secondary font-bold focus:ring-2 focus:ring-secondary"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min Distance (KM)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={pricing?.send?.minDistance || 0}
                        onChange={(e) => setServicePricing('send', 'minDistance', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Biaya Berat (+ per 2KG)</label>
                      <input 
                        type="number" 
                        value={pricing?.send?.weightFareRate || 0}
                        onChange={(e) => setServicePricing('send', 'weightFareRate', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* ARO SHOP (TIP) */}
                <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">shopping_cart</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white font-headline uppercase italic">Aro Tip</h4>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Belanja Titip / Jastip</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Biaya Jasa (Service Fee)</label>
                      <input 
                        type="number" 
                        value={pricing?.tip?.serviceFee || 0}
                        onChange={(e) => setServicePricing('tip', 'serviceFee', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Per KM</label>
                      <input 
                        type="number" 
                        value={pricing?.tip?.ratePerKm || 0}
                        onChange={(e) => setServicePricing('tip', 'ratePerKm', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif Berat (Per 2 KG)</label>
                        <input 
                          type="number" 
                          value={pricing?.tip?.weightFareRate || 0}
                          onChange={(e) => setServicePricing('tip', 'weightFareRate', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary">Fee Admin (%)</label>
                        <input 
                          type="number" 
                          value={pricing?.tip?.commission || 0}
                          onChange={(e) => setServicePricing('tip', 'commission', Number(e.target.value))}
                          className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-primary font-bold focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* BIAYA LAYANAN APLIKASI */}
                <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined">settings_suggest</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white font-headline uppercase italic">Biaya Layanan</h4>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Biaya Platform (Per Jarak)</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Jarak per Blok (KM)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={pricing?.appServiceFee?.blockDistance || 0}
                        onChange={(e) => setServicePricing('appServiceFee', 'blockDistance', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-[10px] text-on-surface-variant/60 italic">Contoh: 3 = per 3 KM</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Biaya per Blok (Rp)</label>
                      <input 
                        type="number" 
                        value={pricing?.appServiceFee?.feePerBlock || 0}
                        onChange={(e) => setServicePricing('appServiceFee', 'feePerBlock', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-[10px] text-on-surface-variant/60 italic">Contoh: 1000 = Rp 1.000 per blok</p>
                    </div>
                  </div>
                </div>

                {/* BIAYA PENJEMPUTAN (PICKUP DISTANCE SURCHARGE) */}
                <div className="bg-surface-container-low rounded-[2rem] p-8 border border-white/5 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center text-yellow-500">
                      <span className="material-symbols-outlined">map</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-white font-headline uppercase italic">Biaya Penjemputan</h4>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Kompensasi Jarak Jemput Driver</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Radius Gratis Penjemputan (KM)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={pricing?.pickupSurcharge?.freePickupRadius ?? 3}
                        onChange={(e) => setServicePricing('pickupSurcharge', 'freePickupRadius', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-[10px] text-on-surface-variant/60 italic">Batas jarak jemput tanpa biaya tambahan (Contoh: 3 = 3 KM)</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tarif per KM Surcharge (Rp)</label>
                      <input 
                        type="number" 
                        value={pricing?.pickupSurcharge?.ratePerKm ?? 2000}
                        onChange={(e) => setServicePricing('pickupSurcharge', 'ratePerKm', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-[10px] text-on-surface-variant/60 italic">Tarif tambahan per KM melebihi batas radius (Contoh: 2000 = Rp 2.000 / KM)</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Biaya Maksimal Surcharge (Rp)</label>
                      <input 
                        type="number" 
                        value={pricing?.pickupSurcharge?.maxFee ?? 15000}
                        onChange={(e) => setServicePricing('pickupSurcharge', 'maxFee', Number(e.target.value))}
                        className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-on-surface font-bold focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-[10px] text-on-surface-variant/60 italic">Batas atas total biaya penjemputan (Contoh: 15000 = Rp 15.000)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button 
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const pricingRef = doc(db, 'settings', 'pricing');
                      await setDoc(pricingRef, pricing, { merge: true });
                      alert('🔥 Berhasil! Semua tarif layanan sudah diperbarui.');
                    } catch (err) {
                      console.error(err);
                      alert('Gagal simpan tarif ke database: ' + err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full md:w-auto bg-primary text-black font-black px-12 py-5 rounded-2xl active:scale-95 transition-all shadow-2xl shadow-primary/30 uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3"
                >
                  <span className="material-symbols-outlined">{loading ? 'sync' : 'done_all'}</span>
                  {loading ? 'MENYIMPAN...' : 'SIMPAN SEMUA TARIF'}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'Users' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">User Management</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Kelola poin dan voucher member</p>
                </div>
                <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl md:rounded-3xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl md:text-3xl">group</span>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-[2rem] overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                        <th className="px-8 py-5">User</th>
                        <th className="px-4 py-5 text-center">Tipe</th>
                        <th className="px-4 py-5 text-center">Loyalty Points</th>
                        <th className="px-4 py-5 text-center">Active Vouchers</th>
                        <th className="px-8 py-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-8 py-20 text-center text-sm font-bold text-on-surface-variant uppercase tracking-widest italic opacity-50">Belum ada user terdaftar.</td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user.id} className="group hover:bg-white/5 transition-colors">
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center overflow-hidden border border-white/10">
                                  {user.photoURL ? (
                                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="material-symbols-outlined text-on-surface-variant">person</span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-white">{user.displayName || 'Anonymous'}</p>
                                  <p className="text-[10px] text-on-surface-variant uppercase font-mono">{user.email || user.id.slice(-8)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                user.isGuest ? 'bg-white/5 text-on-surface-variant' : 'bg-primary/10 text-primary'
                              }`}>
                                {user.isGuest ? 'Guest' : 'Member'}
                              </span>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <p className="font-black text-primary font-headline text-lg">{user.loyaltyPoints || 0} PTS</p>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-white">
                                {(user.vouchers?.filter(v => !v.used) || []).length} Vouchers
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => {
                                    setEditingUser(user);
                                    setShowEditUserModal(true);
                                  }}
                                  className="bg-white/5 text-white font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest border border-white/10 active:scale-90 transition-all hover:bg-primary hover:text-black hover:border-primary"
                                >
                                  Edit Loyalitas
                                </button>
                                <button 
                                  onClick={() => handleDeleteUser(user)}
                                  disabled={isDeleting === user.id}
                                  className="bg-error/10 text-error font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest border border-error/20 active:scale-90 transition-all hover:bg-error hover:text-black disabled:opacity-50 flex items-center justify-center"
                                >
                                  {isDeleting === user.id ? (
                                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                                  ) : (
                                    "Hapus"
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'Topups' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center bg-surface-container-low p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/5">
                <div>
                  <h3 className="text-2xl md:text-3xl font-black text-white font-headline tracking-tighter uppercase italic text-shadow-glow">Top-up Approval</h3>
                  <p className="text-sm text-on-surface-variant font-medium">Review permintaan saldo driver</p>
                </div>
                <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl md:rounded-3xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl md:text-3xl">account_balance_wallet</span>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-[2rem] overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant border-b border-white/5">
                        <th className="px-8 py-5">Driver</th>
                        <th className="px-4 py-5">Nominal</th>
                        <th className="px-4 py-5">Metode</th>
                        <th className="px-4 py-5 font-center">Status</th>
                        <th className="px-4 py-5">Waktu</th>
                        <th className="px-8 py-5 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {topupRequests.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-8 py-20 text-center text-sm font-bold text-on-surface-variant uppercase tracking-widest italic opacity-50">Belum ada permintaan top-up.</td>
                        </tr>
                      ) : (
                        topupRequests.map((req) => (
                          <tr key={req.id} className="group hover:bg-white/5 transition-colors">
                            <td className="px-8 py-5">
                              <p className="font-bold text-sm text-white">{req.driverName}</p>
                              <p className="text-[10px] text-on-surface-variant uppercase font-mono">{req.driverId.slice(-8)}</p>
                            </td>
                            <td className="px-4 py-5">
                              <p className="font-black text-primary font-headline">Rp {req.amount?.toLocaleString('id-ID')}</p>
                            </td>
                            <td className="px-4 py-5">
                                <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase text-on-surface-variant">{req.method}</span>
                            </td>
                            <td className="px-4 py-5">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                  req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                  req.status === 'approved' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
                                }`}>
                                  {req.status}
                                </span>
                            </td>
                            <td className="px-4 py-5 text-[10px] font-medium text-on-surface-variant">
                              {req.createdAt?.toDate().toLocaleString('id-ID')}
                            </td>
                            <td className="px-8 py-5 text-right">
                              {req.status === 'pending' && (
                                <div className="flex gap-2 justify-end">
                                  <button 
                                    onClick={() => handleApproveTopup(req)}
                                    className="bg-primary text-black font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest active:scale-90 transition-all"
                                  >
                                    Approve
                                  </button>
                                  <button 
                                    onClick={() => handleRejectTopup(req.id)}
                                    className="bg-error/10 text-error font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest border border-error/20 active:scale-90 transition-allHover:bg-error hover:text-white"
                                  >
                                    Tolak
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Speed Dial Action */}
      <button className="fixed bottom-8 right-8 h-16 w-16 bg-[rgba(38,38,38,0.6)] backdrop-blur-[24px] rounded-full shadow-2xl shadow-black flex items-center justify-center border border-white/10 group active:scale-90 transition-transform z-50">
        <span className="material-symbols-outlined text-primary text-3xl group-hover:rotate-12 transition-transform">bolt</span>
      </button>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedTransaction(null)}></div>
          <div className="relative w-full max-w-2xl bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic mb-1">
                  Detail Transaksi #{selectedTransaction.id.slice(-6).toUpperCase()}
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">Layanan: <span className="text-primary uppercase font-bold">{selectedTransaction.serviceType}</span></p>
              </div>
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-white">close</span>
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Customer</p>
                    <p className="text-sm font-bold text-white">{selectedTransaction.customer?.name || 'Guest'}</p>
                    <p className="text-xs text-on-surface-variant">{selectedTransaction.customer?.wa || selectedTransaction.customer?.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Status</p>
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase">{selectedTransaction.status}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Pembayaran</p>
                    <p className="text-sm font-bold text-white">{selectedTransaction.paymentMethod}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Waktu Selesai</p>
                    <p className="text-sm font-bold text-white">{selectedTransaction.completedAt?.toDate().toLocaleString('id-ID') || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Items List (Food/Shop Specific) */}
              {(selectedTransaction.serviceType === 'food' || selectedTransaction.serviceType === 'shop') && (
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em]">Daftar Item / Pesanan</p>
                  <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                    {selectedTransaction.items && Array.isArray(selectedTransaction.items) ? (
                      selectedTransaction.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div>
                            <p className="font-bold text-white">{item.name}</p>
                            <p className="text-[10px] text-on-surface-variant">Qty: {item.qty} | {item.merchantName}</p>
                          </div>
                          <p className="font-bold text-primary">Rp {(item.price * item.qty).toLocaleString('id-ID')}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-white italic">{selectedTransaction.items || "Tidak ada detail item"}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="pt-6 border-t border-white/5 space-y-3">
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Subtotal</span>
                  <span>Rp {selectedTransaction.subtotal?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Biaya Ongkir / Layanan</span>
                  <span>Rp {selectedTransaction.deliveryFee?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Biaya Jasa Admin (Fee)</span>
                  <span>Rp {selectedTransaction.serviceFee?.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-lg font-black text-primary font-headline pt-2">
                  <span className="uppercase italic">Total Akhir</span>
                  <span>Rp {selectedTransaction.total?.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            <div className="p-8 bg-zinc-900/50 flex gap-4">
              {selectedTransaction.status !== 'completed' && selectedTransaction.status !== 'cancelled' && selectedTransaction.status !== 'canceled' && (
                <button 
                  onClick={() => handleAdminCancelOrder(selectedTransaction)}
                  className="flex-1 bg-red-500/10 text-red-500 font-bold py-4 rounded-2xl hover:bg-red-500/20 transition-all uppercase tracking-widest text-xs border border-red-500/20"
                >
                  Batal Pesan
                </button>
              )}
              <button className="flex-1 bg-white/5 text-white font-bold py-4 rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs">Print Struk</button>
              <button 
                onClick={() => setSelectedTransaction(null)}
                className="flex-1 bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg hover:shadow-primary/20 active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      {showAddDriverModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddDriverModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">Pendaftaran Driver</h3>
              </div>
              <button onClick={() => setShowAddDriverModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white">close</span></button>
            </div>

            <form onSubmit={handleAddDriver} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nama Lengkap</label>
                <input required type="text" value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Budi Santoso" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email</label>
                  <input required type="email" value={newDriver.email} onChange={e => setNewDriver({...newDriver, email: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="driver@aro.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Password Default</label>
                  <input required type="password" value={newDriver.password} onChange={e => setNewDriver({...newDriver, password: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="******" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nomor WhatsApp</label>
                  <input required type="tel" value={newDriver.phone} onChange={e => setNewDriver({...newDriver, phone: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="0812..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Plat Nomor</label>
                  <input required type="text" value={newDriver.plateNumber} onChange={e => setNewDriver({...newDriver, plateNumber: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="AG 1234 XX" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tipe Kendaraan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewDriver({...newDriver, vehicleType: 'jek'})} className={`py-3 rounded-xl font-bold text-xs transition-all ${newDriver.vehicleType === 'jek' ? 'bg-primary text-black' : 'bg-white/5 text-white'}`}>ARO JEK (Motor)</button>
                  <button type="button" onClick={() => setNewDriver({...newDriver, vehicleType: 'car'})} className={`py-3 rounded-xl font-bold text-xs transition-all ${newDriver.vehicleType === 'car' ? 'bg-primary text-black' : 'bg-white/5 text-white'}`}>ARO CAR (Mobil)</button>
                </div>
              </div>

              <div className="pt-6">
                <button disabled={isAddingDriver} type="submit" className="w-full bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                  {isAddingDriver ? 'Mendaftarkan...' : 'Daftarkan Driver Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Merchant Modal */}
      {showAddMerchantModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddMerchantModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">Pendaftaran Merchant</h3>
              </div>
              <button onClick={() => setShowAddMerchantModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white">close</span></button>
            </div>

            <form onSubmit={handleAddMerchant} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nama Merchant</label>
                <input required type="text" value={newMerchant.name} onChange={e => setNewMerchant({...newMerchant, name: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Warung Barokah" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email (Login)</label>
                  <input required type="email" value={newMerchant.email} onChange={e => setNewMerchant({...newMerchant, email: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="merchant@aro.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Password Default</label>
                  <input required type="password" value={newMerchant.password} onChange={e => setNewMerchant({...newMerchant, password: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="******" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nomor WhatsApp</label>
                  <input required type="tel" value={newMerchant.phone} onChange={e => setNewMerchant({...newMerchant, phone: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="0812..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Kategori</label>
                  <select required value={newMerchant.category} onChange={e => setNewMerchant({...newMerchant, category: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white appearance-none">
                    <option value="makanan">Makanan</option>
                    <option value="minuman">Minuman</option>
                    <option value="camilan">Camilan</option>
                    <option value="bakso">Bakso</option>
                    <option value="seblak">Seblak</option>
                    <option value="nasi">Nasi</option>
                    <option value="mie">Mie</option>
                    <option value="ayam">Ayam</option>
                    <option value="toko">Toko / Shop</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tipe Merchant</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setNewMerchant({...newMerchant, type: 'food'})} className={`py-3 rounded-xl font-bold text-xs transition-all ${newMerchant.type === 'food' ? 'bg-primary text-black' : 'bg-white/5 text-white'}`}>ARO FOOD</button>
                    <button type="button" onClick={() => setNewMerchant({...newMerchant, type: 'shop'})} className={`py-3 rounded-xl font-bold text-xs transition-all ${newMerchant.type === 'shop' ? 'bg-primary text-black' : 'bg-white/5 text-white'}`}>ARO SHOP</button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Alamat / Lokasi</label>
                <input required type="text" value={newMerchant.address} onChange={e => setNewMerchant({...newMerchant, address: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Jl. Merdeka No. 10, Blitar" />
              </div>

              <div className="pt-6">
                <button disabled={isAddingMerchant} type="submit" className="w-full bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                  {isAddingMerchant ? 'Mendaftarkan...' : 'Daftarkan Merchant Sekarang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {showEditDriverModal && editingDriver && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowEditDriverModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">person_edit</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">Detail & Edit Driver</h3>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{editingDriver.id}</p>
                </div>
              </div>
              <button onClick={() => setShowEditDriverModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"><span className="material-symbols-outlined text-white">close</span></button>
            </div>

            <form onSubmit={handleUpdateDriver} className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-center mb-6">
                 <div className="relative group">
                    <img src={editingDriver.photoUrl || 'https://via.placeholder.com/150'} alt={editingDriver.name} className="w-24 h-24 rounded-3xl object-cover border-4 border-white/5 group-hover:border-primary/50 transition-all" />
                    <div className="absolute inset-0 bg-black/50 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer">
                      <span className="material-symbols-outlined text-white">photo_camera</span>
                    </div>
                 </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nama Lengkap</label>
                <input required type="text" value={editingDriver.name} onChange={e => setEditingDriver({...editingDriver, name: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Email</label>
                  <input required type="email" value={editingDriver.email} onChange={e => setEditingDriver({...editingDriver, email: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nomor WhatsApp</label>
                  <input required type="tel" value={editingDriver.phone} onChange={e => setEditingDriver({...editingDriver, phone: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Plat Nomor</label>
                  <input required type="text" value={editingDriver.plateNumber} onChange={e => setEditingDriver({...editingDriver, plateNumber: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary transition-all" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tipe Kendaraan</label>
                   <select 
                     value={editingDriver.vehicleType} 
                     onChange={e => setEditingDriver({...editingDriver, vehicleType: e.target.value})}
                     className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-primary transition-all"
                   >
                     <option value="jek">ARO JEK (Motor)</option>
                     <option value="car">ARO CAR (Mobil)</option>
                   </select>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setShowEditDriverModal(false)} className="flex-1 bg-white/5 text-white font-black py-4 rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs">
                  Batal
                </button>
                <button disabled={loading} type="submit" className="flex-2 bg-primary text-black font-black py-4 px-8 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                  {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div> : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowEditUserModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">military_tech</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">Loyalty Management</h3>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{editingUser.displayName || editingUser.id}</p>
                </div>
              </div>
              <button onClick={() => setShowEditUserModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-all"><span className="material-symbols-outlined text-white">close</span></button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Points Adjustment */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Update Loyalty Points</label>
                <div className="flex gap-4">
                  <input 
                    type="number" 
                    defaultValue={editingUser.loyaltyPoints || 0}
                    id="pointsInput"
                    className="flex-1 bg-surface-container-highest border-none rounded-xl py-4 px-6 text-xl font-black text-primary focus:ring-2 focus:ring-primary transition-all"
                  />
                  <button 
                    onClick={() => handleUpdateUserPoints(editingUser.id, document.getElementById('pointsInput').value)}
                    disabled={isSavingUser}
                    className="bg-primary text-black font-black px-8 rounded-xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                  >
                    Update
                  </button>
                </div>
              </div>

              <div className="h-px bg-white/5 w-full"></div>

              {/* Grant Voucher */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Grant Special Voucher</label>
                <div className="space-y-3">
                  {vouchers.length > 0 ? (
                    <select 
                      id="voucherTemplateSelect"
                      className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-6 text-sm font-bold text-white focus:ring-2 focus:ring-primary transition-all appearance-none"
                    >
                      {vouchers.map((v, i) => (
                        <option key={i} value={i}>{v.title} ({v.code || 'Tanpa Kode'})</option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      placeholder="Contoh: Voucher Kompensasi Delay"
                      id="voucherTitleInput"
                      className="w-full bg-surface-container-highest border-none rounded-xl py-4 px-6 text-sm font-bold text-white focus:ring-2 focus:ring-primary transition-all"
                    />
                  )}
                  <button 
                    onClick={() => {
                      if (vouchers.length > 0) {
                        const idx = document.getElementById('voucherTemplateSelect').value;
                        handleAddVoucherToUser(editingUser.id, vouchers[idx]);
                      } else {
                        handleAddVoucherToUser(editingUser.id, { title: document.getElementById('voucherTitleInput').value, type: 'FREE_DELIVERY', expiryDays: 30 });
                      }
                    }}
                    disabled={isSavingUser}
                    className="w-full bg-secondary text-black font-black py-4 rounded-xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">card_giftcard</span>
                    Berikan Voucher
                  </button>
                </div>
                <p className="text-[10px] text-on-surface-variant text-center font-medium italic">* Voucher yang diberikan otomatis berjenis GRATIS ONGKIR.</p>
              </div>

              {/* Current Vouchers List */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Voucher Saat Ini ({(editingUser.vouchers || []).length})</label>
                <div className="space-y-2">
                  {(editingUser.vouchers || []).length === 0 ? (
                    <p className="text-xs text-on-surface-variant italic">User tidak memiliki voucher.</p>
                  ) : (
                    editingUser.vouchers.map((v, i) => (
                      <div key={i} className={`p-3 rounded-xl border flex justify-between items-center ${v.used ? 'bg-white/5 border-white/5 opacity-50' : 'bg-primary/5 border-primary/20'}`}>
                        <div>
                          <p className="text-xs font-bold text-white">{v.title}</p>
                          <p className="text-[9px] text-on-surface-variant uppercase">{v.type} • {v.used ? 'TELAH DIGUNAKAN' : 'AKTIF'}</p>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant text-sm">{v.used ? 'check_circle' : 'confirmation_number'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAddBentoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddBentoModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">{editingBento !== null ? 'Edit Bento' : 'Tambah Bento'}</h3>
              <button onClick={() => setShowAddBentoModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white">close</span></button>
            </div>
            <form onSubmit={handleSaveBento} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Subtitle (Kecil)</label>
                  <input required type="text" value={newBento.subtitle} onChange={e => setNewBento({...newBento, subtitle: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Promo Terbatas" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Color (primary/secondary/etc)</label>
                  <select value={newBento.color} onChange={e => setNewBento({...newBento, color: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white appearance-none">
                    <option value="primary">Primary (Lime)</option>
                    <option value="secondary">Secondary (Amber)</option>
                    <option value="tertiary">Tertiary (Pink)</option>
                    <option value="error">Error (Red)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Judul Utama (Bisa pake \n untuk baris baru)</label>
                <textarea required rows="2" value={newBento.title} onChange={e => setNewBento({...newBento, title: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Makan Enak&#10;Diskon 20%"></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Icon (Material Symbol)</label>
                  <input required type="text" value={newBento.icon} onChange={e => setNewBento({...newBento, icon: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="star" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Target Link (Optional)</label>
                  <input type="text" value={newBento.link} onChange={e => setNewBento({...newBento, link: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="/food" />
                </div>
              </div>
              <div className="pt-6">
                <button disabled={loading} type="submit" className="w-full bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                  {loading ? 'Menyimpan...' : 'Simpan Bento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showAddBannerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddBannerModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-white/5 flex justify-between items-start">
              <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">Tambah Banner</h3>
              <button onClick={() => setShowAddBannerModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white">close</span></button>
            </div>
            <form onSubmit={handleAddBanner} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Judul Banner</label>
                <input required type="text" value={newBanner.title} onChange={e => setNewBanner({...newBanner, title: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Promo Gajian..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Target Link</label>
                <input required type="text" value={newBanner.link} onChange={e => setNewBanner({...newBanner, link: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="/food" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Target Audience</label>
                <select 
                  value={newBanner.targetAudience} 
                  onChange={e => setNewBanner({...newBanner, targetAudience: e.target.value})}
                  className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white appearance-none"
                >
                  <option value="all">Semua Pengguna</option>
                  <option value="member">Member Saja</option>
                  <option value="guest">Guest Saja</option>
                </select>
              </div>
              <div className="pt-6">
                <button disabled={loading} type="submit" className="w-full bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                  {loading ? 'Menyimpan...' : 'Buat Banner'}
                </button>
              </div>
              <p className="text-[10px] text-on-surface-variant text-center mt-2 px-4 italic">
                * Setelah dibuat, silakan ganti gambar pada daftar banner.
              </p>
            </form>
          </div>
        </div>
      )}
      {/* Menu Gallery Modal */}
      {showMenuGalleryModal && selectedMerchantMenu && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => { setShowMenuGalleryModal(false); setSelectedMerchantMenu(null); }}></div>
          <div className="relative w-full max-w-4xl bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-white/5 flex justify-between items-start flex-shrink-0">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic mb-1">
                  Foto Menu: {selectedMerchantMenu.name}
                </h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  Total: <span className="text-primary font-bold">
                    {1 + (selectedMerchantMenu.menu_thumbnails?.length || 0)} Foto
                  </span>
                </p>
              </div>
              <button 
                onClick={() => { setShowMenuGalleryModal(false); setSelectedMerchantMenu(null); }}
                className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-white">close</span>
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {/* Original Image */}
                {selectedMerchantMenu.originalMenuImage && (
                  <div className="group relative aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all">
                    <img 
                      src={selectedMerchantMenu.originalMenuImage} 
                      alt="Menu Utama" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/300x400?text=Gambar+Error';
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex items-end justify-between">
                      <span className="text-[10px] bg-primary text-black font-black px-2 py-1 rounded uppercase">Utama</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleDeleteMenuPhoto(selectedMerchantMenu.id, selectedMerchantMenu.originalMenuImage, true)}
                          className="w-8 h-8 bg-error/20 backdrop-blur-md rounded-full flex items-center justify-center text-error opacity-0 group-hover:opacity-100 hover:bg-error hover:text-white transition-all border border-error/30"
                          title="Hapus Foto Utama"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                        <button 
                          onClick={() => window.open(selectedMerchantMenu.originalMenuImage, '_blank')}
                          className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-all"
                        >
                          <span className="material-symbols-outlined text-xs">open_in_new</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thumbnails */}
                {selectedMerchantMenu.menu_thumbnails && selectedMerchantMenu.menu_thumbnails.map((thumbUrl, index) => (
                  <div key={index} className="group relative aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all">
                    <img 
                      src={thumbUrl} 
                      alt={`Menu ${index + 1}`} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/300x400?text=Gambar+Error';
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex items-end justify-between">
                      <button 
                        onClick={() => handleDeleteMenuPhoto(selectedMerchantMenu.id, thumbUrl, false)}
                        className="w-8 h-8 bg-error/20 backdrop-blur-md rounded-full flex items-center justify-center text-error opacity-0 group-hover:opacity-100 hover:bg-error hover:text-white transition-all border border-error/30"
                        title="Hapus Foto"
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                      </button>
                      <button 
                        onClick={() => window.open(thumbUrl, '_blank')}
                        className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-all"
                      >
                        <span className="material-symbols-outlined text-xs">open_in_new</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-zinc-900/50 border-t border-white/5 flex justify-end flex-shrink-0">
              <button 
                onClick={() => { setShowMenuGalleryModal(false); setSelectedMerchantMenu(null); }}
                className="px-6 py-3 bg-white/5 text-white font-black rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs border border-white/10"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Voucher Modal */}
      {showAddVoucherModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddVoucherModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-white/5 flex justify-between items-start flex-shrink-0">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">{editingVoucher !== null ? 'Edit Voucher' : 'Buat Voucher Baru'}</h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Template Promosi Platform</p>
              </div>
              <button onClick={() => setShowAddVoucherModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white">close</span></button>
            </div>

            <form onSubmit={handleSaveVoucher} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Kode Voucher (Opsional)</label>
                  <input type="text" value={newVoucher.code} onChange={e => setNewVoucher({...newVoucher, code: e.target.value.toUpperCase()})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="PROMO2024" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Tipe Diskon</label>
                  <select value={newVoucher.type} onChange={e => setNewVoucher({...newVoucher, type: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white appearance-none">
                    <option value="FREE_DELIVERY">Gratis Ongkir</option>
                    <option value="PERCENTAGE">Persentase (%)</option>
                    <option value="FLAT">Potongan Harga (Rp)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Judul Voucher</label>
                <input required type="text" value={newVoucher.title} onChange={e => setNewVoucher({...newVoucher, title: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Potongan Spesial 10rb" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Nilai Diskon</label>
                  <input required type="number" value={newVoucher.value} onChange={e => setNewVoucher({...newVoucher, value: Number(e.target.value)})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Min. Order (Rp)</label>
                  <input required type="number" value={newVoucher.minOrder} onChange={e => setNewVoucher({...newVoucher, minOrder: Number(e.target.value)})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Masa Berlaku (Hari)</label>
                  <input required type="number" value={newVoucher.expiryDays} onChange={e => setNewVoucher({...newVoucher, expiryDays: Number(e.target.value)})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input type="checkbox" checked={newVoucher.active} onChange={e => setNewVoucher({...newVoucher, active: e.target.checked})} className="w-5 h-5 rounded bg-surface-container-highest border-none text-primary focus:ring-0" />
                  <label className="text-xs font-bold text-white uppercase tracking-widest">Aktif</label>
                </div>
              </div>

              <div className="pt-6">
                <button disabled={loading} type="submit" className="w-full kinetic-gradient bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                  {loading ? 'Menyimpan...' : 'Simpan Template Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Bento Modal */}
      {showAddBentoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddBentoModal(false)}></div>
          <div className="relative w-full max-w-lg bg-[#0e0e0e] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-white/5 flex justify-between items-start flex-shrink-0">
              <div>
                <h3 className="text-2xl font-black text-white font-headline tracking-tighter uppercase italic">{editingBento !== null ? 'Edit Bento Promo' : 'Tambah Bento Promo'}</h3>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Grid Promo Home User</p>
              </div>
              <button onClick={() => setShowAddBentoModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white">close</span></button>
            </div>

            <form onSubmit={handleSaveBento} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Judul Utama</label>
                <input required type="text" value={newBento.title} onChange={e => setNewBento({...newBento, title: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Contoh: Diskon Makan Siang" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Subtitle (Atas)</label>
                <input required type="text" value={newBento.subtitle} onChange={e => setNewBento({...newBento, subtitle: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="Contoh: HEMAT 50%" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Icon (Material Symbol)</label>
                  <input required type="text" value={newBento.icon} onChange={e => setNewBento({...newBento, icon: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="star, restaurant, etc" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Warna Tema</label>
                  <select value={newBento.color} onChange={e => setNewBento({...newBento, color: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white appearance-none">
                    <option value="primary">Neon Lime (Primary)</option>
                    <option value="secondary">Soft Yellow (Secondary)</option>
                    <option value="error">Bright Red (Error)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Deep Link (Optional)</label>
                <input type="text" value={newBento.link} onChange={e => setNewBento({...newBento, link: e.target.value})} className="w-full bg-surface-container-highest border-none rounded-xl py-3 px-4 text-white" placeholder="/promo/detail-123" />
              </div>

              <div className="pt-6">
                <button disabled={loading} type="submit" className="w-full bg-primary text-black font-black py-4 rounded-2xl hover:shadow-lg active:scale-95 transition-all uppercase tracking-widest text-sm">
                  {loading ? 'Menyimpan...' : 'Simpan Bento Promo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;
