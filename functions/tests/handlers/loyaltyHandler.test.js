jest.mock('firebase-admin', () => {
  const mockDoc = { get: jest.fn(), update: jest.fn(), set: jest.fn() };
  const mockCol = { doc: jest.fn(() => mockDoc), get: jest.fn(), add: jest.fn() };
  const firestoreFn = jest.fn(() => ({ collection: jest.fn(() => mockCol) }));
  firestoreFn.FieldValue = {
    increment: jest.fn((n) => n),
    serverTimestamp: jest.fn(() => new Date()),
    delete: jest.fn(() => '__delete__'),
  };
  return {
    firestore: firestoreFn,
    database: jest.fn(() => ({ ref: jest.fn(() => ({ once: jest.fn(), set: jest.fn() })) })),
    messaging: jest.fn(() => ({ send: jest.fn() })),
    initializeApp: jest.fn(),
    credential: { applicationDefault: jest.fn() },
    __mockDoc: mockDoc,
  };
});

const admin = require('firebase-admin');
const loyaltyHandler = require('../../src/handlers/loyaltyHandler');

function makeEvent(overrides = {}) {
  return {
    newValue: { status: 'completed', customerId: 'cust1', total: 100000, ...overrides.newValue },
    previousValue: { status: 'delivered', ...overrides.previousValue },
    orderId: overrides.orderId || 'order123',
  };
}

const getDoc = () => admin.__mockDoc;
const getSettingsDoc = () => {
  const col = admin.firestore().collection('settings');
  return col.doc('platform');
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loyaltyHandler', () => {
  test('returns early when status is not completed', async () => {
    await loyaltyHandler(makeEvent({ newValue: { status: 'accepted' } }));
    expect(getDoc().update).not.toHaveBeenCalled();
  });

  test('returns early when already completed', async () => {
    await loyaltyHandler(makeEvent({ previousValue: { status: 'completed' } }));
    expect(getDoc().update).not.toHaveBeenCalled();
  });

  test('awards points based on order total', async () => {
    getSettingsDoc().get.mockResolvedValue({
      exists: true,
      data: () => ({ pointsPerTenk: 10000 }),
    });
    await loyaltyHandler(makeEvent({ newValue: { total: 50000 } }));
    expect(getDoc().update).toHaveBeenCalledWith({
      loyaltyPoints: 5,
    });
  });

  test('uses default pointsPerTenk when settings doc not found', async () => {
    getSettingsDoc().get.mockResolvedValue({ exists: false });
    await loyaltyHandler(makeEvent({ newValue: { total: 100000 } }));
    expect(getDoc().update).toHaveBeenCalledWith({
      loyaltyPoints: 10,
    });
  });

  test('returns early when no customerId', async () => {
    await loyaltyHandler(makeEvent({ newValue: { customerId: undefined } }));
    expect(getDoc().update).not.toHaveBeenCalled();
  });

  test('returns early when total is zero', async () => {
    await loyaltyHandler(makeEvent({ newValue: { total: 0 } }));
    expect(getDoc().update).not.toHaveBeenCalled();
  });
});
