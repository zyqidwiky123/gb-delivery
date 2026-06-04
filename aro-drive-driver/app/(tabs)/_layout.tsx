import { Tabs } from 'expo-router';
import React from 'react';
import { Home, ListOrdered, Wallet, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#09090b', // zinc-950
          borderTopWidth: 1,
          borderTopColor: '#27272a', // zinc-800
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#04a37f', // Match brand primary
        tabBarInactiveTintColor: '#a1a1aa', // zinc-400
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Riwayat',
          tabBarIcon: ({ color }) => <ListOrdered size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Saldo',
          tabBarIcon: ({ color }) => <Wallet size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
