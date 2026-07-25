const admin = require("firebase-admin");
const rtdb = admin.database();
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getPricing, calculatePickupFee } = require("./pricing");
const { sendNotification, sendWAFonnte, sendNotificationToMerchant } = require("./notifications");
const { dispatchOrder, setNoDriverStatus, getOnlineAvailableDriversCount, getDispatchRegionConfig, DISPATCH_CONFIG, DRIVER_OFFER_TIMEOUT_MS } = require("./dispatch");
const { normalizeServiceType, getTimestampMillis } = require("./utils");
const { VALID_TRANSITIONS } = require("./validation");

const RADIUS_EXPANSION_INTERVAL_MS = 60 * 1000;

exports.onOrderCreated = onDocumentCreated(
    { document: "orders/{orderId}", region: "asia-southeast1" },
    async (event) => {
    const orderData = event.data.data();
    const orderId = event.params.orderId;
    let { merchantId, serviceType, total, pickupLocation, pickupAddress, items } = orderData;
    serviceType = normalizeServiceType(serviceType || "transport");
    if (!pickupLocation) {
        pickupLocation = orderData.pickup;
    }

    if (Array.isArray(pickupLocation) && pickupLocation.length >= 2) {
        pickupLocation = { lat: Number(pickupLocation[0]), lng: Number(pickupLocation[1]) };
    }

    if (!merchantId && Array.isArray(items) && items.length > 0) {
        merchantId = items[0].merchantId;
    }

    if (merchantId && (serviceType === "food" || serviceType === "shop")) {
        await sendNotificationToMerchant(merchantId, {
            title: "Pesanan Masuk!",
            body: `Ada pesanan baru #${orderId.slice(-6).toUpperCase()} senilai Rp ${total?.toLocaleString()}. Cek di Dashboard sekarang!`,
        });

        try {
            const mDoc = await admin.firestore().collection("merchants").doc(merchantId).get();
            if (mDoc.exists) {
                const merchantData = mDoc.data();
                if (merchantData.phone) {
                    const waTemplates = require("./templates");
                    let itemsText = "";
                    if (serviceType === "food" && Array.isArray(items)) {
                        itemsText = items.map(item => `- ${item.desc || item.name} (${item.qty}x)`).join("\n");
                    } else if (typeof items === "string") {
                        itemsText = items;
                    }
                    if (waTemplates.system && typeof waTemplates.system.newOrder === "function") {
                        const merchantMsg = waTemplates.system.newOrder(orderId, serviceType, total, merchantData.name || "Merchant", itemsText);
                        await sendWAFonnte(merchantData.phone, merchantMsg);
                    }
                }
            }
        } catch (err) {
            console.error("Error sending WA to merchant:", err);
        }
    }

    if (serviceType === "express" || serviceType === "send") {
        try {
            const waNumber = orderData.customer?.wa;
            if (waNumber) {
                const waTemplates = require("./templates");
                const shortId = orderId.slice(-5).toUpperCase();
                const customerName = orderData.customer?.name || "Kak";
                const msg = waTemplates[serviceType]?.accepted
                    ? waTemplates[serviceType].accepted(customerName, shortId)
                    : `Halo ${customerName}, pesanan ${serviceType} (#${shortId}) sedang diproses.`;
                await sendWAFonnte(waNumber, msg);
            }
        } catch (e) {
            console.error("Error sending WA to sender:", e);
        }
    }

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

    if (orderData.dispatch?.assignedTo) {
        const targetDriverId = orderData.dispatch.assignedTo;
        console.log(`[TargetedDispatch] Order ${orderId} admin-assigned to driver ${targetDriverId}.`);

        const dispatchCfg = DISPATCH_CONFIG[serviceType] || DISPATCH_CONFIG.transport;
        if (pickupLocation && pickupLocation.lat) {
            const dispatchInit = {
                status: "targeted",
                assignedTo: targetDriverId,
                offeredTo: targetDriverId,
                offerExpiresAt: admin.firestore.Timestamp.fromDate(
                    new Date(Date.now() + dispatchCfg.offerTimeoutMs)
                ),
                serviceType,
                currentRadius: dispatchCfg.initRadiusKm,
                iteration: 1,
                notifiedDrivers: [targetDriverId],
                rejectedDrivers: [],
                lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                startedSearchingAt: admin.firestore.FieldValue.serverTimestamp(),
                nextExpansionAt: new Date(Date.now() + 60000),
                assignedAt: orderData.dispatch.assignedAt || admin.firestore.FieldValue.serverTimestamp(),
            };

            await admin.firestore().collection("orders").doc(orderId).update({
                dispatch: dispatchInit
            });

            try {
                await rtdb.ref(`drivers/${targetDriverId}/incoming`).child(orderId).set(true);
            } catch (rtdbErr) {
                console.warn(`[Targeted] RTDB write failed for driver ${targetDriverId}:`, rtdbErr.message);
            }

            try {
                const driverDoc = await admin.firestore().collection("drivers").doc(targetDriverId).get();
                if (driverDoc.exists) {
                    const driverData = driverDoc.data();
                    if (driverData.fcmToken) {
                        await admin.messaging().send({
                            token: driverData.fcmToken,
                            data: {
                                type: "NEW_ORDER",
                                orderId: String(orderId),
                            },
                            android: {
                                priority: "high",
                            },
                        });
                        console.log(`[TargetedDispatch] FCM sent to driver ${targetDriverId}`);
                    } else {
                        console.warn(`[TargetedDispatch] Driver ${targetDriverId} has no FCM token`);
                    }
                }
            } catch (fcmErr) {
                console.error(`[TargetedDispatch] FCM failed for driver ${targetDriverId}:`, fcmErr.message);
            }
        } else {
            console.warn(`[TargetedDispatch] No pickup location for order ${orderId}, cannot dispatch.`);
        }
        return;
    }

    if (pickupLocation && pickupLocation.lat) {
        const dispatchCfg = DISPATCH_CONFIG[serviceType] || DISPATCH_CONFIG.transport;

        const dispatchInit = {
            status: "searching",
            serviceType,
            currentRadius: dispatchCfg.initRadiusKm,
            iteration: 1,
            notifiedDrivers: [],
            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
            startedSearchingAt: admin.firestore.FieldValue.serverTimestamp(),
            nextExpansionAt: new Date(Date.now() + RADIUS_EXPANSION_INTERVAL_MS),
        };

        await admin.firestore().collection("orders").doc(orderId).update({
            dispatch: dispatchInit
        });

        const driverFound = await dispatchOrder(orderId, orderData, dispatchInit);

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

exports.onOrderUpdate = onDocumentUpdated(
    { document: "orders/{orderId}", region: "asia-southeast1" },
    async (event) => {
    const newValue = event.data.after.data();
    const previousValue = event.data.before.data();
    const serviceType = normalizeServiceType(newValue.serviceType || "transport");

    if (newValue.status && newValue.status !== previousValue.status) {
        const validNext = VALID_TRANSITIONS[serviceType]?.[previousValue.status] || [];
        if (!validNext.includes(newValue.status)) {
            console.warn(`Invalid transition: ${previousValue.status} → ${newValue.status} for ${serviceType} (order ${event.params.orderId})`);
            await event.data.after.ref.update({ status: previousValue.status });
            return null;
        }
    }

    // Type-specific state handling
    if (newValue.status === "WAITING_FOOD" && previousValue.status !== "WAITING_FOOD") {
        console.log(`[Food] Order ${event.params.orderId} — driver waiting for food preparation`);
        if (newValue.merchantId) {
            await sendNotificationToMerchant(newValue.merchantId, {
                title: "Driver Menunggu",
                body: `Driver sudah sampai dan menunggu pesanan #${event.params.orderId.slice(-5).toUpperCase()}.`,
            });
        }
    }

    if (newValue.status === "SHOPPING" && previousValue.status !== "SHOPPING") {
        console.log(`[Shop] Order ${event.params.orderId} — driver shopping`);
    }

    if (newValue.status === "DROPPED_OFF" && previousValue.status !== "DROPPED_OFF") {
        console.log(`[Transport] Order ${event.params.orderId} — passenger dropped off`);
    }

    if (newValue.status === "DELIVERED" && previousValue.status !== "DELIVERED") {
        console.log(`[Delivery] Order ${event.params.orderId} — delivered`);
    }

    const dispatchChangedToRejected = newValue.dispatch?.status === "rejected" && previousValue.dispatch?.status !== "rejected";

    if (newValue.status === previousValue.status && !dispatchChangedToRejected) return null;

    if (dispatchChangedToRejected && newValue.status === "searching") {
        console.log(`[Reject] Order ${event.params.orderId} was rejected by driver. Rotating immediately...`);

        if (newValue.dispatch?.offeredTo) {
            try {
                await rtdb.ref(`drivers/${newValue.dispatch.offeredTo}/incoming`).child(event.params.orderId).remove();
            } catch (_) {}
        }

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

        if (newValue.status === previousValue.status) return null;
    }

    const { status, customerId, driverId } = newValue;
    const orderId = event.params.orderId;

    if (status === "accepted" && previousValue.status !== "accepted") {
        try {
            console.log(`[PickupSurcharge] Order ${orderId} accepted by driver ${driverId}. Calculating surcharge...`);

            const pricingDoc = await admin.firestore().collection("settings").doc("pricing").get();
            const pricing = pricingDoc.exists ? pricingDoc.data() : null;

            if (driverId) {
                const rtdbSnap = await rtdb.ref(`drivers/${driverId}/location`).once('value');
                const driverLoc = rtdbSnap.val();
                const pickupLoc = newValue.pickupLocation || newValue.pickup;

                console.log(`[PickupSurcharge] Driver RTDB location:`, driverLoc, `Pickup location:`, pickupLoc);

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
            }
        } catch (surchargeError) {
            console.error("Error calculating or applying pickup surcharge:", surchargeError);
        }
    }

    if (["accepted", "arriving", "picked_up", "completed"].includes(status)) {
        try {
            const userDoc = customerId ? await admin.firestore().collection("users").doc(customerId).get() : null;
            const userData = (userDoc && userDoc.exists) ? userDoc.data() : null;

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
                const normalizedType = normalizeServiceType(type);
                const serviceKey = waTemplates[normalizedType] ? normalizedType : 'transport';
                const templateFn = waTemplates[serviceKey]?.[status];

                let extraData = null;
                if (status === "completed") {
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
