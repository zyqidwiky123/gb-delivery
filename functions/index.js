const { setGlobalOptions } = require('firebase-functions/v2');
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");

// Set global options for all v2 functions
setGlobalOptions({ 
  region: 'asia-southeast2',
  memory: '512MiB',
  timeoutSeconds: 120,
  maxInstances: 10
});

const admin = require("firebase-admin");
// const axios = require("axios"); // Lazy load inside functions
// const vision = require("@google-cloud/vision"); // Lazy load inside functions

admin.initializeApp();

// Helper to calculate distance in KM using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

const MAX_DRIVER_LOCATION_AGE_MS = 5 * 60 * 1000;
const DRIVER_OFFER_TIMEOUT_MS = 60 * 1000;
const RADIUS_EXPANSION_INTERVAL_MS = 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const MAX_DAILY_ONLINE_MS = 12 * 60 * 60 * 1000;
const DISPATCH_REGION_CONFIG = {
    kota: {
        initialRadius: 3,
        radiusIncrement: 2,
        maxRadius: 10,
        maxSearchMinutes: 5,
    },
    kabupaten: {
        initialRadius: 4,
        radiusIncrement: 3,
        maxRadius: 20,
        maxSearchMinutes: 7,
    },
};

function getDispatchRegionConfig(regionType) {
    return DISPATCH_REGION_CONFIG[regionType] || DISPATCH_REGION_CONFIG.kota;
}

function getTimestampMillis(value) {
    if (!value) return null;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function isDriverInactive(driver, now = Date.now()) {
    const lastActive = getTimestampMillis(driver.lastActive)
        || getTimestampMillis(driver.lastLocationUpdate)
        || getTimestampMillis(driver.updatedAt);
    if (!lastActive) return true;
    return now - lastActive >= INACTIVITY_TIMEOUT_MS;
}

function isDriverOverDailyLimit(driver, now = Date.now()) {
    const todayMs = driver.todayOnlineMs || 0;
    return todayMs >= MAX_DAILY_ONLINE_MS;
}

function isDriverLocationFresh(driver, now = Date.now()) {
    const locationUpdatedAt = getTimestampMillis(driver.lastLocationUpdate);
    if (!locationUpdatedAt) return false;
    return now - locationUpdatedAt < MAX_DRIVER_LOCATION_AGE_MS;
}

// Safely parse coordinates in various forms (object, array, nested lat/lng)
function parseCoords(loc) {
    if (!loc) return null;
    let lat, lng;
    if (Array.isArray(loc) && loc.length >= 2) {
        lat = Number(loc[0]);
        lng = Number(loc[1]);
    } else if (typeof loc === 'object') {
        lat = loc.lat !== undefined ? Number(loc.lat) : Number(loc.latitude);
        lng = loc.lng !== undefined ? (loc.lng || loc.lon) : Number(loc.longitude);
    }
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
}

// Calculate the pickup fee based on driver location, pickup location, and pricing settings
function calculatePickupFee(driverLoc, pickupLoc, pricing) {
    const dLoc = parseCoords(driverLoc);
    const pLoc = parseCoords(pickupLoc);
    if (!dLoc || !pLoc) return { fee: 0, distance: 0 };

    const distance = calculateDistance(dLoc.lat, dLoc.lng, pLoc.lat, pLoc.lng);
    
    // Default pricing settings if not defined in Firestore
    let freePickupRadius = 3;
    let ratePerKm = 2000;
    let maxFee = 15000;

    if (pricing && pricing.pickupSurcharge) {
        freePickupRadius = pricing.pickupSurcharge.freePickupRadius ?? freePickupRadius;
        ratePerKm = pricing.pickupSurcharge.ratePerKm ?? ratePerKm;
        maxFee = pricing.pickupSurcharge.maxFee ?? maxFee;
    }

    if (distance <= freePickupRadius) {
        return { fee: 0, distance };
    }

    const extraKm = distance - freePickupRadius;
    const rawFee = extraKm * ratePerKm;
    const roundedFee = Math.round(rawFee / 1000) * 1000;
    const fee = Math.min(roundedFee, maxFee);
    return { fee, distance };
}
// const visionClient = new vision.ImageAnnotatorClient(); // Moved inside helper

exports.onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
    const orderData = event.data.data();
    const orderId = event.params.orderId;
    let { merchantId, serviceType, total, pickupLocation, pickupAddress, items } = orderData;
    if (!pickupLocation) {
        pickupLocation = orderData.pickup;
    }

    // Fix: PWA cache might cause old versions to send array. Convert to object.
    if (Array.isArray(pickupLocation) && pickupLocation.length >= 2) {
        pickupLocation = { lat: Number(pickupLocation[0]), lng: Number(pickupLocation[1]) };
    }

    // Fix: extract merchantId from items if missing at top level (common in Food orders)
    if (!merchantId && Array.isArray(items) && items.length > 0) {
        merchantId = items[0].merchantId;
    }

    // 1. Send Notification to Merchant
    if (merchantId) {
        // FCM Notification
        await sendNotificationToMerchant(merchantId, {
            title: "Pesanan Masuk! 🍕",
            body: `Ada pesanan baru #${orderId.slice(-6).toUpperCase()} senilai Rp ${total?.toLocaleString()}. Cek di Dashboard sekarang!`,
        });

        // WhatsApp Notification (Only for admin-registered merchants)
        try {
            const mDoc = await admin.firestore().collection("merchants").doc(merchantId).get();
            if (mDoc.exists) {
                const merchantData = mDoc.data();
                if (merchantData.phone) {
                    const waTemplates = require("./templates");
                    // Format items text for the message
                    let itemsText = "";
                    if (serviceType === "food" && Array.isArray(items)) {
                        itemsText = items.map(item => `- ${item.desc || item.name} (${item.qty}x)`).join("\n");
                    } else if (typeof items === "string") {
                        itemsText = items;
                    }
                    
                    if (waTemplates.system && typeof waTemplates.system.newOrder === "function") {
                        const merchantMsg = waTemplates.system.newOrder(orderId, serviceType, total, merchantData.name || "Merchant", itemsText);
                        await sendWAFonnte(merchantData.phone, merchantMsg);
                        console.log(`[WA] New order notification sent to merchant: ${merchantData.phone}`);
                    }
                }
            }
        } catch (err) {
            console.error("Error sending WA notification to merchant:", err);
        }
    }

    // Send WhatsApp Notification to Customer (if Manual Order)
    try {
        if (orderData.customer?.isManual && orderData.customer?.wa) {
            const waTemplates = require("./templates");
            if (waTemplates.system && typeof waTemplates.system.manualOrderCustomer === "function") {
                const customerMsg = waTemplates.system.manualOrderCustomer(
                    orderData.customer.name,
                    orderId,
                    serviceType,
                    total,
                    orderData.pickupAddress,
                    orderData.dropoffAddress
                );
                await sendWAFonnte(orderData.customer.wa, customerMsg);
            }
        }
    } catch (waError) {
        console.error("Error sending WA notifications:", waError);
    }

    // 3. Skip dispatch if order has direct driver assignment
    if (orderData.status === 'accepted' || orderData.dispatch?.assignedDirectly) {
        console.log(`Order ${orderId} has direct driver assignment (admin), skipping dispatch.`);
        return;
    }

    // 4. Initialize Dispatch System (Only if pickupLocation exists)
    if (pickupLocation && pickupLocation.lat) {
        // Default reference center is still Blitar as per user request
        const BLITAR_CENTER = { lat: -8.098, lng: 112.164 };
        const distToCenter = calculateDistance(pickupLocation.lat, pickupLocation.lng, BLITAR_CENTER.lat, BLITAR_CENTER.lng);
        
        // Outside 7km from Blitar center is considered 'kabupaten' (larger radius)
        // For expansion regions (outside Blitar), this will default to 'kabupaten' which is safer for driver discovery.
        const isKabupaten = distToCenter > 7;
        const regionType = isKabupaten ? "kabupaten" : "kota";
        const regionConfig = getDispatchRegionConfig(regionType);

        const dispatchInit = {
            status: "searching",
            regionType,
            currentRadius: regionConfig.initialRadius,
            iteration: 1,
            notifiedDrivers: [],
            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
            startedSearchingAt: admin.firestore.FieldValue.serverTimestamp(),
            nextExpansionAt: new Date(Date.now() + RADIUS_EXPANSION_INTERVAL_MS),
        };

        await admin.firestore().collection("orders").doc(orderId).update({
            dispatch: dispatchInit
        });

        // 4. First Dispatch attempt
        const driverFound = await dispatchOrder(orderId, orderData, dispatchInit);

        // If no driver found in initial radius, retry with expanded radius after 15s delay
        if (!driverFound) {
            console.log(`[Dispatch] No driver found in initial ${dispatchInit.currentRadius}km radius for ${orderId}. Will retry with expanded radius after delay.`);
            await new Promise(resolve => setTimeout(resolve, 15_000));
            try {
                const refreshedSnap = await admin.firestore().collection("orders").doc(orderId).get();
                if (!refreshedSnap.exists) return null;
                const refreshedData = refreshedSnap.data();
                const refreshedDispatch = refreshedData.dispatch;
                if (!refreshedDispatch || refreshedDispatch.status !== "searching" || refreshedData.status !== "searching") return null;
                if (refreshedDispatch.offeredTo) {
                    console.log(`[Dispatch] Order ${orderId} already has an active offer (driver ${refreshedDispatch.offeredTo}), skipping retry.`);
                    return null;
                }
                const regionConfig = getDispatchRegionConfig(refreshedDispatch.regionType);
                const newRadius = Math.min(regionConfig.maxRadius, (refreshedDispatch.currentRadius || dispatchInit.currentRadius) + regionConfig.radiusIncrement);
                const retryDispatch = {
                    ...refreshedDispatch,
                    currentRadius: newRadius,
                    iteration: (refreshedDispatch.iteration || 1) + 1,
                };
                console.log(`[Dispatch] Accelerated retry for ${orderId} | Radius: ${newRadius}km | Iteration: ${retryDispatch.iteration}`);
                const retryFound = await dispatchOrder(orderId, refreshedData, retryDispatch);
                if (retryFound) {
                    console.log(`[Dispatch] Driver found on accelerated retry for ${orderId}.`);
                } else {
                    console.log(`[Dispatch] Accelerated retry also failed for ${orderId}. Will rely on expansionTrigger.`);
                }
            } catch (retryErr) {
                console.error(`[Dispatch] Error in accelerated retry for ${orderId}:`, retryErr);
            }
        }
    }

    return null;
});

