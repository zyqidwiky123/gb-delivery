import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-zinc-950" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="pt-16 pb-4 px-6 flex-row items-center gap-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 bg-zinc-900 rounded-full items-center justify-center border border-zinc-800"
        >
          <ArrowLeft size={20} color="#a1a1aa" />
        </TouchableOpacity>
        <Text className="text-emerald-500 font-black text-xl tracking-tighter italic uppercase flex-1">
          Syarat & Ketentuan
        </Text>
      </View>

      <View className="px-6 gap-4">
        <View className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <Text className="text-white font-black text-lg mb-3">Mitra ARO DRIVE</Text>
          <Text className="text-zinc-400 text-sm leading-6">
            Mitra wajib menjaga keamanan perjalanan, mengikuti ketentuan layanan, dan menyelesaikan
            pesanan sesuai instruksi aplikasi. Ketentuan lengkap dapat diperbarui oleh admin ARO DRIVE.
          </Text>
        </View>

        <View className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
          <Text className="text-white font-black text-lg mb-3">Saldo & Komisi</Text>
          <Text className="text-zinc-400 text-sm leading-6">
            Saldo driver digunakan untuk pencatatan biaya layanan dan dapat ditop-up melalui proses
            verifikasi admin. Tarik tunai diproses melalui rekening yang sudah terdaftar.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
