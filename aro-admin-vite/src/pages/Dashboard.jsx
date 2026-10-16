import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { db } from '@aro/shared/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import DashboardLayout from './DashboardLayout';
import DashboardOverview from './DashboardOverview';
import MerchantManagement from './MerchantManagement';
import DriverManagement from './DriverManagement';
import TransactionHistory from './TransactionHistory';
import BannerManagement from './BannerManagement';
import PromotionManagement from './PromotionManagement';
import PricingSettings from './PricingSettings';
import UserManagement from './UserManagement';
import TopupManagement from './TopupManagement';

function Dashboard() {
  const [activeTab, setActiveTab] = useState('Overview');
  const navigate = useNavigate();
  const {
    setAdminUser,
    setAllPricing,
    setBanners,
    setDrivers,
    setTransactions,
    setTopupRequests,
    setUsers,
  } = useAdminStore();

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
    const unsubTransactions = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    const unsubDrivers = onSnapshot(
      query(collection(db, 'drivers'), orderBy('name', 'asc')),
      (snapshot) => {
        setDrivers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    const unsubBanners = onSnapshot(collection(db, 'banners'), (snapshot) => {
      setBanners(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    const unsubTopups = onSnapshot(
      query(collection(db, 'topup_requests'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setTopupRequests(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    const unsubUsers = onSnapshot(
      query(collection(db, 'users'), orderBy('loyaltyPoints', 'desc')),
      (snapshot) => {
        setUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    return () => {
      unsubTransactions();
      unsubDrivers();
      unsubBanners();
      unsubTopups();
      unsubUsers();
    };
  }, []);

  const handleNavigate = (tab) => setActiveTab(tab);

  const renderPage = () => {
    switch (activeTab) {
      case 'Overview':
        return <DashboardOverview onNavigate={handleNavigate} />;
      case 'Food':
        return <MerchantManagement />;
      case 'Drivers':
        return <DriverManagement />;
      case 'Transactions':
        return <TransactionHistory />;
      case 'Banners':
        return <BannerManagement />;
      case 'Promos':
        return <PromotionManagement />;
      case 'Settings':
      case 'Tarif':
        return <PricingSettings />;
      case 'Users':
        return <UserManagement />;
      case 'Topups':
        return <TopupManagement />;
      default:
        return <DashboardOverview onNavigate={handleNavigate} />;
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderPage()}
    </DashboardLayout>
  );
}

export default Dashboard;
