const { analyzeChange, rollback } = require('../../src/handlers/stateMachineHandler');

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  database: jest.fn(),
  messaging: jest.fn(),
  initializeApp: jest.fn(),
  credential: { applicationDefault: jest.fn() },
}));

function makeEvent({
  beforeStatus,
  afterStatus,
  beforeDispatch,
  afterDispatch,
  serviceType,
  orderId,
}) {
  return {
    data: {
      before: { data: () => ({ status: beforeStatus, dispatch: beforeDispatch, serviceType }) },
      after: {
        data: () => ({ status: afterStatus, dispatch: afterDispatch, serviceType }),
        ref: { update: jest.fn() },
      },
    },
    params: { orderId: orderId || 'order123' },
  };
}

describe('analyzeChange', () => {
  test('detects valid status transition', () => {
    const event = makeEvent({
      beforeStatus: 'OFFERED',
      afterStatus: 'ACCEPTED',
      serviceType: 'transport',
    });
    const result = analyzeChange(event);
    expect(result.validTransition).toBe(true);
    expect(result.statusChanged).toBe(true);
  });

  test('detects invalid status transition', () => {
    const event = makeEvent({
      beforeStatus: 'OFFERED',
      afterStatus: 'COMPLETED',
      serviceType: 'transport',
    });
    const result = analyzeChange(event);
    expect(result.validTransition).toBe(false);
    expect(result.statusChanged).toBe(true);
  });

  test('detects no status change', () => {
    const event = makeEvent({
      beforeStatus: 'ACCEPTED',
      afterStatus: 'ACCEPTED',
      serviceType: 'transport',
    });
    const result = analyzeChange(event);
    expect(result.statusChanged).toBe(false);
  });

  test('detects dispatch rejection', () => {
    const event = makeEvent({
      beforeStatus: 'searching',
      afterStatus: 'searching',
      beforeDispatch: { status: 'offered' },
      afterDispatch: { status: 'rejected' },
      serviceType: 'food',
    });
    const result = analyzeChange(event);
    expect(result.dispatchRejected).toBe(true);
  });

  test('detects no dispatch rejection when unchanged', () => {
    const event = makeEvent({
      beforeStatus: 'searching',
      afterStatus: 'searching',
      beforeDispatch: { status: 'offered' },
      afterDispatch: { status: 'offered' },
      serviceType: 'food',
    });
    const result = analyzeChange(event);
    expect(result.dispatchRejected).toBe(false);
  });

  test('normalizes service type', () => {
    const event = makeEvent({
      beforeStatus: 'OFFERED',
      afterStatus: 'ACCEPTED',
      serviceType: 'jek',
    });
    const result = analyzeChange(event);
    expect(result.serviceType).toBe('transport');
  });

  test('returns orderId from params', () => {
    const event = makeEvent({
      beforeStatus: 'OFFERED',
      afterStatus: 'ACCEPTED',
      serviceType: 'transport',
      orderId: 'my-order',
    });
    const result = analyzeChange(event);
    expect(result.orderId).toBe('my-order');
  });

  test('defaults service type to transport when missing', () => {
    const event = makeEvent({
      beforeStatus: 'OFFERED',
      afterStatus: 'ACCEPTED',
      serviceType: undefined,
    });
    const result = analyzeChange(event);
    expect(result.serviceType).toBe('transport');
  });
});

describe('rollback', () => {
  test('reverts order to previous status', async () => {
    const mockUpdate = jest.fn();
    const event = {
      data: {
        after: { data: () => ({ status: 'COMPLETED' }), ref: { update: mockUpdate } },
        before: { data: () => ({ status: 'OFFERED' }) },
      },
      params: { orderId: 'order123' },
    };
    await rollback(event, { status: 'OFFERED' });
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'OFFERED' });
  });
});
