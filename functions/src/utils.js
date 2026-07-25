const admin = require("firebase-admin");

const MAX_DRIVER_LOCATION_AGE_MS = 10 * 60 * 1000;
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const MAX_DAILY_ONLINE_MS = 12 * 60 * 60 * 1000;

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function getTimestampMillis(value) {
    if (!value && value !== 0) return null;
    if (typeof value === "number") return value;
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

function normalizeServiceType(raw) {
    const SERVICE_TYPE_ALIAS = {
        transport: ['jek', 'car', 'ride', 'ojek'],
        food: ['makanan'],
        send: ['kirim'],
        shop: ['belanja'],
    };
    if (!raw) return 'transport';
    for (const [canonical, aliases] of Object.entries(SERVICE_TYPE_ALIAS)) {
        if (canonical === raw || aliases.includes(raw)) return canonical;
    }
    return raw;
}

module.exports = {
    MAX_DRIVER_LOCATION_AGE_MS,
    INACTIVITY_TIMEOUT_MS,
    MAX_DAILY_ONLINE_MS,
    calculateDistance,
    deg2rad,
    getTimestampMillis,
    isDriverInactive,
    isDriverOverDailyLimit,
    isDriverLocationFresh,
    parseCoords,
    normalizeServiceType,
};
