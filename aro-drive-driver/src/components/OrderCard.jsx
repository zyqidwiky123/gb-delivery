import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react-native';

export default function OrderCard({ order, onPress }) {
  const { 
    id, 
    serviceType, 
    status, 
    total, 
    deliveryFee, 
    createdAt,
    completedAt
  } = order;

  // Format date
  const timestamp = completedAt || createdAt;
  const dateObj = timestamp ? new Date(timestamp.toMillis ? timestamp.toMillis() : timestamp) : new Date();
  
  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // Status colors & icons
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  
  const statusColor = isCompleted ? 'text-emerald-500' : isCancelled ? 'text-red-500' : 'text-gray-400';
  const bgStatusColor = isCompleted ? 'bg-emerald-500/10' : isCancelled ? 'bg-red-500/10' : 'bg-gray-500/10';
  
  const StatusIcon = isCompleted ? CheckCircle2 : isCancelled ? AlertCircle : Clock;

  // Money format
  const formattedTotal = (total || deliveryFee || 0).toLocaleString('id-ID');

  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.7}
      className="bg-zinc-900 rounded-2xl mb-4 border border-zinc-800 overflow-hidden"
    >
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 border-b border-zinc-800">
        <View className="flex-row items-center gap-2">
          <View className="bg-primary/20 p-2 rounded-lg">
            <Text className="text-primary font-bold text-xs uppercase">
              {serviceType || 'ARO-JEK'}
            </Text>
          </View>
          <Text className="text-zinc-400 text-xs">#{id.slice(-6).toUpperCase()}</Text>
        </View>
        <View className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full ${bgStatusColor}`}>
          <StatusIcon size={12} color={isCompleted ? '#10b981' : isCancelled ? '#ef4444' : '#9ca3af'} />
          <Text className={`text-xs font-semibold ${statusColor} capitalize`}>
            {status}
          </Text>
        </View>
      </View>

      {/* Body: Customer Details */}
      <View className="p-4 gap-1">
        <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Detail Kustomer</Text>
        <Text className="text-zinc-200 text-sm font-bold">
          {order.customer?.name} {order.customer?.isGuest ? '(Guest)' : ''}
        </Text>
        {order.customer?.phone && (
          <Text className="text-zinc-400 text-xs mt-1">{order.customer.phone}</Text>
        )}
      </View>

      {/* Footer */}
      <View className="flex-row justify-between items-center p-4 bg-zinc-950/50">
        <View className="flex-col justify-center">
           <Text className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Biaya</Text>
           <Text className="text-white font-black text-lg mt-0.5">Rp {formattedTotal}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Clock size={14} color="#9ca3af" />
          <Text className="text-zinc-400 text-xs">
            {formatDate(dateObj)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
