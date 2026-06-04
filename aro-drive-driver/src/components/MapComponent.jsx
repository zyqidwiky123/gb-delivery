import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useDriverStore } from '../store/useDriverStore';
import { Navigation } from 'lucide-react-native';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const BLITAR_CENTER = { latitude: -8.0954, longitude: 112.1609, latitudeDelta: 0.05, longitudeDelta: 0.05 };

// Helpers
const toLatLng = (arr) => {
  if (!arr) return null;
  if (Array.isArray(arr)) return { latitude: arr[0], longitude: arr[1] };
  if (arr.lat !== undefined && arr.lng !== undefined) return { latitude: arr.lat, longitude: arr.lng };
  return arr;
};

export default function MapComponent({ activeJob }) {
  const { user } = useDriverStore();
  const [driverLocation, setDriverLocation] = useState(BLITAR_CENTER);
  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const mapRef = useRef(null);

  // Track Driver Location using Expo Location
  useEffect(() => {
    let locationSubscription;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMapError('Akses lokasi ditolak');
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 10,
        },
        async (loc) => {
          const newLoc = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setDriverLocation((prev) => ({ ...prev, ...newLoc }));

          if (mapRef.current) {
            mapRef.current.animateToRegion({
              ...newLoc,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 1000);
          }

          if (user?.uid && activeJob?.id) {
            try {
              await updateDoc(doc(db, "orders", activeJob.id), {
                driverLocation: { lat: newLoc.latitude, lng: newLoc.longitude }
              });
            } catch(e) { console.error("Failed to sync driver location to order", e) }
          }
        }
      );
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [user?.uid, activeJob?.id]);

  const openGoogleMapsApp = () => {
    if (!activeJob) return;

    const originPos = driverLocation;
    if (!originPos) {
      setMapError("Lokasi driver belum tersedia.");
      return;
    }
    
    const origin = `${originPos.latitude},${originPos.longitude}`;
    let destination = "";

    if (activeJob.status === 'accepted') {
        if (activeJob.pickups && activeJob.pickups.length > 0) {
            const points = activeJob.pickups.map(p => toLatLng(p)).filter(Boolean);
            if (points.length === 0) return;
            const currentPickupIndex = activeJob.pickupsDone || 0;
            const targetPickup = points[Math.min(currentPickupIndex, points.length - 1)];
            destination = `${targetPickup.latitude},${targetPickup.longitude}`;
        } else {
            const pickupPos = toLatLng(activeJob.pickup);
            if (!pickupPos) return;
            destination = `${pickupPos.latitude},${pickupPos.longitude}`;
        }
    } else if (activeJob.status === 'picked_up' || activeJob.status === 'completed') {
        const dropoffPos = toLatLng(activeJob.dropoff);
        if (!dropoffPos) return;
        destination = `${dropoffPos.latitude},${dropoffPos.longitude}`;
    }

    const url = Platform.select({
      ios: `maps://app?saddr=${origin}&daddr=${destination}`,
      android: `google.navigation:q=${destination}&mode=d`
    });

    Linking.openURL(url);
  };

  // Determine routing destination
  let destination = null;
  const pickupPos = toLatLng(activeJob?.pickup);
  const dropoffPos = toLatLng(activeJob?.dropoff);

  if (activeJob) {
    if (activeJob.status === 'accepted') {
      if (activeJob.pickups && activeJob.pickups.length > 0) {
        const points = activeJob.pickups.map(p => toLatLng(p)).filter(Boolean);
        const currentPickupIndex = activeJob.pickupsDone || 0;
        destination = points[Math.min(currentPickupIndex, points.length - 1)];
      } else {
        destination = pickupPos || dropoffPos;
      }
    } else if (activeJob.status === 'picked_up') {
      destination = dropoffPos;
    }
  }

  return (
    <View className="relative w-full h-64 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
      {/* Loading overlay */}
      {mapLoading && (
        <View className="absolute inset-0 bg-zinc-900 z-20 items-center justify-center">
          <ActivityIndicator size="large" color="#a3e635" />
          <Text className="text-zinc-400 text-xs mt-2">Memuat peta...</Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        initialRegion={BLITAR_CENTER}
        showsUserLocation={true}
        showsMyLocationButton={false}
        mapType="standard"
        onMapReady={() => {
          setMapReady(true);
          setMapLoading(false);
          console.log('[MapComponent] Map is ready');
        }}
        onMapLoaded={() => {
          setMapLoading(false);
          console.log('[MapComponent] Map tiles loaded');
        }}
      >
        {mapReady && activeJob && destination && (
          <MapViewDirections
            origin={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }}
            destination={destination}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={5}
            strokeColor="#cafd00"
            onError={(err) => console.error('[MapDirections] Error:', err)}
          />
        )}

        {/* Custom endpoints if routed */}
        {mapReady && activeJob && (
           <>
            {activeJob.status === 'accepted' && (
              <>
                {activeJob.pickups && activeJob.pickups.length > 0 ? (
                    activeJob.pickups.map((p, idx) => (
                      <Marker 
                        key={`pickup-${idx}`} 
                        coordinate={toLatLng(p)} 
                        title={`Pickup ${(idx + 1).toString()}`}
                        pinColor="blue"
                      />
                    ))
                ) : (
                    pickupPos && <Marker coordinate={pickupPos} title="Pickup" pinColor="blue" />
                )}
              </>
            )}
            {/* Always show dropoff marker if active */}
            {dropoffPos && <Marker coordinate={dropoffPos} title="Dropoff" pinColor="red" />}
          </>
        )}
      </MapView>

      {/* Locate Me FAB */}
      <TouchableOpacity 
        className="absolute bottom-4 right-4 bg-zinc-900/80 p-3 rounded-full border border-zinc-800 shadow-lg"
        onPress={() => {
           if (mapRef.current && driverLocation) {
             mapRef.current.animateToRegion({
               ...driverLocation,
               latitudeDelta: 0.01,
               longitudeDelta: 0.01,
             }, 1000);
           }
        }}
      >
         <Navigation size={20} color="#cafd00" />
      </TouchableOpacity>

      {/* External Map Nav Button */}
      {activeJob && (
          <TouchableOpacity 
             onPress={openGoogleMapsApp}
             className="absolute top-4 right-4 bg-lime-400 px-4 py-2 rounded-full shadow-lg flex-row items-center gap-2"
          >
             <Navigation size={14} color="black" />
             <Text className="text-black font-bold text-xs">NAVIGASI MAPS</Text>
          </TouchableOpacity>
      )}

      {mapError ? (
          <View className="absolute top-4 left-4 bg-red-500 px-3 py-1 rounded-full">
            <Text className="text-white text-[10px] font-bold">{mapError}</Text>
          </View>
      ) : null}
    </View>
  );
}
