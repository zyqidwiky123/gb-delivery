const {
  VALID_TRANSITIONS,
  validateOrderId,
  validateFirebaseUid,
  sanitizeString,
} = require('../validation');
const { normalizeServiceType } = require('../utils');

class OrderValidator {
  validateTransition(serviceType, fromStatus, toStatus) {
    const normalizedType = normalizeServiceType(serviceType);
    const validNext = VALID_TRANSITIONS[normalizedType]?.[fromStatus] || [];
    return validNext.includes(toStatus);
  }

  validTransition(serviceType, fromStatus, toStatus) {
    return this.validateTransition(serviceType, fromStatus, toStatus);
  }

  validateOrderId(orderId) {
    return validateOrderId(orderId);
  }

  validateFirebaseUid(uid) {
    return validateFirebaseUid(uid);
  }

  sanitizeString(str, maxLen) {
    return sanitizeString(str, maxLen);
  }
}

module.exports = OrderValidator;
