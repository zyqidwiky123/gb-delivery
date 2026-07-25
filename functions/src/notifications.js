const admin = require("firebase-admin");

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

async function sendWAFonnte(target, message) {
    if (!target) return;

    try {
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

module.exports = { sendNotification, sendWAFonnte, sendNotificationToMerchant };
