import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Linking, Alert } from 'react-native';
import { Wallet as WalletIcon, CreditCard, ArrowDownCircle, Info, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useDriverStore } from '../../src/store/useDriverStore';
import { listenForCompletedOrders } from '../../src/firebase/orderService';
import { observeDriverBalance } from '../../src/firebase/walletService';
import TopUpModal from '../../src/components/TopUpModal';
import { db } from '../../src/firebase/config';
import { doc, getDoc } from 'firebase/firestore';

export default function WalletScreen() {
  const { user, profile } = useDriverStore();
  const [completedOrders, setCompletedOrders] = useState([]);
  const [balance, setBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [expandedDates, setExpandedDates] = useState({});
  const [adminWhatsapp, setAdminWhatsapp] = useState("6285748343842");

  useEffect(() => {
    let unsubscribeOrders;
    let unsubscribeBalance;

    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'general'));
        if (snap.exists() && snap.data().whatsapp) {
          setAdminWhatsapp(snap.data().whatsapp);
        }
      } catch (err) {
        console.warn("Failed to fetch admin whatsapp", err);
      }
    };
    fetchSettings();

    if (user?.uid) {
      unsubscribeOrders = listenForCompletedOrders(user.uid, (orders) => {
        setCompletedOrders(orders);
      });
      unsubscribeBalance = observeDriverBalance(user.uid, (newBalance) => {
        setBalance(newBalance);
      });
    }

    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeBalance) unsubscribeBalance();
    };
  }, [user?.uid]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Since listeners are active, we just wait a bit to simulate refresh feeling
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleWithdraw = async () => {
    if (balance <= 0) {
      Alert.alert("Gagal", "Saldo tidak cukup untuk ditarik.");
      return;
    }
    const driverName = profile?.name || 'Driver';
    const waNumber = adminWhatsapp;
    const message = `Halo Admin ARO DRIVE, saya mau Tarik Tunai.\n\nID Driver: ${user?.uid}\nNama: ${driverName}\nSaldo Saat Ini: Rp ${balance.toLocaleString('id-ID')}\n\nMohon bantuannya untuk proses pencairan dana.`;
    const waLink = `whatsapp://send?phone=${waNumber}&text=${encodeURIComponent(message)}`;

    const canOpen = await Linking.canOpenURL(waLink);
    if (canOpen) {
      await Linking.openURL(waLink);
    } else {
      await Linking.openURL(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`);
    }
  };

  const toggleExpand = (dateStr) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  // Calculations
  const today = new Date().toISOString().split('T')[0];
  const dailyStats = useMemo(() => {
    return completedOrders.reduce((acc, order) => {
      if (!order.completedAt) return acc;

      const dateObj = order.completedAt.toDate ? order.completedAt.toDate() : new Date(order.completedAt.toMillis ? order.completedAt.toMillis() : order.completedAt);
      const dateStr = dateObj.toISOString().split('T')[0];

      const delivery = (order.deliveryFee !== undefined)
        ? Number(order.deliveryFee || 0)
        : (Number(order.total || 0) - Number(order.actualShoppingCost || 0));

      const gross = delivery + Number(order.subsidizedFee || 0);
      const platformFee = Number(order.platformFee || 0);
      const net = gross - platformFee;

      if (!acc[dateStr]) {
        acc[dateStr] = {
          totalNet: 0,
          count: 0,
          dateObj: dateObj,
          orders: []
        };
      }
      acc[dateStr].totalNet += net;
      acc[dateStr].count += 1;
      acc[dateStr].orders.push({
        ...order,
        net: net,
        gross: gross,
        delivery: delivery,
        shopping: Number(order.actualShoppingCost || order.subtotal || 0),
        appFee: Number(order.appServiceFee || 0),
        commission: platformFee
      });
      return acc;
    }, {});
  }, [completedOrders]);

  const dailyHistory = useMemo(() => {
    return Object.entries(dailyStats)
      .map(([dateStr, stats]) => ({ dateStr, ...stats }))
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [dailyStats]);

  const todayEarnings = dailyStats[today]?.totalNet || 0;

  const monthlyEarnings = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return completedOrders.reduce((sum, order) => {
      if (!order.completedAt) return sum;
      const dateObj = order.completedAt.toDate ? order.completedAt.toDate() : new Date(order.completedAt.toMillis ? order.completedAt.toMillis() : order.completedAt);
      if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
        const delivery = (order.deliveryFee !== undefined)
          ? Number(order.deliveryFee || 0)
          : (Number(order.total || 0) - Number(order.actualShoppingCost || 0));

        const gross = delivery + Number(order.subsidizedFee || 0);
        const net = gross - (Number(order.platformFee || 0));
        return sum + net;
      }
      return sum;
    }, 0);
  }, [completedOrders]);

  return (
    <ScrollView
      className="flex-1 bg-zinc-950"
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />
      }
    >
      {/* Header Profile Info */}
      <View className="px-6 pt-16 pb-6">
        <View className="flex-row justify-between items-start mb-6">
          <View>
            <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
              Saldo ARO-Credit
            </Text>
            <View className="flex-row items-baseline gap-1">
              <Text className="text-xl font-bold text-zinc-500">Rp</Text>
              <Text className="text-5xl font-black text-white tracking-tighter">
                {(balance || 0).toLocaleString('id-ID')}
              </Text>
            </View>
          </View>
          <View className="w-12 h-12 bg-zinc-900 rounded-2xl items-center justify-center border border-zinc-800">
            <WalletIcon size={24} color="#a1a1aa" />
          </View>
        </View>

        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-[10px] uppercase font-bold tracking-[0.1em] text-zinc-500">
              ID Driver
            </Text>
            <Text className="text-sm font-bold text-zinc-300 uppercase tracking-widest mt-1">
              {user?.uid?.slice(-10) || 'UNKNOWN'}
            </Text>
          </View>
          {balance <= 10000 && (
            <View className="bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded-full flex-row items-center gap-1.5">
              <AlertTriangle size={12} color="#ef4444" />
              <Text className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                Saldo Rendah
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View className="px-6 flex-row gap-4 mb-6">
        <TouchableOpacity
          onPress={() => setShowTopupModal(true)}
          className="flex-1 bg-zinc-900 border border-zinc-800 border-b-4 border-b-emerald-500/20 py-4 rounded-3xl items-center justify-center"
        >
          <View className="w-10 h-10 rounded-xl bg-emerald-500/10 items-center justify-center mb-2">
            <CreditCard size={20} color="#10b981" />
          </View>
          <Text className="font-black text-[10px] uppercase tracking-[0.1em] text-white">Top Up Saldo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleWithdraw}
          className="flex-1 bg-zinc-900 border border-zinc-800 border-b-4 border-b-zinc-800 py-4 rounded-3xl items-center justify-center"
        >
          <View className="w-10 h-10 rounded-xl bg-zinc-800 items-center justify-center mb-2">
            <ArrowDownCircle size={20} color="#a1a1aa" />
          </View>
          <Text className="font-black text-[10px] uppercase tracking-[0.1em] text-white">Tarik Tunai</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View className="px-6 flex-row gap-3 mb-4">
        <View className="flex-1 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 items-center">
          <Text className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Hari Ini</Text>
          <Text className="text-sm font-bold text-white">Rp {todayEarnings.toLocaleString('id-ID')}</Text>
        </View>
        <View className="flex-1 bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 items-center">
          <Text className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1">Bulan Ini</Text>
          <Text className="text-sm font-bold text-emerald-500">Rp {monthlyEarnings.toLocaleString('id-ID')}</Text>
        </View>
      </View>

      {/* Info Card */}
      <View className="px-6 mb-6">
        <View className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex-row items-center gap-3">
          <Info size={20} color="#10b981" />
          <Text className="flex-1 text-xs text-zinc-400 font-medium leading-relaxed">
            Saldo otomatis dikurangi setiap pesanan selesai. Top-up saldo untuk terus menerima order.
          </Text>
        </View>
      </View>

      {/* History */}
      <View className="px-6">
        <View className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6">
          <Text className="font-bold text-lg text-white uppercase italic tracking-tighter mb-6">
            Riwayat Pendapatan Harian
          </Text>

          {dailyHistory.length === 0 ? (
            <View className="items-center py-8">
              <Clock size={32} color="#52525b" className="mb-3" />
              <Text className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Belum ada riwayat
              </Text>
            </View>
          ) : (
            dailyHistory.map((item, idx) => {
              const d = item.dateObj;
              const formattedDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
              const isExpanded = !!expandedDates[item.dateStr];

              return (
                <View key={item.dateStr} className="mb-2">
                  <TouchableOpacity
                    onPress={() => toggleExpand(item.dateStr)}
                    className={`flex-row items-center justify-between p-3 rounded-2xl ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-950/50'}`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className={`w-10 h-10 rounded-xl items-center justify-center ${isExpanded ? 'bg-emerald-500' : 'bg-emerald-500/10'}`}>
                        {isExpanded ? (
                          <ChevronUp size={20} color="#000" />
                        ) : (
                          <ChevronDown size={20} color="#10b981" />
                        )}
                      </View>
                      <View>
                        <Text className="font-black text-xs text-white uppercase tracking-tight">
                          {formattedDate}
                        </Text>
                        <Text className="text-[10px] text-zinc-400 font-mono mt-0.5">
                          {item.count} Pesanan Selesai
                        </Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="font-black text-sm text-emerald-500">
                        +Rp {item.totalNet.toLocaleString('id-ID')}
                      </Text>
                      <Text className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mt-0.5">
                        Total Bersih
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Items */}
                  {isExpanded && (
                    <View className="pl-4 mt-2 mb-2">
                      {item.orders.map((ord, oIdx) => {
                        const ordDate = ord.completedAt?.toDate
                          ? ord.completedAt.toDate()
                          : new Date(ord.completedAt?.toMillis ? ord.completedAt.toMillis() : ord.completedAt);

                        return (
                          <View key={ord.id || oIdx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-3">
                            <View className="flex-row justify-between items-center mb-3 pb-2 border-b border-zinc-800">
                              <Text className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                                #{ord.id?.slice(-5)} - {ord.serviceType?.toUpperCase() || 'ARO-JEK'}
                              </Text>
                              <Text className="text-[10px] font-bold text-zinc-500">
                                {ordDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>

                            <View className="flex-row flex-wrap mb-3">
                              <View className="w-1/2 mb-2">
                                <Text className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">Total Belanja</Text>
                                <Text className="text-[11px] font-bold text-white">Rp {ord.shopping.toLocaleString('id-ID')}</Text>
                              </View>
                              <View className="w-1/2 mb-2 items-end">
                                <Text className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">Biaya (Admin)</Text>
                                <Text className="text-[11px] font-bold text-white">Rp {ord.appFee.toLocaleString('id-ID')}</Text>
                              </View>
                              <View className="w-1/2">
                                <Text className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">Ongkir Murni</Text>
                                <Text className="text-[11px] font-bold text-emerald-500">Rp {(ord.delivery - ord.appFee).toLocaleString('id-ID')}</Text>
                              </View>
                              <View className="w-1/2 items-end">
                                <Text className="text-[8px] text-red-500/60 uppercase font-bold tracking-widest mb-0.5">Dipotong (Saldo)</Text>
                                <Text className="text-[11px] font-bold text-red-500">-Rp {ord.commission.toLocaleString('id-ID')}</Text>
                              </View>
                            </View>

                            <View className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 flex-row justify-between items-center mb-2">
                              <Text className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Pendapatan Bersih</Text>
                              <Text className="text-sm font-black text-emerald-500 italic">Rp {ord.net.toLocaleString('id-ID')}</Text>
                            </View>

                            {ord.balanceBefore !== undefined && (
                              <View className="bg-zinc-800/50 rounded-xl p-2 px-3 flex-row justify-between items-center border border-zinc-800">
                                <View>
                                  <Text className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Saldo Awal</Text>
                                  <Text className="text-[10px] font-bold text-zinc-300">Rp {ord.balanceBefore.toLocaleString('id-ID')}</Text>
                                </View>
                                <Text className="text-zinc-600">→</Text>
                                <View className="items-end">
                                  <Text className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Akhir</Text>
                                  <Text className="text-[10px] font-black text-white">Rp {ord.balanceAfter.toLocaleString('id-ID')}</Text>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {idx < dailyHistory.length - 1 && <View className="h-[1px] bg-zinc-800 mx-2 mt-2" />}
                </View>
              );
            })
          )}
        </View>
      </View>

      <TopUpModal
        visible={showTopupModal}
        onClose={() => setShowTopupModal(false)}
        user={user}
        profile={profile}
        adminWhatsapp={adminWhatsapp}
      />
    </ScrollView>
  );
}