exports.autoOfflineLongOnlineDrivers = onSchedule("every 3 minutes", async () => {
    const now = Date.now();

    // 1. Handle stuck "busy" drivers: if busy > 30 min without active order, reset to online
    const busyDrivers = await admin.firestore().collection("drivers")
        .where("status", "==", "busy")
        .get();
    const stuckBusy = [];
    for (const doc of busyDrivers.docs) {
        const driver = doc.data();
        const updatedAt = getTimestampMillis(driver.updatedAt) || getTimestampMillis(driver.statusChangedAt) || 0;
        if (updatedAt > 0 && (now - updatedAt) > 30 * 60 * 1000) {
            // Check if this driver actually has active orders
            const activeOrders = await admin.firestore().collection("orders")
                .where("driverId", "==", doc.id)
                .where("status", "in", ["accepted", "arriving", "picked_up"])
                .limit(1)
                .get();
            if (activeOrders.empty) {
                stuckBusy.push(doc.ref);
            }
        } else if (updatedAt === 0) {
            stuckBusy.push(doc.ref);
        }
    }
    if (stuckBusy.length > 0) {
        const busyBatch = admin.firestore().batch();
        stuckBusy.forEach(ref => {
            busyBatch.update(ref, {
                status: "online",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        await busyBatch.commit();
        console.log(`[AutoOffline] Reset ${stuckBusy.length} stuck busy drivers to online.`);
    }

    // 2. Handle inactive + over daily limit drivers
    const driversSnapshot = await admin.firestore().collection("drivers")
        .where("isOnline", "==", true)
        .get();

    const inactiveDrivers = [];
    const overLimitDrivers = [];

    driversSnapshot.forEach(doc => {
        const driver = doc.data();

        // Cek inactivity (>2 jam tanpa lastActive)
        if (isDriverInactive(driver, now)) {
            inactiveDrivers.push({ ref: doc.ref, driver });
            return;
        }

        // Cek daily limit (>=12 jam hari ini)
        if (isDriverOverDailyLimit(driver, now)) {
            overLimitDrivers.push({ ref: doc.ref, driver });
            return;
        }
    });

    const batchSize = 400;

    // Process inactive drivers
    if (inactiveDrivers.length > 0) {
        for (let i = 0; i < inactiveDrivers.length; i += batchSize) {
            const batch = admin.firestore().batch();
            const chunk = inactiveDrivers.slice(i, i + batchSize);
            chunk.forEach(({ ref, driver }) => {
                const updates = {
                    status: "offline",
                    isOnline: false,
                    offlineAt: admin.firestore.FieldValue.serverTimestamp(),
                    autoOfflineAt: admin.firestore.FieldValue.serverTimestamp(),
                    statusChangedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                // Akumulasi todayOnlineMs saat offline
                const onlineSince = getTimestampMillis(driver.onlineSessionStartAt) || getTimestampMillis(driver.onlineAt);
                if (onlineSince) {
                    updates.todayOnlineMs = (driver.todayOnlineMs || 0) + (now - onlineSince);
                }
                batch.update(ref, updates);
            });
            await batch.commit();
        }
        console.log(`[AutoOffline] Set ${inactiveDrivers.length} inactive drivers offline.`);
    }

    // Process over-limit drivers
    if (overLimitDrivers.length > 0) {
        for (let i = 0; i < overLimitDrivers.length; i += batchSize) {
            const batch = admin.firestore().batch();
            const chunk = overLimitDrivers.slice(i, i + batchSize);
            chunk.forEach(({ ref, driver }) => {
                const updates = {
                    status: "offline",
                    isOnline: false,
                    offlineAt: admin.firestore.FieldValue.serverTimestamp(),
                    autoOfflineAt: admin.firestore.FieldValue.serverTimestamp(),
                    statusChangedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                };
                const onlineSince = getTimestampMillis(driver.onlineSessionStartAt) || getTimestampMillis(driver.onlineAt);
                if (onlineSince) {
                    updates.todayOnlineMs = (driver.todayOnlineMs || 0) + (now - onlineSince);
                }
                batch.update(ref, updates);
            });
            await batch.commit();
        }
        console.log(`[AutoOffline] Set ${overLimitDrivers.length} over-limit drivers offline.`);
    }

    if (inactiveDrivers.length === 0 && overLimitDrivers.length === 0) {
        if (stuckBusy.length === 0) console.log("[AutoOffline] No inactive or over-limit drivers found.");
    }
    return null;
});

// Reset daily online time for all drivers at midnight
exports.resetDailyOnlineTime = onSchedule("every day 00:00", async () => {
    const driversSnapshot = await admin.firestore().collection("drivers")
        .select()
        .get();

    if (driversSnapshot.empty) {
        console.log("[DailyReset] No drivers to reset.");
        return;
    }

    const batchSize = 400;
    const refs = driversSnapshot.docs.map(doc => doc.ref);
    for (let i = 0; i < refs.length; i += batchSize) {
        const batch = admin.firestore().batch();
        const chunk = refs.slice(i, i + batchSize);
        chunk.forEach(ref => {
            batch.update(ref, {
                todayOnlineMs: 0,
                onlineSessionStartAt: admin.firestore.FieldValue.serverTimestamp(),
                todayOnlineResetAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        await batch.commit();
    }

    console.log(`[DailyReset] Reset todayOnlineMs for ${refs.length} drivers.`);
    return null;
});

async function dispatchOrder(orderId, orderData, dispatchState) {
    let pickupLocation = orderData.pickup || orderData.pickupLocation;
    if (Array.isArray(pickupLocation) && pickupLocation.length >= 2) {
        pickupLocation = { lat: Number(pickupLocation[0]), lng: Number(pickupLocation[1]) };
    }
    
    const { serviceType } = orderData;
    const { currentRadius, notifiedDrivers } = dispatchState;
    const rejectedDrivers = dispatchState.rejectedDrivers || [];

    console.log(`[Dispatch] Processing Order ${orderId} | Radius: ${currentRadius}km | Iteration: ${dispatchState.iteration} | Rejected: ${rejectedDrivers.length}`);

    // Query all online drivers
    const driversSnapshot = await admin.firestore().collection("drivers")
        .where("isOnline", "==", true)
        .where("status", "==", "online") // Driver yang tidak sedang bawa order
        .get();

    let candidates = [];

    driversSnapshot.forEach(doc => {
        const driver = doc.data();
        const driverId = doc.id;

        // Skip if already rejected/timed out this order
        if (rejectedDrivers.includes(driverId)) return;
        // Also skip previously notified (for radius expansion compatibility)
        if (notifiedDrivers.includes(driverId)) return;
        if (isDriverInactive(driver)) {
            console.log(`[Dispatch] Skipping inactive driver ${driverId}.`);
            return;
        }
        if (isDriverOverDailyLimit(driver)) {
            console.log(`[Dispatch] Skipping driver ${driverId} — over daily online limit.`);
            return;
        }
        if ((driver.balance || 0) < 0) {
            console.log(`[Dispatch] Skipping driver ${driverId} — negative balance.`);
            return;
        }
        if (!isDriverLocationFresh(driver)) {
            console.log(`[Dispatch] Skipping stale or missing location for driver ${driverId}.`);
            return;
        }

        if (driver.location && driver.location.lat && driver.location.lng) {
            const distance = calculateDistance(
                pickupLocation.lat, pickupLocation.lng,
                driver.location.lat, driver.location.lng
            );

            if (distance <= currentRadius) {
                candidates.push({
                    id: driverId,
                    distance: distance,
                    lastJobAt: driver.lastJobAt ? driver.lastJobAt.toMillis() : 0,
                    rating: driver.rating || 5.0,
                    fcmToken: driver.fcmToken
                });
            }
        }
    });

    if (candidates.length === 0) {
        console.log(`[Dispatch] No drivers found in ${currentRadius}km for ${orderId}`);
        return false; // Signal: no driver found
    }

    /**
     * QUEUE RE-BALANCING LOGIC
     * Sort by:
     * 1. Distance (ASC) - Driver terdekat diprioritaskan
     * 2. Idle time (lastJobAt ASC) - Jika jarak sama, driver yang nganggur paling lama diprioritaskan
     * 3. Rating (DESC) - Jika jarak dan waktu tunggu sama, pakai rating tertinggi
     */
    candidates.sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        if (a.lastJobAt !== b.lastJobAt) return a.lastJobAt - b.lastJobAt;
        return b.rating - a.rating;
    });

    // OFFER-BASED: Pick top 1 driver only (exclusive offer)
    const selectedDriver = candidates[0];
    console.log(`[Dispatch] Offering Order ${orderId} exclusively to Driver ${selectedDriver.id} (dist: ${selectedDriver.distance.toFixed(1)}km)`);

    // Update order with exclusive offer
    await admin.firestore().collection("orders").doc(orderId).update({
        "dispatch.offeredTo": selectedDriver.id,
        "dispatch.offerExpiresAt": admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + DRIVER_OFFER_TIMEOUT_MS)
        ),
        "dispatch.notifiedDrivers": [...notifiedDrivers, selectedDriver.id],
        "dispatch.lastAttemptAt": admin.firestore.FieldValue.serverTimestamp()
    });

    // Send FCM notification only to the selected driver
    if (selectedDriver.fcmToken) {
        try {
            const message = {
                token: selectedDriver.fcmToken,
                data: {
                    type: "NEW_ORDER",
                    orderId: String(orderId),
                    title: "Ada Order Baru! 🛵",
                    body: `Ayo ambil orderan ARO-${orderId.slice(-5).toUpperCase()}! Jarak: ${selectedDriver.distance.toFixed(1)}km. Kamu punya 60 detik!`,
                },
                android: {
                    priority: "high",
                },
            };
            await admin.messaging().send(message);
        } catch (fcmErr) {
            console.warn(`[Dispatch] FCM failed for driver ${selectedDriver.id}:`, fcmErr.message);
        }
    }

    console.log(`[Dispatch] Offered Order ${orderId} to Driver ${selectedDriver.id} | Expires in ${DRIVER_OFFER_TIMEOUT_MS / 1000}s`);
    return true; // Signal: driver was dispatched
}

/**
 * Sets order to 'no_driver' status and notifies the customer.
 * Called when all radius expansions are exhausted with no available driver.
 */
async function setNoDriverStatus(orderId, orderData) {
    console.log(`[Dispatch] EXHAUSTED — No driver found for Order ${orderId}. Setting no_driver status.`);

    try {
        await admin.firestore().collection("orders").doc(orderId).update({
            status: "no_driver",
            "dispatch.status": "failed",
            noDriverAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error(`[Dispatch] Failed to update no_driver status for ${orderId}:`, err);
        return;
    }

    // FCM Push Notification to Customer
    const customerId = orderData.customerId;
    if (customerId) {
        try {
            await sendNotification(customerId, {
                title: "Driver Tidak Tersedia 😢",
                body: `Maaf, semua driver sedang sibuk di area kamu untuk order #${orderId.slice(-5).toUpperCase()}. Pesanan dibatalkan otomatis.`,
            });
        } catch (e) {
            console.warn("[NoDriver] FCM notify failed:", e.message);
        }
    }

    // WhatsApp Notification to Customer
    const waNumber = orderData.customer?.wa;
    if (waNumber) {
        try {
            const customerName = orderData.customer?.name || 'Kak';
            const shortId = orderId.slice(-5).toUpperCase();
            const msg = `Halo ${customerName} 🙏\n\nMaaf, kami tidak dapat menemukan driver yang tersedia untuk pesanan ARO-${shortId} kamu saat ini.\n\nSemua driver mitra sedang sibuk atau belum ada driver di area kamu.\n\nPesanan otomatis dibatalkan. Silakan coba lagi beberapa saat nanti. Terima kasih sudah menggunakan ARO DRIVE! 🙏`;
            await sendWAFonnte(waNumber, msg);
        } catch (e) {
            console.warn("[NoDriver] WA notify failed:", e.message);
        }
    }
}

/**
 * Helper to get the total number of online and available drivers.
 */
async function getOnlineAvailableDriversCount() {
    try {
        const driversSnapshot = await admin.firestore().collection("drivers")
            .where("isOnline", "==", true)
            .where("status", "==", "online")
            .get();
        let count = 0;
        const now = Date.now();
        driversSnapshot.forEach(doc => {
            const driver = doc.data();
            if (!isDriverInactive(driver, now) && !isDriverOverDailyLimit(driver, now) && (driver.balance || 0) >= 0) {
                count += 1;
            }
        });
        return count;
    } catch (e) {
        console.error("Error getting online drivers count:", e);
        return 0;
    }
}

// Helper to send notification to a Merchant (stored in 'merchants' collection)
async function sendNotificationToMerchant(merchantId, payload) {
    try {
        const merchantDoc = await admin.firestore().collection("merchants").doc(merchantId).get();
        if (!merchantDoc.exists) return;

        const fcmToken = merchantDoc.data().fcmToken;
        if (!fcmToken) {
            console.log(`No FCM token found for merchant ${merchantId}`);
            return;
        }

        const message = {
            token: fcmToken,
            notification: payload,
            android: {
                notification: {
                    sound: "default",
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                    },
                },
            },
            data: {
                type: "NEW_ORDER",
                orderId: merchantId,
            },
        };
        
        await admin.messaging().send(message);
        console.log(`[Notification] Sent to Merchant ${merchantId}`);
    } catch (error) {
        console.error("Error sending merchant notification:", error);
    }
}

exports.onOrderUpdate = onDocumentUpdated("orders/{orderId}", async (event) => {
    const newValue = event.data.after.data();
    const previousValue = event.data.before.data();

    // Watch for immediate dispatch rejection
    const dispatchChangedToRejected = newValue.dispatch?.status === "rejected" && previousValue.dispatch?.status !== "rejected";

    // Check if outer status changed
    if (newValue.status === previousValue.status && !dispatchChangedToRejected) return null;

    if (dispatchChangedToRejected && newValue.status === "searching") {
        console.log(`[Reject] Order ${event.params.orderId} was rejected by driver. Rotating immediately...`);
        const dispatch = newValue.dispatch;
        const rejectedDrivers = dispatch.rejectedDrivers || [];
        if (dispatch.offeredTo && !rejectedDrivers.includes(dispatch.offeredTo)) {
            rejectedDrivers.push(dispatch.offeredTo);
        }

        const updatedDispatch = {
            ...dispatch,
            offeredTo: null,
            offerExpiresAt: null,
            rejectedDrivers,
        };

        // Clear the current offer first
        await admin.firestore().collection("orders").doc(event.params.orderId).update({
            "dispatch.offeredTo": admin.firestore.FieldValue.delete(),
            "dispatch.offerExpiresAt": admin.firestore.FieldValue.delete(),
            "dispatch.rejectedDrivers": rejectedDrivers,
        });

        const driverFound = await dispatchOrder(event.params.orderId, newValue, updatedDispatch);

        if (!driverFound) {
            const regionConfig = getDispatchRegionConfig(dispatch.regionType);
            const startedAt = dispatch.startedSearchingAt ? dispatch.startedSearchingAt.toDate() : (newValue.createdAt?.toDate() || new Date());
            const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;
            const onlineDriversCount = await getOnlineAvailableDriversCount();
            
            if (dispatch.currentRadius >= regionConfig.maxRadius || elapsedMinutes >= regionConfig.maxSearchMinutes || (onlineDriversCount === 0 || rejectedDrivers.length >= onlineDriversCount)) {
                console.log(`[Reject] Immediate exhaustion/timeout check after rejection for ${event.params.orderId}.`);
                await setNoDriverStatus(event.params.orderId, newValue);
            }
        }
        
        // If outer status didn't change, return early since remaining logic depends on outer status
        if (newValue.status === previousValue.status) return null;
    }

    const { status, customerId, driverId } = newValue;
    const orderId = event.params.orderId;

    // Calculate Pickup Distance Surcharge when driver accepts the order
    if (status === "accepted" && previousValue.status !== "accepted") {
        try {
            console.log(`[PickupSurcharge] Order ${orderId} accepted by driver ${driverId}. Calculating surcharge...`);
            
            const pricingDoc = await admin.firestore().collection("settings").doc("pricing").get();
            const pricing = pricingDoc.exists ? pricingDoc.data() : null;

            if (driverId) {
                const driverDoc = await admin.firestore().collection("drivers").doc(driverId).get();
                if (driverDoc.exists) {
                    const driverData = driverDoc.data();
                    const driverLoc = driverData.location;
                    const pickupLoc = newValue.pickupLocation || newValue.pickup;

                    console.log(`[PickupSurcharge] Driver location:`, driverLoc, `Pickup location:`, pickupLoc);

                    const { fee, distance } = calculatePickupFee(driverLoc, pickupLoc, pricing);
                    console.log(`[PickupSurcharge] Calculated distance: ${distance} km, surcharge fee: Rp ${fee}`);

                    if (fee > 0) {
                        const originalTotal = Number(newValue.total) || 0;
                        const newTotal = originalTotal + fee;
                        
                        await admin.firestore().collection("orders").doc(orderId).update({
                            pickupFee: fee,
                            pickupDistance: distance,
                            total: newTotal
                        });

                        console.log(`[PickupSurcharge] Updated order ${orderId} with pickupFee: Rp ${fee}, new total: Rp ${newTotal}`);
                    } else {
                        await admin.firestore().collection("orders").doc(orderId).update({
                            pickupFee: 0,
                            pickupDistance: distance
                        });
                        console.log(`[PickupSurcharge] Pickup distance is ${distance} km, no surcharge applied.`);
                    }
                } else {
                    console.warn(`[PickupSurcharge] Driver document ${driverId} not found.`);
                }
            }
        } catch (surchargeError) {
            console.error("Error calculating or applying pickup surcharge:", surchargeError);
        }
    }

    // 1. WhatsApp Notifications (Fonnte)
    if (["accepted", "arriving", "picked_up", "completed"].includes(status)) {
        try {
            const userDoc = customerId ? await admin.firestore().collection("users").doc(customerId).get() : null;
            const userData = (userDoc && userDoc.exists) ? userDoc.data() : null;

            // Prioritaskan data dari order (untuk guest), fallback ke user profile
            const waNumber = newValue.customer?.wa || userData?.whatsapp || userData?.wa;
            const customerName = newValue.customer?.name || userData?.displayName || "Pelanggan";

            if (waNumber) {
                const type = newValue.serviceType || newValue.type || "food";
                const shortId = orderId.slice(-5).toUpperCase();
                
                let menuText = "";
                if (type === "food" && Array.isArray(newValue.items)) {
                    menuText = "\n\nDetail Menu:\n" + newValue.items.map(item => `- ${item.desc || item.name} (${item.qty}x)`).join("\n");
                } else if (type === "shop" && newValue.items) {
                    menuText = `\n\nDetail Barang:\n${newValue.items}`;
                }

                const waTemplates = require("./templates");
                const serviceKey = waTemplates[type] ? type : (type === 'tip' ? 'shop' : 'jek');
                const templateFn = waTemplates[serviceKey][status];
                
                let extraData = null;
                if (status === "completed") {
                    // Build cleaner item list for receipt if it's food
                    let itemsReceipt = menuText.replace("\n\nDetail Menu:\n", "").replace("\n\nDetail Barang:\n", "");
                    
                    extraData = {
                        customerName,
                        shortId,
                        timestamp: newValue.completedAt ? newValue.completedAt.toDate().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : null,
                        merchantName: newValue.merchantName || "",
                        driverName: newValue.driverName || "Mitra ARO DRIVE",
                        itemsText: itemsReceipt,
                        subtotal: Number(newValue.actualShoppingCost || newValue.subtotal || 0),
                        deliveryFee: Number(newValue.deliveryFee || 0),
                        serviceFee: Number(newValue.serviceFee || 0),
                        pickupFee: Number(newValue.pickupFee || 0),
                        total: Number(newValue.total || 0)
                    };
                }

                let message = "";
                if (typeof templateFn === "function") {
                    message = status === "completed" 
                        ? templateFn(customerName, shortId, extraData) 
                        : templateFn(customerName, shortId, menuText);
                }
                if (message) {
                    await sendWAFonnte(waNumber, message);
                }
            }
        } catch (waError) {
            console.error("Error preparing WA notif:", waError);
        }
    }

    // 2. FCM Notifications (Backup/Parallel)
    if (status === "accepted" && customerId) {
        await sendNotification(customerId, {
            title: "Pesanan Diterima!",
            body: `Driver telah menerima pesanan #${orderId.slice(0, 5)}. Harap tunggu penjemputan.`,
        });
    }

    if (status === "arriving" && customerId) {
        await sendNotification(customerId, {
            title: "Driver Tiba",
            body: `Driver sudah sampai di lokasi penjemputan untuk pesanan #${orderId.slice(0, 5)}.`,
        });
    }

    if (status === "completed" && customerId) {
        await sendNotification(customerId, {
            title: "Pesanan Selesai",
            body: `Terima kasih! Pesanan #${orderId.slice(0, 5)} telah selesai.`,
        });

        // Add loyalty points to customer
        try {
            const settingsDoc = await admin.firestore().collection("settings").doc("platform").get();
            const pointsPerTenk = settingsDoc.exists ? (settingsDoc.data().pointsPerTenk || 10000) : 10000;
            const orderTotal = newValue.total || 0;
            const earnedPoints = Math.floor(orderTotal / pointsPerTenk);

            if (earnedPoints > 0) {
                const userRef = admin.firestore().collection("users").doc(customerId);
                await userRef.update({
                    loyaltyPoints: admin.firestore.FieldValue.increment(earnedPoints)
                });
            }
        } catch (pointsError) {
            console.error("Error adding loyalty points:", pointsError);
        }
    }

    // 3. Update Driver Rating Logic
    if (newValue.rating && !previousValue.rating) {
        const { driverId, rating } = newValue;
        if (driverId) {
            try {
                const driverRef = admin.firestore().collection("drivers").doc(driverId);
                const driverDoc = await driverRef.get();
                if (driverDoc.exists) {
                    const driverData = driverDoc.data();
                    const oldRating = driverData.rating || 5.0;
                    const totalReviews = driverData.totalReviews || 0;
                    
                    const newTotalReviews = totalReviews + 1;
                    const newAverageRating = ((oldRating * totalReviews) + rating) / newTotalReviews;
                    
                    await driverRef.update({
                        rating: parseFloat(newAverageRating.toFixed(1)),
                        totalReviews: newTotalReviews
                    });
                    console.log(`[Rating] Updated Driver ${driverId}: ${newAverageRating.toFixed(1)} (${newTotalReviews} reviews)`);
                }
            } catch (err) {
                console.error("Error updating driver rating:", err);
            }
        }
    }

    return null;
});

// Helper to send notification to a specific UID
async function sendNotification(uid, payload) {
    try {
        const userDoc = await admin.firestore().collection("users").doc(uid).get();
        if (!userDoc.exists) return;

        const fcmToken = userDoc.data().fcmToken;
        if (!fcmToken) {
            console.log(`No FCM token found for user ${uid}`);
            return;
        }

        const message = {
            token: fcmToken,
            notification: payload,
            android: {
                notification: {
                    sound: "default",
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                    },
                },
            },
            data: {
                orderId: uid,
                click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
        };

        const response = await admin.messaging().send(message);
        console.log("Successfully sent message:", response);
    } catch (error) {
        console.error("Error sending notification:", error);
    }
}

/**
 * Helper to send WhatsApp via Fonnte
 */
async function sendWAFonnte(target, message) {
    if (!target) return;
    
    try {
        // 1. Get Token from Firestore
        const configDoc = await admin.firestore().collection("settings").doc("configs").get();
        const token = (configDoc.exists && configDoc.data().fonnte?.token) 
            ? configDoc.data().fonnte.token 
            : process.env.FONNTE_TOKEN; 

        const response = await fetch("https://api.fonnte.com/send", {
            method: "POST",
            headers: {
                "Authorization": token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                target: target,
                message: message
            })
        });

        const result = await response.json();
        console.log(`[Fonnte] Sent to ${target}. Success: ${result.status}`);
        return result;
    } catch (error) {
        console.error("[Fonnte] Error sending WA:", error);
    }
}

/**
 * Admin function to delete a user account from Firebase Auth
 */
exports.deleteUserAccount = onRequest({ cors: true }, async (req, res) => {
    // Check for POST method
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { uid } = req.body;
    
    if (!uid) {
        res.status(400).send({ success: false, error: 'UID is required' });
        return;
    }

    try {
        await admin.auth().deleteUser(uid);
        console.log(`Successfully deleted user with UID: ${uid}`);
        res.status(200).send({ success: true, message: 'User deleted successfully from Firebase Auth' });
    } catch (error) {
        console.error(`Error deleting user ${uid}:`, error);
        res.status(500).send({ success: false, error: error.message });
    }
});

async function verifyAdminRequest(req) {
    const authHeader = req.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
        throw new Error("Missing authorization token");
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const userDoc = await admin.firestore().collection("users").doc(decoded.uid).get();
    const adminDoc = await admin.firestore().collection("admins").doc(decoded.uid).get();
    const isAdminUser = (userDoc.exists && userDoc.data().role === "admin") || adminDoc.exists;

    if (!isAdminUser) {
        throw new Error("Admin permission required");
    }

    return decoded;
}

/**
 * Admin function to delete a merchant account and Firestore document.
 */
exports.deleteMerchant = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { merchantId } = req.body;

    if (!merchantId) {
        res.status(400).send({ success: false, error: 'merchantId is required' });
        return;
    }

    try {
        await verifyAdminRequest(req);

        try {
            await admin.auth().deleteUser(merchantId);
            console.log(`Successfully deleted merchant auth user: ${merchantId}`);
        } catch (authError) {
            const isUserNotFound =
                authError.code === 'auth/user-not-found' ||
                authError.errorInfo?.code === 'auth/user-not-found' ||
                String(authError.message || '').toLowerCase().includes('no user record');

            if (!isUserNotFound) {
                throw authError;
            }
            console.log(`Merchant auth user not found, continuing Firestore delete: ${merchantId}`);
        }

        await admin.firestore().collection("merchants").doc(merchantId).delete();
        console.log(`Successfully deleted merchant document: ${merchantId}`);
        res.status(200).send({ success: true, message: 'Merchant deleted successfully' });
    } catch (error) {
        console.error(`Error deleting merchant ${merchantId}:`, error);
        const status = error.message === "Missing authorization token" || error.message === "Admin permission required" ? 403 : 500;
        res.status(status).send({ success: false, error: error.message });
    }
});

/**
 * Helper to score a photo if it's a menu or food photo
 * Uses DUAL STRATEGY:
 *   A) Label Detection — detects food/dish/cuisine photos (visual)
 *   B) Text Detection — detects menu boards with prices (text)
 */
async function scorePhotoForMenu(imageBuffer) {
    try {
        const vision = require("@google-cloud/vision");
        const visionClient = new vision.ImageAnnotatorClient();
        
        const [labelResult, textResult] = await Promise.all([
            visionClient.labelDetection(imageBuffer),
            visionClient.documentTextDetection(imageBuffer)
        ]);

        let score = 0;
        let detectedLabels = [];

        // ===== STRATEGY A: Label Detection =====
        const labels = labelResult[0]?.labelAnnotations || [];
        const foodLabels = [
            "food", "dish", "cuisine", "meal", "recipe", "ingredient",
            "fast food", "snack", "dessert", "baked goods", "bread",
            "drink", "beverage", "juice", "coffee", "cake", "pastry",
            "noodle", "rice", "chicken", "meat", "seafood", "pizza",
            "menu", "tableware", "plate", "bowl"
        ];

        const documentLabels = ["document", "paper", "text", "font", "signage", "advertisement", "poster", "menu"];
        const blacklistLabels = [
            "furniture", "ceiling", "flooring", "floor", "interior design", "room", 
            "building", "house", "outdoor structure", "fence", "bench", "plank",
            "tree", "plant", "sky", "wheel", "vehicle", "car", "tire"
        ];

        let hasDocumentLabel = false;
        let foodLabelCount = 0;

        labels.forEach(label => {
            const desc = label.description.toLowerCase();
            detectedLabels.push(desc);
            
            if (foodLabels.some(fl => desc.includes(fl))) {
                foodLabelCount++;
                score += 5; 
            }
            
            if (documentLabels.some(dl => desc.includes(dl))) {
                hasDocumentLabel = true;
                score += 30;
            }

            if (blacklistLabels.some(bl => desc.includes(bl))) {
                score -= 50;
            }
        });

        // Bonus if explicitly labeled as "menu"
        if (detectedLabels.includes("menu")) {
            score += 100;
        }

        // ===== STRATEGY B: Text Detection =====
        const fullTextAnnotation = textResult[0]?.fullTextAnnotation;
        let validPriceCount = 0;
        
        if (fullTextAnnotation && fullTextAnnotation.text) {
            const text = fullTextAnnotation.text.toLowerCase();
            console.log(`[Vision] Text detected (${text.length} chars): ${text.substring(0, 50).replace(/\n/g, ' ')}...`);

            // Base score for text
            score += 50; 

            // Keywords (10 pts each, max 100)
            const keywords = [
                "menu", "harga", "paket", "makanan", "minuman", "price", "food", "drink", "daftar",
                "bakery", "pastry", "cake", "roti", "kue", "spesial", "promo", "rekomendasi",
                "porsi", "pcs", "topping", "level", "pedas", "original", "crispy",
                "nasi", "ayam", "mie", "soto", "bakso", "pecel", "ikan", "bebek", "goreng", "bakar",
                "es", "teh", "jeruk", "kopi", "susu", "jus", "espresso", "latte", "cappuccino"
            ];
            let keywordCount = 0;
            keywords.forEach(kw => {
                if (text.includes(kw)) keywordCount++;
            });
            score += Math.min(100, keywordCount * 10);

            // Currency Patterns (Strict validation)
            const patterns = [
                /\brp\.?\s?\d{3,6}\b/i, 
                /\b\d{1,3}\s?rb\b/i, 
                /\b\d{1,3}\.\d{3}\b/, 
                /\b\d{1,3}k\b/i
            ];
            validPriceCount = 0;
            patterns.forEach(regex => {
                const globalRegex = new RegExp(regex.source, 'gi');
                let match;
                while ((match = globalRegex.exec(text)) !== null) {
                    const priceStr = match[0].replace(/[^\d]/g, ''); // extract digits
                    const priceValue = parseInt(priceStr);
                    if (priceValue >= 1 && priceValue <= 500) { // e.g. 15k, 15 rb
                        validPriceCount++;
                    } else if (priceValue >= 1000 && priceValue <= 500000) { // e.g. 15.000
                        validPriceCount++;
                    }
                }
            });

            // MASSIVE points for prices
            score += validPriceCount * 40;

            // Strict criteria for Daftar Menu: Needs at least 3 distinct valid prices!
            if (validPriceCount >= 3) {
                score += 300; // huge boost
            } else {
                score -= 300; // huge penalty if it's not a price list!
            }

            // Structure density (short lines = menu-like)
            const lines = text.split('\n').filter(l => l.trim().length > 0);
            const shortLines = lines.filter(l => l.length < 30).length;
            if (lines.length > 5) {
                const density = shortLines / lines.length;
                if (density > 0.5) score += 50;
            }

            // High line count bonus
            if (lines.length > 15) score += 50;
            
            // Deduct points if it's just a food photo with a little text
            if (foodLabelCount > 3 && !hasDocumentLabel && validPriceCount <= 1) {
                score -= 200;
            }
        } else {
            // No text at all
            score -= 500; // absolute rejection
        }

        console.log(`[Vision] Labels: ${detectedLabels.slice(0, 5).join(', ')} | Score: ${score} | Valid Prices: ${validPriceCount}`);
        return { score, labels: detectedLabels.slice(0, 5) };
    } catch (error) {
        console.error("Error scoring photo:", error);
        return { score: 0, error: error.message };
    }
}


/**
 * Shared logic to fetch photo from Google Maps and detect menu
 */
async function processMerchantPhotoLogic(merchantId, merchantName, merchantAddress) {
    try {
        const configDoc = await admin.firestore().collection("settings").doc("configs").get();
        const apiKey = (configDoc.exists && configDoc.data().googleMaps?.apiKey) 
            ? configDoc.data().googleMaps.apiKey 
            : process.env.GOOGLE_MAPS_API_KEY;

        const baseUrl = "https://maps.googleapis.com/maps/api/place/textsearch/json";
        const cleanName = merchantName.replace(/[-(\[].*$/, "").trim();
        
        let placeId = null;
        if (merchantId.startsWith("google_")) {
            placeId = merchantId.replace("google_", "");
            console.log(`[Maps] Using existing Place ID from merchantId: ${placeId}`);
        }

        if (!placeId) {
            const queriesToTry = [
                `${merchantName} ${merchantAddress || ''}`.trim(),
                `${merchantName} Jawa Timur`,
                `${cleanName} ${merchantAddress || ''}`.trim(),
                cleanName
            ];

            for (const q of queriesToTry) {
                if (!q) continue;
                const axios = require("axios");
                const searchUrl = `${baseUrl}?query=${encodeURIComponent(q)}&key=${apiKey}`;
                const searchResponse = await axios.get(searchUrl);
                
                if (searchResponse.data.results && searchResponse.data.results.length > 0) {
                    const withPhotos = searchResponse.data.results.find(r => r.photos && r.photos.length > 0);
                    if (withPhotos) {
                        placeId = withPhotos.place_id;
                        break;
                    }
                }
            }
        }

        if (!placeId) {
            return { success: false, error: 'No places found on Google Maps.' };
        }

        console.log(`[Maps] Final Place ID for processing: ${placeId}`);

        // 2. Fetch Place Details to get up to 10 photos
        const axios = require("axios");
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,photos,url&key=${apiKey}`;
        const detailsResponse = await axios.get(detailsUrl);
        const detailedPlace = detailsResponse.data.result;

        if (!detailedPlace || !detailedPlace.photos || detailedPlace.photos.length === 0) {
            return { success: false, error: 'Place found but no photos available in details.' };
        }

        const bucket = admin.storage().bucket();
        const processedPhotos = [];
        let mapsThumbnailUrl = "";

        // Process up to 10 photos
        const photosToProcess = detailedPlace.photos.slice(0, 10);
        console.log(`[Maps] Processing ${photosToProcess.length} photos for ${merchantName}`);
        
        for (let i = 0; i < photosToProcess.length; i++) {
            const photoReference = photosToProcess[i].photo_reference;
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoReference}&key=${apiKey}`;
            
            try {
                const axios = require("axios");
                const imageResponse = await axios.get(photoUrl, { responseType: 'arraybuffer' });
                const imageBuffer = Buffer.from(imageResponse.data, 'binary');

                // 1. Score for menu/food photo
                const { score, labels } = await scorePhotoForMenu(imageBuffer);
                console.log(`[Vision] Merchant: ${merchantId}, Photo ${i} score: ${score} | labels: ${(labels || []).slice(0, 3).join(', ')}`);

                processedPhotos.push({
                    buffer: imageBuffer,
                    score: score,
                    originalIndex: i
                });

                // If it's the first photo from Maps, we'll keep it as a fallback for the main thumbnail
                if (i === 0) {
                    const sharp = require('sharp');
                    const webpBuffer = await sharp(imageBuffer).webp({ quality: 80 }).toBuffer();
                    const mapsPath = `merchants/${merchantId}/maps_thumbnail.webp`;
                    const mapsFile = bucket.file(mapsPath);
                    await mapsFile.save(webpBuffer, { metadata: { contentType: 'image/webp' } });
                    await mapsFile.makePublic();
                    mapsThumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${mapsPath}`;
                }
            } catch (err) {
                console.error(`Error processing photo ${i}:`, err.message);
            }
        }

        // Sort by score descending to prioritize "real" menus
        processedPhotos.sort((a, b) => b.score - a.score);

        const menuThumbnailUrls = [];
        // Only save the top 8 photos that pass the tightened threshold (35)
        const topPhotos = processedPhotos.filter(p => p.score >= 250).slice(0, 8);

        for (let i = 0; i < topPhotos.length; i++) {
            const photo = topPhotos[i];
            const sharp = require('sharp');
            const webpBuffer = await sharp(photo.buffer).webp({ quality: 80 }).toBuffer();

            const menuPath = `merchants/${merchantId}/menu_${Date.now()}_${i}.webp`;
            const menuFile = bucket.file(menuPath);
            await menuFile.save(webpBuffer, { metadata: { contentType: 'image/webp' } });
            await menuFile.makePublic();
            menuThumbnailUrls.push(`https://storage.googleapis.com/${bucket.name}/${menuPath}`);
        }

        // Update Firestore
        const updateData = {};
        if (mapsThumbnailUrl) updateData.image = mapsThumbnailUrl;
        if (menuThumbnailUrls.length > 0) {
            updateData.menu_thumbnails = menuThumbnailUrls;
        }

        await admin.firestore().collection('merchants').doc(merchantId).update(updateData);

        return { 
            success: true, 
            message: `Processed ${photosToProcess.length} photos. Found ${menuThumbnailUrls.length} menus.`,
            imageUrl: mapsThumbnailUrl,
            menuThumbnails: menuThumbnailUrls
        };
    } catch (error) {
        console.error("Error in processMerchantPhotoLogic:", error.message);
        return { success: false, error: error.message };
    }
}

exports.syncMerchantPopularityFromMaps = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const { merchantId } = req.body;
        if (!merchantId) {
            res.status(400).send({ success: false, error: 'merchantId is required' });
            return;
        }

        const mDoc = await admin.firestore().collection("merchants").doc(merchantId).get();
        if (!mDoc.exists) {
            res.status(404).send({ success: false, error: 'Merchant not found' });
            return;
        }

        const data = mDoc.data();
        let placeId = data.place_id;
        if (!placeId && merchantId.startsWith('google_')) {
            placeId = merchantId.replace('google_', '');
        }

        if (!placeId || placeId.includes('manual')) {
            res.status(400).send({ success: false, error: 'Merchant does not have a valid Google Place ID' });
            return;
        }

        const configDoc = await admin.firestore().collection("settings").doc("configs").get();
        const apiKey = (configDoc.exists && configDoc.data().googleMaps?.apiKey) 
            ? configDoc.data().googleMaps.apiKey 
            : process.env.GOOGLE_MAPS_API_KEY;

        const axios = require("axios");
        const response = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json`, {
            params: {
                place_id: placeId,
                fields: 'user_ratings_total,rating',
                key: apiKey
            }
        });

        const result = response.data.result;
        if (result && result.user_ratings_total !== undefined) {
            const updateData = {
                reviewsCount: result.user_ratings_total,
                rating: result.rating || data.rating || 0,
                popularitySyncedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            await mDoc.ref.update(updateData);
            res.status(200).send({ success: true, reviewsCount: result.user_ratings_total });
        } else {
            res.status(404).send({ success: false, error: 'No rating data found on Google Maps' });
        }
    } catch (error) {
        console.error('Error in syncMerchantPopularityFromMaps:', error);
        res.status(500).send({ success: false, error: error.message });
    }
});

exports.fetchMerchantPhotoFromMaps = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const { merchantId, merchantName, merchantAddress } = req.body;
        if (!merchantId || !merchantName) {
            res.status(400).send({ success: false, error: 'merchantId and merchantName are required' });
            return;
        }

        const result = await processMerchantPhotoLogic(merchantId, merchantName, merchantAddress);
        
        // Return 200 even for logical failures (like no photos found) so the frontend can handle it
        // instead of axios throwing an error on 404/500
        res.status(200).send(result);
    } catch (error) {
        console.error('Error in fetchMerchantPhotoFromMaps:', error);
        res.status(500).send({
          success: false,
          error: error.message || 'Internal Server Error'
        });
    }
});

/**
 * Process all existing merchants to fetch photos and detect menus
 */
exports.processAllExistingMerchants = onRequest({ cors: true, timeoutSeconds: 540 }, async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const querySnapshot = await admin.firestore().collection("merchants").get();
        const total = querySnapshot.size;
        console.log(`Starting batch process for ${total} merchants...`);

        const results = [];
        // Sequential processing to avoid hitting Maps API rate limits or Cloud Function timeouts
        // though we have 540s timeout.
        for (const doc of querySnapshot.docs) {
            const data = doc.data();
            const merchantId = doc.id;
            
            console.log(`Processing merchant: ${data.name} (${merchantId})`);
            const result = await processMerchantPhotoLogic(merchantId, data.name, data.address || "");
            results.push({ id: merchantId, name: data.name, success: result.success });
        }

        res.status(200).send({ success: true, total, results });
    } catch (error) {
        res.status(500).send({ success: false, error: error.message });
    }
});

/**
 * Scheduled function to:
 * Phase 1: Handle expired offers (rotate to next driver)
 * Phase 2: Expand dispatch radius for orders with no more candidates
 * Runs every 1 minute for faster offer rotation.
 */
exports.expansionTrigger = onSchedule("every 1 minutes", async (event) => {
    const now = new Date();
    console.log(`[Expansion] Running at ${now.toISOString()}`);

    try {
        const searchingOrders = await admin.firestore().collection("orders")
            .where("status", "==", "searching")
            .get();

        if (searchingOrders.empty) return;

        for (const orderDoc of searchingOrders.docs) {
            const orderData = orderDoc.data();
            const orderId = orderDoc.id;
            const dispatch = orderData.dispatch;

            if (!dispatch || dispatch.status !== "searching") continue;

            // ========== PHASE 1: Handle Expired Offers ==========
            if (dispatch.offeredTo && dispatch.offerExpiresAt) {
                const offerExpiry = dispatch.offerExpiresAt.toDate();
                if (offerExpiry <= now) {
                    console.log(`[Expansion] Offer expired for Order ${orderId} | Driver ${dispatch.offeredTo}`);

                    const rejectedDrivers = dispatch.rejectedDrivers || [];
                    rejectedDrivers.push(dispatch.offeredTo);

                    // Clear expired offer and mark driver as rejected
                    await orderDoc.ref.update({
                        "dispatch.offeredTo": admin.firestore.FieldValue.delete(),
                        "dispatch.offerExpiresAt": admin.firestore.FieldValue.delete(),
                        "dispatch.rejectedDrivers": rejectedDrivers,
                    });

                    // Re-dispatch to next available driver
                    const updatedDispatch = {
                        ...dispatch,
                        offeredTo: null,
                        offerExpiresAt: null,
                        rejectedDrivers,
                    };
                    const driverFound = await dispatchOrder(orderId, orderData, updatedDispatch);

                    // If we're at max radius OR hard timeout OR exhausted → give up
                    if (!driverFound) {
                        const regionConfig = getDispatchRegionConfig(dispatch.regionType);
                        const startedAt = dispatch.startedSearchingAt ? dispatch.startedSearchingAt.toDate() : orderData.createdAt?.toDate() || new Date();
                        const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;

                        const onlineDriversCount = await getOnlineAvailableDriversCount();
                        const rejectedCount = rejectedDrivers.length;
                        const allExhausted = (onlineDriversCount === 0 || rejectedCount >= onlineDriversCount);

                        if (dispatch.currentRadius >= regionConfig.maxRadius || elapsedMinutes >= regionConfig.maxSearchMinutes || allExhausted) {
                            console.log(`[Expansion] Phase 1 exhaustion/timeout for ${orderId}. Radius: ${dispatch.currentRadius}km, elapsed: ${elapsedMinutes.toFixed(1)}m, onlineDrivers: ${onlineDriversCount}, rejected: ${rejectedCount}.`);
                            await setNoDriverStatus(orderId, orderData);
                        }
                    }

                    continue; // Don't also expand radius on the same cycle
                }
                // Offer is still active, skip this order
                continue;
            }

            // ========== PHASE 2: Radius Expansion (no active offer) ==========
            const nextExpansion = dispatch.nextExpansionAt?.toDate();
            // Add a 10-second buffer to handle minor cron scheduling drift
            if (nextExpansion && nextExpansion <= new Date(now.getTime() + 10000)) {
                const regionConfig = getDispatchRegionConfig(dispatch.regionType);

                const nextRadius = Math.min(regionConfig.maxRadius, dispatch.currentRadius + regionConfig.radiusIncrement);
                const nextIteration = dispatch.iteration + 1;

                console.log(`[Expansion] ${dispatch.regionType?.toUpperCase()} | Expanding Order ${orderId} | Iteration ${nextIteration} | New Radius: ${nextRadius}km`);

                const newDispatchState = {
                    ...dispatch,
                    currentRadius: nextRadius,
                    iteration: nextIteration,
                    nextExpansionAt: new Date(Date.now() + RADIUS_EXPANSION_INTERVAL_MS),
                };

                // Update state
                await orderDoc.ref.update({
                    dispatch: newDispatchState
                });

                // Re-run dispatch with expanded radius
                const driverFound = await dispatchOrder(orderId, orderData, newDispatchState);

                // If at max radius AND still no driver → order cannot be fulfilled
                // Or if we have a hard timeout or all online drivers are exhausted
                if (!driverFound) {
                    const startedAt = dispatch.startedSearchingAt ? dispatch.startedSearchingAt.toDate() : orderData.createdAt?.toDate() || new Date();
                    const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;
                    
                    const onlineDriversCount = await getOnlineAvailableDriversCount();
                    const rejectedCount = newDispatchState.rejectedDrivers?.length || 0;
                    const notifiedCount = newDispatchState.notifiedDrivers?.length || 0;
                    const allExhausted = (onlineDriversCount === 0 || rejectedCount >= onlineDriversCount || notifiedCount >= onlineDriversCount);

                    if (nextRadius >= regionConfig.maxRadius || elapsedMinutes >= regionConfig.maxSearchMinutes || allExhausted) {
                        console.log(`[Expansion] Phase 2 exhaustion/timeout for ${orderId}. nextRadius: ${nextRadius}km, elapsed: ${elapsedMinutes.toFixed(1)}m, onlineDrivers: ${onlineDriversCount}, rejected: ${rejectedCount}.`);
                        await setNoDriverStatus(orderId, orderData);
                    }
                }
            } else {
                // If expansion time has not arrived yet, still check for region timeout and exhaustion.
                const startedAt = dispatch.startedSearchingAt ? dispatch.startedSearchingAt.toDate() : orderData.createdAt?.toDate() || new Date();
                const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;
                const regionConfig = getDispatchRegionConfig(dispatch.regionType);

                const onlineDriversCount = await getOnlineAvailableDriversCount();
                const rejectedCount = dispatch.rejectedDrivers?.length || 0;
                const notifiedCount = dispatch.notifiedDrivers?.length || 0;
                const allExhausted = (onlineDriversCount === 0 || rejectedCount >= onlineDriversCount || notifiedCount >= onlineDriversCount);

                if (elapsedMinutes >= regionConfig.maxSearchMinutes || allExhausted) {
                    console.log(`[Expansion] Immediate timeout/exhaustion check (no expansion yet) for ${orderId}. elapsed: ${elapsedMinutes.toFixed(1)}m, onlineDrivers: ${onlineDriversCount}, rejected: ${rejectedCount}.`);
                    await setNoDriverStatus(orderId, orderData);
                }
            }
        }
    } catch (error) {
        console.error("Error in expansionTrigger:", error);
    }
});

/**
 * HTTP Endpoint: Driver actively rejects an offered order.
 * Immediately rotates the offer to the next best driver.
 */
exports.rejectOffer = onRequest({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { orderId, driverId } = req.body;

    if (!orderId || !driverId) {
        res.status(400).send({ success: false, error: 'orderId and driverId are required' });
        return;
    }

    try {
        const orderRef = admin.firestore().collection("orders").doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) {
            res.status(404).send({ success: false, error: 'Order not found' });
            return;
        }

        const orderData = orderSnap.data();
        const dispatch = orderData.dispatch;

        // Verify driver is the current offer recipient
        if (dispatch?.offeredTo !== driverId) {
            res.status(403).send({ success: false, error: 'This offer is not for you' });
            return;
        }

        const rejectedDrivers = [...(dispatch.rejectedDrivers || []), driverId];

        // Clear current offer and add to rejected list
        await orderRef.update({
            "dispatch.offeredTo": admin.firestore.FieldValue.delete(),
            "dispatch.offerExpiresAt": admin.firestore.FieldValue.delete(),
            "dispatch.rejectedDrivers": rejectedDrivers,
        });

        console.log(`[Reject] Driver ${driverId} rejected Order ${orderId}. Dispatching to next driver...`);

        // Immediately dispatch to next available driver
        const updatedDispatch = {
            ...dispatch,
            offeredTo: null,
            offerExpiresAt: null,
            rejectedDrivers,
        };
        const driverFound = await dispatchOrder(orderId, orderData, updatedDispatch);

        // If at max radius, hard timeout, or exhausted with no driver available, notify user immediately
        if (!driverFound) {
            const regionConfig = getDispatchRegionConfig(dispatch.regionType);
            const startedAt = dispatch.startedSearchingAt ? dispatch.startedSearchingAt.toDate() : orderData.createdAt?.toDate() || new Date();
            const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;

            const onlineDriversCount = await getOnlineAvailableDriversCount();
            const rejectedCount = rejectedDrivers.length;
            const allExhausted = (onlineDriversCount === 0 || rejectedCount >= onlineDriversCount);

            if (dispatch.currentRadius >= regionConfig.maxRadius || elapsedMinutes >= regionConfig.maxSearchMinutes || allExhausted) {
                console.log(`[Reject] Immediate exhaustion/timeout check after rejection for ${orderId}. Radius: ${dispatch.currentRadius}km, elapsed: ${elapsedMinutes.toFixed(1)}m, onlineDrivers: ${onlineDriversCount}, rejected: ${rejectedCount}.`);
                await setNoDriverStatus(orderId, orderData);
            }
            // else: expansionTrigger will keep expanding the radius
        }

        res.status(200).send({ success: true, message: 'Order rejected, rotating to next driver' });
    } catch (error) {
        console.error("Error in rejectOffer:", error);
        res.status(500).send({ success: false, error: error.message });
    }
});

/**
 * Storage Trigger: Automatically convert images uploaded to specific paths to WebP
 */
exports.onImageUploaded = onObjectFinalized({
  bucket: "gb-delivery-41bf6.firebasestorage.app",
  cpu: 1,
  memory: '1GiB'
}, async (event) => {
  const object = event.data;
  const filePath = object.name;
  const contentType = object.contentType;

  // Only process images that are not already webp
  if (!contentType.startsWith('image/') || contentType === 'image/webp') return;
  
  // Only process specific directories
  const monitoredPaths = ['merchants/', 'merchant_menus/'];
  if (!monitoredPaths.some(p => filePath.startsWith(p))) return;

  console.log(`[StorageTrigger] Processing ${filePath} (${contentType})`);

  try {
    const bucket = admin.storage().bucket(object.bucket);
    const file = bucket.file(filePath);
    const [buffer] = await file.download();

    const sharp = require('sharp');
    const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();

    const webpPath = filePath.replace(/\.[^/.]+$/, "") + ".webp";
    const webpFile = bucket.file(webpPath);

    await webpFile.save(webpBuffer, {
      metadata: { contentType: 'image/webp' }
    });
    await webpFile.makePublic();

    const publicUrl = `https://storage.googleapis.com/${object.bucket}/${webpPath}`;

    // Update Firestore if we can identify the document
    if (filePath.startsWith('merchants/')) {
      const parts = filePath.split('/');
      if (parts.length >= 2) {
        const merchantId = parts[1];
        if (filePath.includes('maps_thumbnail')) {
          await admin.firestore().collection('merchants').doc(merchantId).update({ image: publicUrl });
        }
      }
    } else if (filePath.startsWith('merchant_menus/')) {
       const parts = filePath.split('/');
       if (parts.length >= 2) {
         const merchantId = parts[1];
         // This is a manual upload for originalMenuImage
         await admin.firestore().collection('merchants').doc(merchantId).update({ originalMenuImage: publicUrl });
       }
    }

    // Delete the original non-webp file
    await file.delete();
    console.log(`[StorageTrigger] Converted ${filePath} to ${webpPath} and updated Firestore`);

  } catch (error) {
    console.error(`[StorageTrigger] Error processing ${filePath}:`, error);
  }
});

/**
 * Admin Migration: Convert existing images to WebP in batches
 */
exports.migrateImagesToWebP = onRequest({ cors: true, timeoutSeconds: 540 }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const { limit = 10, offset = 0 } = req.body;
    
    try {
        const merchantsSnapshot = await admin.firestore().collection("merchants")
            .orderBy("__name__")
            .limit(limit)
            .offset(offset)
            .get();

        const results = [];
        const sharp = require('sharp');
        const bucket = admin.storage().bucket();

        for (const doc of merchantsSnapshot.docs) {
            const data = doc.data();
            const merchantId = doc.id;
            const updateData = {};
            let merchantUpdated = false;

            console.log(`[Migration] Checking Merchant: ${data.name} (${merchantId})`);

            // 1. Migrate Main Image
            if (data.image && !data.image.endsWith('.webp')) {
                try {
                    if (data.image.includes('storage.googleapis.com')) {
                        const url = new URL(data.image);
                        // Extract path: /bucket-name/path/to/file -> path/to/file
                        const path = decodeURIComponent(url.pathname.split('/').slice(2).join('/'));
                        const file = bucket.file(path);
                        
                        const [buffer] = await file.download();
                        const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
                        
                        const webpPath = path.replace(/\.[^/.]+$/, "") + ".webp";
                        const webpFile = bucket.file(webpPath);
                        
                        await webpFile.save(webpBuffer, { metadata: { contentType: 'image/webp' } });
                        await webpFile.makePublic();
                        
                        updateData.image = `https://storage.googleapis.com/${bucket.name}/${webpPath}`;
                        merchantUpdated = true;
                        
                        // Cleanup old file
                        await file.delete();
                    } else if (data.image.includes('maps.googleapis.com')) {
                        // External Maps URL - Trigger full sync which now produces WebP
                        await processMerchantPhotoLogic(merchantId, data.name, data.address || "");
                        // Reload data to see if it was updated
                        const updatedDoc = await doc.ref.get();
                        const updatedData = updatedDoc.data();
                        if (updatedData.image && updatedData.image.endsWith('.webp')) {
                            results.push({ id: merchantId, name: data.name, status: 'synced_from_maps' });
                            // Continue to menu thumbnails with updated data
                            data.menu_thumbnails = updatedData.menu_thumbnails;
                        }
                    }
                } catch (e) {
                    console.error(`Failed to migrate main image for ${merchantId}:`, e.message);
                }
            }

            // 2. Migrate Menu Thumbnails
            if (Array.isArray(data.menu_thumbnails) && data.menu_thumbnails.length > 0) {
                const newThumbnails = [];
                let thumbUpdated = false;

                for (const thumbUrl of data.menu_thumbnails) {
                    if (thumbUrl.endsWith('.webp')) {
                        newThumbnails.push(thumbUrl);
                        continue;
                    }

                    try {
                        const url = new URL(thumbUrl);
                        const path = decodeURIComponent(url.pathname.split('/').slice(2).join('/'));
                        const file = bucket.file(path);
                        
                        const [buffer] = await file.download();
                        const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
                        
                        const webpPath = path.replace(/\.[^/.]+$/, "") + ".webp";
                        const webpFile = bucket.file(webpPath);
                        
                        await webpFile.save(webpBuffer, { metadata: { contentType: 'image/webp' } });
                        await webpFile.makePublic();
                        
                        newThumbnails.push(`https://storage.googleapis.com/${bucket.name}/${webpPath}`);
                        thumbUpdated = true;
                        
                        // Cleanup old file
                        await file.delete();
                    } catch (e) {
                        console.error(`Failed to migrate thumbnail for ${merchantId}:`, e.message);
                        newThumbnails.push(thumbUrl); // Keep original if failed
                    }
                }

                if (thumbUpdated) {
                    updateData.menu_thumbnails = newThumbnails;
                    merchantUpdated = true;
                }
            }

            if (merchantUpdated) {
                await doc.ref.update(updateData);
                results.push({ id: merchantId, name: data.name, status: 'converted' });
            } else if (!results.some(r => r.id === merchantId)) {
                results.push({ id: merchantId, name: data.name, status: 'skipped' });
            }
        }

        res.status(200).send({ 
            success: true, 
            processed: merchantsSnapshot.size,
            results 
        });

    } catch (error) {
        console.error("Migration error:", error);
        res.status(500).send({ success: false, error: error.message });
    }
});
