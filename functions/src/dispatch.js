const admin = require("firebase-admin");
const rtdb = admin.database();
const { calculateDistance, isDriverOverDailyLimit, isDriverLocationFresh, normalizeServiceType, getTimestampMillis } = require("./utils");
const { sendNotification } = require("./notifications");
const { sendWAFonnte } = require("./notifications");

const DRIVER_OFFER_TIMEOUT_MS = 60 * 1000;

const DISPATCH_CONFIG = {
    transport: { initRadiusKm: 3, maxRadiusKm: 15, offerTimeoutMs: 60000 },
    food:     { initRadiusKm: 2, maxRadiusKm: 8,  offerTimeoutMs: 45000 },
    express:  { initRadiusKm: 4, maxRadiusKm: 20, offerTimeoutMs: 60000 },
    send:     { initRadiusKm: 3, maxRadiusKm: 15, offerTimeoutMs: 60000 },
    shop:     { initRadiusKm: 2, maxRadiusKm: 8,  offerTimeoutMs: 60000 },
};

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

async function getOnlineDrivers() {
    const [rtdbSnap, fsSnap] = await Promise.all([
        rtdb.ref('drivers').once('value'),
        admin.firestore().collection('drivers').get()
    ]);

    const rtdbMap = {};
    rtdbSnap.forEach(child => {
        const data = child.val();
        if (data && data.isOnline && data.status === 'online') {
            rtdbMap[child.key] = data;
        }
    });

    const drivers = [];
    fsSnap.forEach(doc => {
        const rtdbData = rtdbMap[doc.id];
        if (!rtdbData) return;
        const fs = doc.data();
        drivers.push({
            id: doc.id,
            ...fs,
            isOnline: rtdbData.isOnline,
            status: rtdbData.status,
            lastActive: rtdbData.lastActive,
            todayOnlineMs: rtdbData.todayOnlineMs || 0,
            location: rtdbData.location,
            lastLocationUpdate: rtdbData.lastLocationUpdate,
            onlineAt: rtdbData.onlineAt,
            offlineAt: rtdbData.offlineAt,
            onlineSessionStartAt: rtdbData.onlineSessionStartAt,
            statusChangedAt: rtdbData.statusChangedAt,
        });
    });
    return drivers;
}

async function dispatchOrder(orderId, orderData, dispatchState) {
    let pickupLocation = orderData.pickup || orderData.pickupLocation;
    if (Array.isArray(pickupLocation) && pickupLocation.length >= 2) {
        pickupLocation = { lat: Number(pickupLocation[0]), lng: Number(pickupLocation[1]) };
    }

    const serviceType = normalizeServiceType(orderData.serviceType || "transport");
    const dispatchCfg = DISPATCH_CONFIG[serviceType] || DISPATCH_CONFIG.transport;
    const { currentRadius, notifiedDrivers } = dispatchState;
    const rejectedDrivers = dispatchState.rejectedDrivers || [];

    console.log(`[Dispatch] Processing Order ${orderId} | Radius: ${currentRadius}km | Iteration: ${dispatchState.iteration} | Rejected: ${rejectedDrivers.length}`);

    const drivers = await getOnlineDrivers();
    let candidates = [];

    drivers.forEach(driver => {
        const driverId = driver.id;

        if (rejectedDrivers.includes(driverId)) return;
        if (notifiedDrivers.includes(driverId)) return;
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
        return false;
    }

    candidates.sort((a, b) => {
        switch (serviceType) {
            case 'food':
            case 'shop':
                if (a.rating !== b.rating) return b.rating - a.rating;
                if (a.distance !== b.distance) return a.distance - b.distance;
                return a.lastJobAt - b.lastJobAt;
            case 'express':
            case 'send':
                if (a.distance !== b.distance) return a.distance - b.distance;
                if (a.lastJobAt !== b.lastJobAt) return a.lastJobAt - b.lastJobAt;
                return b.rating - a.rating;
            default:
                if (a.distance !== b.distance) return a.distance - b.distance;
                if (a.lastJobAt !== b.lastJobAt) return a.lastJobAt - b.lastJobAt;
                return b.rating - a.rating;
        }
    });

    const selectedDriver = candidates[0];
    console.log(`[Dispatch] Offering Order ${orderId} exclusively to Driver ${selectedDriver.id} (dist: ${selectedDriver.distance.toFixed(1)}km)`);

    await admin.firestore().collection("orders").doc(orderId).update({
        "dispatch.offeredTo": selectedDriver.id,
        "dispatch.offerExpiresAt": admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + DRIVER_OFFER_TIMEOUT_MS)
        ),
        "dispatch.notifiedDrivers": [...notifiedDrivers, selectedDriver.id],
        "dispatch.lastAttemptAt": admin.firestore.FieldValue.serverTimestamp()
    });

    try {
        await rtdb.ref(`drivers/${selectedDriver.id}/incoming`).child(orderId).set(true);
    } catch (rtdbErr) {
        console.warn(`[Dispatch] RTDB write failed for driver ${selectedDriver.id}:`, rtdbErr.message);
    }

    if (selectedDriver.fcmToken) {
        try {
            const message = {
                token: selectedDriver.fcmToken,
                data: {
                    type: "NEW_ORDER",
                    orderId: String(orderId),
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
    return true;
}

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

    const customerId = orderData.customerId;
    if (customerId) {
        try {
            await sendNotification(customerId, {
                title: "Driver Tidak Tersedia",
                body: `Maaf, semua driver sedang sibuk di area kamu untuk order #${orderId.slice(-5).toUpperCase()}. Pesanan dibatalkan otomatis.`,
            });
        } catch (e) {
            console.warn("[NoDriver] FCM notify failed:", e.message);
        }
    }

    const waNumber = orderData.customer?.wa;
    if (waNumber) {
        try {
            const customerName = orderData.customer?.name || 'Kak';
            const shortId = orderId.slice(-5).toUpperCase();
            const msg = `Halo ${customerName} \n\nMaaf, kami tidak dapat menemukan driver yang tersedia untuk pesanan ARO-${shortId} kamu saat ini.\n\nSemua driver mitra sedang sibuk atau belum ada driver di area kamu.\n\nPesanan otomatis dibatalkan. Silakan coba lagi beberapa saat nanti. Terima kasih sudah menggunakan ARO DRIVE!`;
            await sendWAFonnte(waNumber, msg);
        } catch (e) {
            console.warn("[NoDriver] WA notify failed:", e.message);
        }
    }
}

async function getOnlineAvailableDriversCount() {
    try {
        const drivers = await getOnlineDrivers();
        let count = 0;
        const now = Date.now();
        drivers.forEach(driver => {
            if (!isDriverOverDailyLimit(driver, now) && (driver.balance || 0) >= 0) {
                count += 1;
            }
        });
        return count;
    } catch (e) {
        console.error("Error getting online drivers count:", e);
        return 0;
    }
}

module.exports = {
    DISPATCH_CONFIG,
    DRIVER_OFFER_TIMEOUT_MS,
    getDispatchRegionConfig,
    getOnlineDrivers,
    dispatchOrder,
    setNoDriverStatus,
    getOnlineAvailableDriversCount,
};
