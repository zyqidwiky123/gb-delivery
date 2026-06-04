import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, db } from '../src/firebase/config';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getDriverProfile, createDriverProfile } from '../src/firebase/driverService';
import { useDriverStore } from '../src/store/useDriverStore';
import { doc, setDoc } from 'firebase/firestore';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const setUser = useDriverStore((state) => state.setUser);
  

  const handleAuth = async () => {
    if (!email || !password) {
      setErrorMsg("Harap masukkan email dan kata sandi.");
      return;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (authError) {
        if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
          userCredential = await createUserWithEmailAndPassword(auth, email, password);
        } else {
          throw authError;
        }
      }

      const user = userCredential.user;
      
      let profile = await getDriverProfile(user.uid);
      if (!profile) {
        profile = await createDriverProfile(user.uid, user.email);
      } else {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { role: 'driver' }, { merge: true });
      }
      
      setUser(user);
      router.replace('/(tabs)/home');
    } catch (err) {
      console.error(err);
      setErrorMsg("Akses ditolak: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-zinc-950 px-6 py-12 justify-center items-center">
      <View className="items-center mb-12">
        <View className="bg-zinc-900 p-4 rounded-xl mb-6 shadow-2xl border border-zinc-800">
          <Text className="text-lime-400 text-5xl font-bold">A</Text>
        </View>
        <Text className="font-black italic text-4xl text-lime-400 text-center">ARO DRIVE</Text>
        <Text className="text-zinc-400 text-xs uppercase tracking-widest mt-2 font-medium">
          Portal Pengemudi
        </Text>
      </View>

      <View className="w-full max-w-sm">
        {errorMsg ? (
          <View className="bg-red-500/10 border border-red-500 p-3 rounded-lg mb-6">
            <Text className="text-red-500 text-xs text-center font-bold">{errorMsg}</Text>
          </View>
        ) : null}
      
        <View className="space-y-2 mb-4">
          <Text className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1 mb-1">Email Mitra</Text>
          <TextInput 
            className="w-full bg-zinc-900 rounded-xl py-4 px-4 text-white placeholder:text-zinc-600" 
            placeholder="Masukkan email Anda" 
            placeholderTextColor="#52525b"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View className="space-y-2 mb-8">
          <Text className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1 mb-1">Kata Sandi</Text>
          <TextInput 
            className="w-full bg-zinc-900 rounded-xl py-4 px-4 text-white placeholder:text-zinc-600" 
            placeholder="••••••••" 
            placeholderTextColor="#52525b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity 
          onPress={handleAuth}
          disabled={isLoading}
          className={`w-full bg-lime-400 py-5 rounded-full items-center justify-center ${isLoading ? 'opacity-50' : ''}`}
        >
          {isLoading ? (
             <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-black font-extrabold text-lg">MASUK (LOGIN)</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
