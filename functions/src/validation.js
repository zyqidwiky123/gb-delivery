const VALID_TRANSITIONS = {
    transport: {
        OFFERED: ['ACCEPTED', 'EXPIRED'],
        ACCEPTED: ['ARRIVING', 'CANCELLED'],
        ARRIVING: ['ON_BOARD', 'CANCELLED'],
        ON_BOARD: ['EN_ROUTE'],
        EN_ROUTE: ['DROPPED_OFF', 'CANCELLED'],
        DROPPED_OFF: ['COMPLETED'],
        COMPLETED: [],
        CANCELLED: [],
        EXPIRED: [],
    },
    food: {
        OFFERED: ['ACCEPTED', 'EXPIRED'],
        ACCEPTED: ['ARRIVING', 'CANCELLED'],
        ARRIVING: ['WAITING_FOOD', 'PICKED_UP', 'CANCELLED'],
        WAITING_FOOD: ['PICKED_UP', 'CANCELLED'],
        PICKED_UP: ['EN_ROUTE'],
        EN_ROUTE: ['DELIVERED', 'CANCELLED'],
        DELIVERED: ['COMPLETED'],
        COMPLETED: [],
        CANCELLED: [],
        EXPIRED: [],
    },
    express: {
        OFFERED: ['ACCEPTED', 'EXPIRED'],
        ACCEPTED: ['AT_WAREHOUSE', 'CANCELLED'],
        AT_WAREHOUSE: ['PICKED_UP', 'CANCELLED'],
        PICKED_UP: ['EN_ROUTE'],
        EN_ROUTE: ['DELIVERED', 'CANCELLED'],
        DELIVERED: ['COMPLETED'],
        COMPLETED: [],
        CANCELLED: [],
        EXPIRED: [],
    },
    send: {
        OFFERED: ['ACCEPTED', 'EXPIRED'],
        ACCEPTED: ['AT_PICKUP', 'CANCELLED'],
        AT_PICKUP: ['PICKED_UP', 'CANCELLED'],
        PICKED_UP: ['EN_ROUTE'],
        EN_ROUTE: ['DELIVERED', 'CANCELLED'],
        DELIVERED: ['COMPLETED'],
        COMPLETED: [],
        CANCELLED: [],
        EXPIRED: [],
    },
    shop: {
        OFFERED: ['ACCEPTED', 'EXPIRED'],
        ACCEPTED: ['AT_MERCHANT', 'CANCELLED'],
        AT_MERCHANT: ['SHOPPING', 'CANCELLED'],
        SHOPPING: ['PICKED_UP', 'CANCELLED'],
        PICKED_UP: ['EN_ROUTE'],
        EN_ROUTE: ['DELIVERED', 'CANCELLED'],
        DELIVERED: ['COMPLETED'],
        COMPLETED: [],
        CANCELLED: [],
        EXPIRED: [],
    },
};

function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateFirebaseUid(uid) {
    if (!uid || typeof uid !== 'string') return false;
    return /^[a-zA-Z0-9_-]{20,}$/.test(uid);
}

function validateOrderId(id) {
    if (!id || typeof id !== 'string') return false;
    return id.length >= 5;
}

function sanitizeString(str, maxLen = 500) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().substring(0, maxLen);
}

module.exports = {
    VALID_TRANSITIONS,
    validateEmail,
    validateFirebaseUid,
    validateOrderId,
    sanitizeString,
};
