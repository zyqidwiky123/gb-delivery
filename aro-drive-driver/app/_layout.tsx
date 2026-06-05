// app/_layout.tsx
import React from 'react';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../global.css';
import { ActivityIndicator, View } from 'react-native';
import { useDriverStore } from '../src/store/useDriverStore';
import { useAuthObserver } from '../src/hooks/useAuthObserver';

export default function RootLayout() {
  const authLoading = useDriverStore((s) => (s as any).authLoading);
  const user = useDriverStore((s) => (s as any).user);
  const segments = useSegments();
  const router = useRouter();

  useAuthObserver();

  useEffect(() => {
    if (authLoading) return;

    const inTabsGroup = segments[0] === '(tabs)';
    
    if (!user && inTabsGroup) {
      // Redirect to the sign-in page.
      router.replace('/');
    } else if (user && (!segments[0] || segments[0] === 'index')) {
      // Redirect to the home page only if they are on the login screen
      router.replace('/(tabs)/home');
    }
  }, [user, authLoading, segments, router]);

  // Show splash/loading while auth state is initializing
  if (authLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#cafd00" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="index" />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
