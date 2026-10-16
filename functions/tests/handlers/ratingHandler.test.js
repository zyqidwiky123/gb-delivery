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
const ratingHandler = require('../../src/handlers/ratingHandler');

function makeEvent(overrides = {}) {
  return {
    newValue: { driverId: 'driver1', rating: 4.5, ...overrides.newValue },
    previousValue: { status: 'en_route', ...overrides.previousValue },
    orderId: overrides.orderId || 'order123',
  };
}

const getDoc = () => admin.__mockDoc;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ratingHandler', () => {
  test('returns early when no new rating', async () => {
    await ratingHandler(makeEvent({ newValue: { rating: undefined } }));
    expect(getDoc().get).not.toHaveBeenCalled();
  });

  test('returns early when rating already existed', async () => {
    await ratingHandler(makeEvent({ previousValue: { rating: 4.0 } }));
    expect(getDoc().get).not.toHaveBeenCalled();
  });

  test('returns early when no driverId', async () => {
    await ratingHandler(makeEvent({ newValue: { driverId: undefined } }));
    expect(getDoc().get).not.toHaveBeenCalled();
  });

  test('updates driver rating on first review', async () => {
    getDoc().get.mockResolvedValue({
      exists: true,
      data: () => ({ rating: 5.0, totalReviews: 0 }),
    });
    await ratingHandler(makeEvent());
    expect(getDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 4.5, totalReviews: 1 })
    );
  });

  test('calculates average with existing reviews', async () => {
    getDoc().get.mockResolvedValue({
      exists: true,
      data: () => ({ rating: 4.0, totalReviews: 10 }),
    });
    await ratingHandler(makeEvent({ newValue: { rating: 5.0 } }));
    expect(getDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({ rating: expect.closeTo(4.1, 0.1), totalReviews: 11 })
    );
  });

  test('handles non-existent driver doc gracefully', async () => {
    getDoc().get.mockResolvedValue({ exists: false });
    await ratingHandler(makeEvent());
    expect(getDoc().update).not.toHaveBeenCalled();
  });
});
