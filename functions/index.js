const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

exports.onOrderUpdate = onDocumentUpdated("orders/{orderId}", async (event) => {
    const newValue = event.data.after.data();
    const previousValue = event.data.before.data();

    // Check if status changed
    if (newValue.status === previousValue.status) return null;

    const { status, customerId, driverId } = newValue;
    const orderId = event.params.orderId;

    // 1. WhatsApp Notifications (Fonnte)
    if (["accepted", "arriving", "completed"].includes(status) && customerId) {
        try {
            const userDoc = await admin.firestore().collection("users").doc(customerId).get();
            const userData = userDoc.exists ? userDoc.data() : null;
            const waNumber = userData?.whatsapp || userData?.wa;

            if (waNumber) {
                const customerName = userData?.displayName || "Pelanggan";
                const type = newValue.serviceType || newValue.type || "Pesanan";
                const shortId = orderId.slice(-5).toUpperCase();
                
                let menuText = "";
                if (type === "food" && Array.isArray(newValue.items)) {
                    menuText = "\n\nDetail Menu:\n" + newValue.items.map(item => `- ${item.name} (${item.qty}x)`).join("\n");
                } else if (type === "shop" && newValue.items) {
                    menuText = `\n\nDetail Barang:\n${newValue.items}`;
                }

                let message = "";
                if (status === "accepted") {
                    message = `Halo Kak ${customerName}! 🔥\n\nGaspol! Pesanan ARO ${type.toUpperCase()} kamu (#${shortId}) udah di-accept driver nih. Stay tuned ya, driver lagi otw jemput! 🚀${menuText}\n\nMakasih udah pake ARO DRIVE!`;
                } else if (status === "arriving") {
                    message = `Kak ${customerName}, driver-nya udah sampe di lokasi nih! 📍\n\nYuk samperin biar pesanan kamu (#${shortId}) langsung sat-set sampe tujuan. Thank you!`;
                } else if (status === "completed") {
                    message = `Mantap Kak ${customerName}! ✅\n\nPesanan kamu (#${shortId}) udah beres ya. Makasih banget udah percayain ARO DRIVE. Jangan lupa jajan lagi besok! ✨`;
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
            data: {
                orderId: uid, // for deep linking if needed
                click_action: "FLUTTER_NOTIFICATION_CLICK", // for mobile if integrated
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
            : "cQTXN4HSRH2mJWY9rjqz"; // Fallback provided by user

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
