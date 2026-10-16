const admin = require('firebase-admin');
const { normalizeServiceType } = require('../utils');
const { VALID_TRANSITIONS } = require('../validation');
const logger = require('../utils/logger');

function analyzeChange(event) {
  const newValue = event.data.after.data();
  const previousValue = event.data.before.data();
  const serviceType = normalizeServiceType(newValue.serviceType || 'transport');

  const statusChanged = newValue.status && newValue.status !== previousValue.status;
  const dispatchChangedToRejected =
    newValue.dispatch?.status === 'rejected' && previousValue.dispatch?.status !== 'rejected';

  let validTransition = true;
  if (statusChanged) {
    const validNext = VALID_TRANSITIONS[serviceType]?.[previousValue.status] || [];
    validTransition = validNext.includes(newValue.status);
  }

  return {
    newValue,
    previousValue,
    serviceType,
    statusChanged,
    dispatchRejected: dispatchChangedToRejected,
    validTransition,
    orderId: event.params.orderId,
  };
}

async function rollback(event, previousValue) {
  logger.warn('Invalid transition detected', {
    from: previousValue.status,
    to: event.data.after.data().status,
    orderId: event.params.orderId,
  });
  await event.data.after.ref.update({ status: previousValue.status });
}

module.exports = { analyzeChange, rollback };
