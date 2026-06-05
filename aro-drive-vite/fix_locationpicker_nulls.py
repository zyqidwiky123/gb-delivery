import re

with open('/home/marco/ARO-DRIVE/aro-drive-vite/src/pages/LocationPicker.jsx', 'r') as f:
    content = f.read()

# Fix getInitialLocation
old_get_loc = """  const getInitialLocation = () => {
    if (mode === 'pickup' && ridePickup) return { lat: ridePickup.lat, lng: ridePickup.lng };
    if (mode === 'dest' && rideDropoff) return { lat: rideDropoff.lat, lng: rideDropoff.lng };
    if (mode === 'sendPickup' && sendPickup) return { lat: sendPickup.lat, lng: sendPickup.lng };
    if (mode === 'sendDropoff' && sendDropoff) return { lat: sendDropoff.lat, lng: sendDropoff.lng };
    if (mode === 'shopPickup' && shopPickups[index]?.lat) return { lat: shopPickups[index].lat, lng: shopPickups[index].lng };
    if (mode === 'shopDropoff' && shopDropoff) return { lat: shopDropoff.lat, lng: shopDropoff.lng };
    if (mode === 'foodDelivery' && foodDeliveryLocation) return { lat: foodDeliveryLocation.lat, lng: foodDeliveryLocation.lng };
    return BLITAR_CENTER;
  };"""

new_get_loc = """  const getInitialLocation = () => {
    if (mode === 'pickup' && ridePickup?.lat) return { lat: ridePickup.lat, lng: ridePickup.lng };
    if (mode === 'dest' && rideDropoff?.lat) return { lat: rideDropoff.lat, lng: rideDropoff.lng };
    if (mode === 'sendPickup' && sendPickup?.lat) return { lat: sendPickup.lat, lng: sendPickup.lng };
    if (mode === 'sendDropoff' && sendDropoff?.lat) return { lat: sendDropoff.lat, lng: sendDropoff.lng };
    if (mode === 'shopPickup' && shopPickups[index]?.lat) return { lat: shopPickups[index].lat, lng: shopPickups[index].lng };
    if (mode === 'shopDropoff' && shopDropoff?.lat) return { lat: shopDropoff.lat, lng: shopDropoff.lng };
    if (mode === 'foodDelivery' && foodDeliveryLocation?.lat) return { lat: foodDeliveryLocation.lat, lng: foodDeliveryLocation.lng };
    return BLITAR_CENTER;
  };"""

content = content.replace(old_get_loc, new_get_loc)

with open('/home/marco/ARO-DRIVE/aro-drive-vite/src/pages/LocationPicker.jsx', 'w') as f:
    f.write(content)

