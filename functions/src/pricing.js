const admin = require("firebase-admin");
const { calculateDistance, parseCoords } = require("./utils");

async function getPricing(serviceType) {
    try {
        const doc = await admin.firestore().collection("settings").doc("pricing").get();
        if (doc.exists) {
            const data = doc.data();
            return data[serviceType] || data.transport || data.jek || { commissionRate: 0.1 };
        }
    } catch (e) {
        console.error("Error reading pricing:", e);
    }
    return { commissionRate: 0.1 };
}

function calculatePickupFee(driverLoc, pickupLoc, pricing) {
    const dLoc = parseCoords(driverLoc);
    const pLoc = parseCoords(pickupLoc);
    if (!dLoc || !pLoc) return { fee: 0, distance: 0 };

    const distance = calculateDistance(dLoc.lat, dLoc.lng, pLoc.lat, pLoc.lng);

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

module.exports = { getPricing, calculatePickupFee };
