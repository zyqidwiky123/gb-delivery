; 'EWHG6
[import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { Camera, Star, Info, Wallet, Plus, Trash2, Edit, ChevronRight, LogOut } from 'lucide-react-native';
import { useDriverStore } from '../../src/store/useDriverStore';
import { auth, db, storage } from '../../src/firebase/config';
import { signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, updateProfile, clearData } = useDriverStore();

  const [loading, setLoading] = useState(false);
  const [qrisUrl, setQrisUrl] = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);

  // Add Account form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountHolder, setNewAccountHolder] = useState('');

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQrisUrl(profile.qrisUrl || '');
      if (profile.bankAccounts) {
        setBankAccounts(profile.bankAccounts);
      } else if (profile.bankName && profile.accountNumber) {
        const initialAccount = {
          id: Date.now().toString(),
          bankName: profile.bankName,
          accountNumber: profile.accountNumber,
          accountHolder: profile.accountHolder || ''
        };
        setBankAccounts([initialAccount]);
      } else {
        setBankAccounts([]);
      }
    }
  }, [profile]);

  const handleLogout = async () => {
    Alert.alert(
      "Keluar Akun",
      "Apakah Anda yakin ingin keluar?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Keluar",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
              clearData();
              router.replace('/');
            } catch (_error) {
              Alert.alert("Error", "Gagal keluar akun.");
            }
          }
        }
      ]
    );
  };

  const handleAddAccount = async () => {
    if (!newBankName || !newAccountNumber || !newAccountHolder) {
      Alert.alert("Gagal", "Mohon lengkapi semua data rekening.");
      return;
    }
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      const newAccount = {
        id: Date.now().toString(),
        bankName: newBankName,
        accountNumber: newAccountNumber,
        accountHolder: newAccountHolder,
      };

      const updatedAccounts = [...bankAccounts, newAccount];
      const driverRef = doc(db, "drivers", auth.currentUser.uid);

      await setDoc(driverRef, { bankAccounts: updatedAccounts }, { merge: true });
      updateProfile({ ...profile, bankAccounts: updatedAccounts });

      setBankAccounts(updatedAccounts);
      setNewBankName('');
      setNewAccountNumber('');
      setNewAccountHolder('');
      setShowAddForm(false);
      Alert.alert("Berhasil", "Rekening berhasil ditambahkan!");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Gagal menambahkan rekening.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (id) => {
    Alert.alert(
      "Hapus Rekening",
      "Yakin ingin menghapus rekening ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const updatedAccounts = bankAccounts.filter(acc => acc.id !== id);
              const driverRef = doc(db, "drivers", auth.currentUser.uid);

              await setDoc(driverRef, { bankAccounts: updatedAccounts }, { merge: true });
              updateProfile({ ...profile, bankAccounts: updatedAccounts });
              setBankAccounts(updatedAccounts);
            } catch (_error) {
              Alert.alert("Error", "Gagal menghapus rekening.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleImageUpload = async (type) => {
    if (!auth.currentUser) return;

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Izin Ditolak", "Anda harus mengizinkan akses galeri untuk mengunggah gambar.");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [3, 4],
        quality: 0.5,
      });

      if (pickerResult.canceled) return;

      setLoading(true);
      const uri = pickerResult.assets[0].uri;

      // Convert to blob
      const response = await fetch(uri);
      const blob = await response.blob();

      const storagePath = type === 'profile'
        ? `profile_pics/${auth.currentUser.uid}`
        : `qris/${auth.currentUser.uid}`;

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);

      const driverRef = doc(db, "drivers", auth.currentUser.uid);
      if (type === 'profile') {
        await setDoc(driverRef, { photoUrl: url }, { merge: true });
        updateProfile({ ...profile, photoUrl: url });
        Alert.alert("Berhasil", "Foto profil diperbarui!");
      } else {
        await setDoc(driverRef, { qrisUrl: url }, { merge: true });
        updateProfile({ ...profile, qrisUrl: url });
        setQrisUrl(url);
        Alert.alert("Berhasil", "Gambar QRIS diperbarui!");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Gagal mengunggah gambar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-zinc-950">
      {/* Header */}
      <View className="pt-16 pb-8 items-center bg-zinc-900 border-b border-zinc-800 relative">
        <TouchableOpacity
          onPress={() => handleImageUpload('profile')}
          className="relative mb-4 shadow-2xl"
        >
          <View className="w-28 h-28 rounded-full border-[4px] border-zinc-800 overflow-hidden bg-zinc-800">
            <Image
              source={{ uri: profile?.photoUrl || "https://ui-avatars.com/api/?name=Driver&background=random" }}
              className="w-full h-full"
            />
            {loading && (
              <View className="absolute inset-0 bg-black/60 items-center justify-center">
                <ActivityIndicator color="#10b981" />
              </View>
            )}
          </View>
          <View className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 rounded-full items-center justify-center border-2 border-zinc-900">
            <Camera size={14} color="#000" />
          </View>
        </TouchableOpacity>

        <Text className="text-white font-black text-2xl tracking-tight mb-2">
          {profile?.name || "Driver"}
        </Text>

        <View className="flex-row items-center bg-zinc-800 px-3 py-1.5 rounded-full border border-zinc-700">
          <Star size={12} color="#f59e0b" fill="#f59e0b" />
          <Text className="text-white font-bold text-xs ml-1 mr-2">{profile?.rating || "0.0"}</Text>
          <View className="w-px h-3 bg-zinc-600 mr-2" />
          <Text className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
            {profile?.level || "Mitra"}
          </Text>
        </View>
      </View>

      <View className="p-6 gap-6">
        {/* Info Kendaraan */}
        <View className="bg-zinc-900 p-5 rounded-3xl border border-zinc-800">
          <View className="flex-row items-center gap-3 mb-4">
            <Info size={20} color="#10b981" />
            <Text className="font-bold text-lg text-white">Info Kendaraan</Text>
          </View>
          <View className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex-row justify-between items-center">
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                Tipe Kendaraan
              </Text>
              <Text className="text-white font-bold text-base">
                {profile?.vehicleType || "-"}
              </Text>
            </View>
            <View className="border-l border-zinc-800 pl-4 items-end">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                Plat Nomor
              </Text>
              <View className="bg-white px-3 py-1.5 rounded-lg">
                <Text className="text-black font-mono font-black tracking-widest">
                  {profile?.plateNumber || "-"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Daftar Rekening */}
        <View className="bg-zinc-900 p-5 rounded-3xl border border-zinc-800">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <Wallet size={20} color="#10b981" />
              <Text className="font-bold text-lg text-white">Daftar Rekening</Text>
            </View>
            {!showAddForm && (
              <TouchableOpacity
                onPress={() => setShowAddForm(true)}
                className="flex-row items-center gap-1 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20"
              >
                <Plus size={14} color="#10b981" />
                <Text className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                  Tambah
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="gap-3">
            {bankAccounts.length === 0 && !showAddForm && (
              <View className="py-6 items-center border border-dashed border-zinc-700 rounded-2xl">
                <Wallet size={24} color="#52525b" className="mb-2" />
                <Text className="text-xs text-zinc-500 font-medium italic">Belum ada rekening terdaftar</Text>
              </View>
            )}

            {bankAccounts.map(acc => (
              <View key={acc.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                <View className="flex-row justify-between items-start mb-3">
                  <View>
                    <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">
                      {acc.bankName}
                    </Text>
                    <Text className="text-lg font-black text-white italic tracking-wider">
                      {acc.accountNumber}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteAccount(acc.id)}
                    className="w-8 h-8 rounded-full bg-red-500/10 items-center justify-center"
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <View>
                  <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">
                    Atas Nama
                  </Text>
                  <Text className="font-bold text-xs text-zinc-300 uppercase">
                    {acc.accountHolder}
                  </Text>
                </View>
              </View>
            ))}

            {showAddForm && (
              <View className="bg-zinc-950 p-4 rounded-2xl border border-emerald-500/30 gap-3">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="font-bold text-sm text-emerald-500">Tambah Rekening Baru</Text>
                  <TouchableOpacity onPress={() => setShowAddForm(false)}>
                    <Text className="text-zinc-500">Batal</Text>
                  </TouchableOpacity>
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1 ml-1">Bank</Text>
                    <TextInput
                      value={newBankName}
                      onChangeText={setNewBankName}
                      placeholder="BCA/Mandiri"
                      placeholderTextColor="#52525b"
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1 ml-1">No. Rekening</Text>
                    <TextInput
                      value={newAccountNumber}
                      onChangeText={setNewAccountNumber}
                      keyboardType="numeric"
                      placeholder="0001..."
                      placeholderTextColor="#52525b"
                      className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs"
                    />
                  </View>
                </View>
                <View>
                  <Text className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1 ml-1">Atas Nama</Text>
                  <TextInput
                    value={newAccountHolder}
                    onChangeText={setNewAccountHolder}
                    placeholder="Sesuai Tabungan"
                    placeholderTextColor="#52525b"
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-xs"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleAddAccount}
                  disabled={loading}
                  className="bg-emerald-500 py-3 rounded-xl items-center mt-2"
                >
                  <Text className="text-black font-black text-[10px] uppercase tracking-widest">
                    {loading ? "Menyimpan..." : "Simpan Rekening"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* QRIS Upload */}
        <View className="bg-zinc-900 p-5 rounded-3xl border border-zinc-800">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-emerald-500/10 items-center justify-center">
                <Text className="text-emerald-500 font-black">QR</Text>
              </View>
              <Text className="font-bold text-lg text-white">QRIS Kustom</Text>
            </View>
            {qrisUrl ? (
              <View className="bg-emerald-500/10 px-2 py-1 rounded">
                <Text className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Aktif</Text>
              </View>
            ) : (
              <View className="bg-red-500/10 px-2 py-1 rounded">
                <Text className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Belum Ada</Text>
              </View>
            )}
          </View>

          <Text className="text-xs text-zinc-400 mb-4 leading-relaxed">
            Upload gambar QRIS statis M-Banking/E-Wallet Anda agar pelanggan bisa membayar non-tunai langsung ke Anda.
          </Text>

          {qrisUrl ? (
            <View className="gap-4">
              <View className="bg-white p-4 rounded-2xl items-center justify-center">
                <Image
                  source={{ uri: qrisUrl }}
                  className="w-full h-48"
                  resizeMode="contain"
                />
              </View>
              <TouchableOpacity
                onPress={() => handleImageUpload('qris')}
                disabled={loading}
                className="bg-zinc-800 py-3 rounded-xl border border-zinc-700 flex-row items-center justify-center gap-2"
              >
                <Edit size={14} color="#10b981" />
                <Text className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">Ganti Gambar QRIS</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => handleImageUpload('qris')}
              disabled={loading}
              className="border-2 border-dashed border-emerald-500/40 p-6 rounded-2xl items-center bg-emerald-500/5"
            >
              <View className="w-12 h-12 rounded-full bg-emerald-500/10 items-center justify-center mb-3">
                <Text className="text-xl text-emerald-500">+</Text>
              </View>
              <Text className="font-bold text-sm text-emerald-500 mb-1">Unggah Gambar QRIS</Text>
              <Text className="text-[10px] text-zinc-500 uppercase tracking-widest">JPEG, PNG Max 2MB</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Settings Menu */}
        <View className="bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden mb-8">
          <TouchableOpacity
            onPress={() => router.push('/edit-profile')}
            className="flex-row items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900"
          >
            <View className="flex-row items-center gap-3">
              <Edit size={20} color="#a1a1aa" />
              <Text className="font-bold text-sm text-white">Pengaturan Akun</Text>
            </View>
            <ChevronRight size={16} color="#52525b" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/terms')}
            className="flex-row items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900"
          >
            <View className="flex-row items-center gap-3">
              <Info size={20} color="#a1a1aa" />
              <Text className="font-bold text-sm text-white">Syarat & Ketentuan Mitra</Text>
            </View>
            <ChevronRight size={16} color="#52525b" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            className="flex-row items-center p-5 bg-zinc-900"
          >
            <View className="flex-row items-center gap-3">
              <LogOut size={20} color="#ef4444" />
              <Text className="font-bold text-sm text-red-500">Keluar Akun (Log Out)</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
