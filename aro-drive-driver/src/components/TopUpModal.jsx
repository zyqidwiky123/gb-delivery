import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking } from 'react-native';
import { X, AlertTriangle, Send } from 'lucide-react-native';
import { requestTopup } from '../firebase/walletService';

export default function TopUpModal({ visible, onClose, user, profile, adminWhatsapp = "6285748343842" }) {
  const [topupAmount, setTopupAmount] = useState('10000');
  const [loading, setLoading] = useState(false);

  const presets = ['10000', '50000', '100000'];

  const handleSubmit = async () => {
    const amountNum = Number(topupAmount);
    if (amountNum < 10000) {
      Alert.alert("Error", "Minimal top-up adalah Rp 10.000");
      return;
    }

    setLoading(true);
    try {
      const driverName = profile?.name || 'Driver';
      const requestId = await requestTopup(user.uid, driverName, amountNum, 'Manual Bank/QRIS');
      
      // WhatsApp Integration
      const waNumber = adminWhatsapp; // Dynamic Admin Number
      const message = `Halo Admin ARO DRIVE, saya mau Top-up Saldo.\n\nID Driver: ${user.uid}\nNama: ${driverName}\nNominal: Rp ${amountNum.toLocaleString('id-ID')}\nID Request: ${requestId}\n\nMohon bantuannya untuk verifikasi bukti transfer saya.`;
      const waLink = `whatsapp://send?phone=${waNumber}&text=${encodeURIComponent(message)}`;
      
      const canOpen = await Linking.canOpenURL(waLink);
      if (canOpen) {
        await Linking.openURL(waLink);
      } else {
        // Fallback to web WhatsApp if native app is not installed
        await Linking.openURL(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`);
      }
      
      onClose();
      Alert.alert("Berhasil", "Permintaan dikirim! Silakan kirim bukti transfer ke WhatsApp Admin yang baru saja terbuka.");
    } catch (error) {
      console.error("Topup Error:", error);
      Alert.alert("Gagal", `Gagal mengirim permintaan top-up: ${error.message || 'Cek koneksi internet Anda.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/80">
        <View className="bg-zinc-900 rounded-t-[3rem] p-8 border-t border-zinc-800">
          <View className="flex-row justify-between items-start mb-8">
            <View>
              <Text className="text-2xl font-black text-white italic">TOP UP SALDO</Text>
              <Text className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mt-1">
                Konfirmasi via WhatsApp
              </Text>
            </View>
            <TouchableOpacity 
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-zinc-800 items-center justify-center"
            >
              <X size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          <View className="space-y-6">
            <View className="space-y-3">
              <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                Nominal Top-up
              </Text>
              <View className="relative justify-center">
                <Text className="absolute left-6 text-primary font-bold z-10 text-xl">Rp</Text>
                <TextInput
                  value={topupAmount}
                  onChangeText={setTopupAmount}
                  keyboardType="numeric"
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-14 pr-6 text-xl font-black text-white"
                  placeholderTextColor="#52525b"
                />
              </View>
              <View className="flex-row gap-2 mt-3">
                {presets.map(amt => (
                  <TouchableOpacity
                    key={amt}
                    onPress={() => setTopupAmount(amt)}
                    className={`flex-1 py-3 rounded-xl border items-center ${
                      topupAmount === amt 
                        ? 'bg-emerald-500/20 border-emerald-500' 
                        : 'bg-zinc-800 border-zinc-700'
                    }`}
                  >
                    <Text className={`text-[12px] font-black ${
                      topupAmount === amt ? 'text-emerald-500' : 'text-zinc-400'
                    }`}>
                      {Number(amt) / 1000}k
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="bg-zinc-800/50 p-4 rounded-2xl border border-zinc-800">
              <View className="flex-row items-center gap-2 mb-2">
                <AlertTriangle size={14} color="#a1a1aa" />
                <Text className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                  INFO PEMBAYARAN
                </Text>
              </View>
              <Text className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                Setelah menekan tombol di bawah, Anda akan diarahkan ke WhatsApp Admin untuk mengirimkan bukti transfer manual.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              className="bg-emerald-500 py-4 rounded-2xl flex-row items-center justify-center gap-2 active:bg-emerald-600 mt-2"
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Send size={16} color="#000" />
                  <Text className="text-black font-black uppercase tracking-[0.2em] text-xs">
                    Lanjut ke WhatsApp
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
