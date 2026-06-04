import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ArrowLeft, User, Phone, Truck, Shield } from 'lucide-react-native';
import { useDriverStore } from '../src/store/useDriverStore';
import { auth, db } from '../src/firebase/config';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, updateProfile as updateAuthProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

export default function EditProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile } = useDriverStore();
  
  const [name, setName] = useState(profile?.name || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '');
  const [vehicleType, setVehicleType] = useState(profile?.vehicleType || '');
  const [plateNumber, setPlateNumber] = useState(profile?.plateNumber || '');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleUpdateProfile = async () => {
    if (!name || !whatsapp) {
      Alert.alert("Gagal", "Nama dan Nomor WhatsApp wajib diisi.");
      return;
    }
    
    setLoading(true);
    try {
      if (name !== auth.currentUser?.displayName) {
        await updateAuthProfile(auth.currentUser, { displayName: name });
      }

      const updatedData = {
        name,
        whatsapp,
        vehicleType,
        plateNumber: plateNumber.toUpperCase()
      };

      const driverRef = doc(db, 'drivers', auth.currentUser.uid);
      await setDoc(driverRef, updatedData, { merge: true });

      await updateProfile({
        ...profile,
        ...updatedData
      });
      
      Alert.alert("Berhasil", "Profil berhasil diperbarui!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Gagal memperbarui profil.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Gagal", "Semua field kata sandi harus diisi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Gagal", "Konfirmasi password tidak cocok.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Gagal", "Kata sandi minimal 6 karakter.");
      return;
    }
    
    setPwdLoading(true);
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error("User not found");

      if (firebaseUser.providerData.some(p => p.providerId === 'password')) {
        const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
        await reauthenticateWithCredential(firebaseUser, credential);
      }

      await updatePassword(firebaseUser, newPassword);
      Alert.alert("Berhasil", "Kata sandi berhasil diubah!");
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        Alert.alert("Gagal", "Kata sandi saat ini salah.");
      } else if (err.code === 'auth/requires-recent-login') {
        Alert.alert("Gagal", "Silakan login ulang untuk mengubah kata sandi.");
      } else {
        Alert.alert("Error", "Gagal mengubah kata sandi: " + err.message);
      }
    } finally {
      setPwdLoading(false);
    }
  };

  const hasPasswordProvider = auth.currentUser?.providerData.some(p => p.providerId === 'password');

  return (
    <ScrollView className="flex-1 bg-zinc-950">
      <View className="pt-16 pb-4 px-6 flex-row items-center gap-4">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-10 h-10 bg-zinc-900 rounded-full items-center justify-center border border-zinc-800"
        >
          <ArrowLeft size={20} color="#a1a1aa" />
        </TouchableOpacity>
        <Text className="text-emerald-500 font-black text-2xl tracking-tighter italic uppercase">
          Edit Profil Mitra
        </Text>
      </View>

      <View className="p-6 gap-8 pb-20">
        
        {/* Personal Detail */}
        <View className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 shadow-xl">
          <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6">
            Detail Personal & Kendaraan
          </Text>

          <View className="gap-5">
            <View>
              <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1 mb-1.5">
                Nama Lengkap
              </Text>
              <View className="relative justify-center">
                <User size={16} color="#71717a" className="absolute left-4 z-10" />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Nama Lengkap"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white text-sm"
                />
              </View>
            </View>

            <View>
              <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1 mb-1.5">
                Nomor WhatsApp
              </Text>
              <View className="relative justify-center">
                <Phone size={16} color="#71717a" className="absolute left-4 z-10" />
                <TextInput
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  keyboardType="phone-pad"
                  placeholder="08123..."
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white text-sm"
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1 mb-1.5">
                  Tipe Kendaraan
                </Text>
                <View className="relative justify-center">
                  <Truck size={16} color="#71717a" className="absolute left-4 z-10" />
                  <TextInput
                    value={vehicleType}
                    onChangeText={setVehicleType}
                    placeholder="Beat 2024"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-11 pr-4 text-white text-sm"
                  />
                </View>
              </View>

              <View className="flex-1">
                <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1 mb-1.5">
                  Plat Nomor
                </Text>
                <TextInput
                  value={plateNumber}
                  onChangeText={text => setPlateNumber(text.toUpperCase())}
                  placeholder="AG 1234 XX"
                  placeholderTextColor="#52525b"
                  autoCapitalize="characters"
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 text-white text-sm font-mono tracking-widest"
                />
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleUpdateProfile}
              disabled={loading}
              className="mt-4 bg-emerald-500 rounded-2xl py-4 items-center justify-center shadow-lg shadow-emerald-500/20 active:bg-emerald-600"
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text className="text-black font-black text-xs uppercase tracking-[0.2em]">
                  Perbarui Profil
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Security / Password */}
        {hasPasswordProvider && (
          <View className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 shadow-xl">
            <Text className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6">
              Keamanan Akun
            </Text>

            <View className="gap-5">
              <View>
                <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1 mb-1.5">
                  Kata Sandi Saat Ini
                </Text>
                <View className="relative justify-center">
                  <Shield size={16} color="#71717a" className="absolute left-4 z-10" />
                  <TextInput
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-950 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white text-sm"
                  />
                </View>
              </View>

              <View>
                <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1 mb-1.5">
                  Kata Sandi Baru
                </Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="Minimal 6 karakter"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 text-white text-sm"
                />
              </View>

              <View>
                <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 ml-1 mb-1.5">
                  Konfirmasi Password Baru
                </Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Ulangi password baru"
                  placeholderTextColor="#52525b"
                  className="bg-zinc-950 border border-zinc-800 rounded-2xl py-4 px-4 text-white text-sm"
                />
              </View>

              <TouchableOpacity 
                onPress={handleChangePassword}
                disabled={pwdLoading}
                className="mt-4 bg-zinc-800 border border-zinc-700 rounded-2xl py-4 items-center justify-center active:bg-zinc-700"
              >
                {pwdLoading ? (
                  <ActivityIndicator color="#10b981" />
                ) : (
                  <Text className="text-white font-black text-xs uppercase tracking-[0.2em]">
                    Ganti Kata Sandi
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>
    </ScrollView>
  );
}
