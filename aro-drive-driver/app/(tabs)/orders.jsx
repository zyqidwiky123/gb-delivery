import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useDriverStore } from '../../src/store/useDriverStore';
import { fetchHistoryOrders } from '../../src/firebase/orderService';
import { observeDriverBalance } from '../../src/firebase/walletService';
import OrderCard from '../../src/components/OrderCard';
import { FileText, RefreshCw } from 'lucide-react-native';

export default function OrdersScreen() {
  const user = useDriverStore((state) => state.user);
  const uid = user?.uid;
  const [orders, setOrders] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastDocRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);

  const PAGE_SIZE = 10;

  const loadOrders = useCallback(async (isRefresh = false) => {
    if (!uid) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (!lastDocRef.current) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const { orders: newOrders, lastDoc: newLastDoc } = await fetchHistoryOrders(
        uid, 
        PAGE_SIZE, 
        isRefresh ? null : lastDocRef.current
      );

      if (isRefresh) {
        setOrders(newOrders);
      } else {
        setOrders(prev => [...prev, ...newOrders]);
      }
      
      lastDocRef.current = newLastDoc;
      setHasMore(newOrders.length === PAGE_SIZE);

    } catch (error) {
      console.error("Failed to load history orders:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [uid]);

  useEffect(() => {
    let unsubscribeBalance;
    if (uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadOrders(true); // Load first page on mount or when driver changes
      unsubscribeBalance = observeDriverBalance(uid, (newBalance) => {
        setBalance(newBalance);
      });
    }
    return () => {
      if (unsubscribeBalance) unsubscribeBalance();
    };
  }, [uid, loadOrders]);

  const onRefresh = useCallback(() => {
    loadOrders(true);
  }, [loadOrders]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadOrders();
    }
  };

  const renderEmptyComponent = () => {
    if (loading) return null;
    return (
      <View className="flex-1 items-center justify-center pt-32">
        <View className="bg-zinc-900 p-6 rounded-full mb-4">
          <FileText size={48} color="#52525b" />
        </View>
        <Text className="text-zinc-300 font-bold text-lg mb-2">Belum Ada Riwayat</Text>
        <Text className="text-zinc-500 text-center px-8">
          Anda belum memiliki riwayat pesanan selesai atau dibatalkan saat ini.
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return <View className="h-20" />;
    return (
      <View className="h-20 items-center justify-center">
        <ActivityIndicator size="small" color="#10b981" />
      </View>
    );
  };

  if (loading && !refreshing && orders.length === 0) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950">
      <View className="pt-12 pb-4 px-4 bg-zinc-900 border-b border-zinc-800 flex-row justify-between items-center">
        <Text className="text-white font-bold text-2xl italic">RIWAYAT</Text>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity 
            onPress={onRefresh}
            className="flex-row items-center px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
          >
            <RefreshCw size={14} color="#10b981" />
          </TouchableOpacity>
          <View className="bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-700 flex-row items-center gap-2">
            <Text className="text-[10px] font-bold text-zinc-400">SALDO:</Text>
            <Text className="text-sm font-black text-white">Rp {balance.toLocaleString('id-ID')}</Text>
          </View>
        </View>
      </View>
      
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OrderCard 
            order={item} 
            onPress={() => {
              // TODO: Navigate to Order Detail if needed
              console.log('Pressed order', item.id);
            }} 
          />
        )}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
        ListEmptyComponent={renderEmptyComponent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}
