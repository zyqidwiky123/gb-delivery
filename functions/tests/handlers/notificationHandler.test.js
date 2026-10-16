jest.mock('firebase-admin', () => {
  const mockDoc = { get: jest.fn(), update: jest.fn(), set: jest.fn(), delete: jest.fn() };
  const mockCol = { doc: jest.fn(() => mockDoc), get: jest.fn(), add: jest.fn(), where: jest.fn() };
  const mockChild = { set: jest.fn(), remove: jest.fn() };
  const mockRef = {
    once: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    child: jest.fn(() => mockChild),
  };
  const firestoreFn = jest.fn(() => ({ collection: jest.fn(() => mockCol) }));
  firestoreFn.FieldValue = {
    increment: jest.fn((n) => n),
    serverTimestamp: jest.fn(() => new Date()),
    delete: jest.fn(() => '__delete__'),
  };
  firestoreFn.Timestamp = {
    fromDate: jest.fn((d) => ({ toDate: () => d })),
    now: jest.fn(() => ({ toDate: () => new Date() })),
  };
  return {
    firestore: firestoreFn,
    database: jest.fn(() => ({ ref: jest.fn(() => mockRef) })),
    messaging: jest.fn(() => ({ send: jest.fn() })),
    initializeApp: jest.fn(),
    credential: { applicationDefault: jest.fn() },
    __mockDoc: mockDoc,
    __mockChild: mockChild,
    __mockCol: mockCol,
  };
});

const mockSendNotification = jest.fn();
const mockSendWAFonnte = jest.fn();
const mockSendNotificationToMerchant = jest.fn();
jest.mock('../../src/notifications', () => ({
  sendNotification: (...args) => mockSendNotification(...args),
  sendWAFonnte: (...args) => mockSendWAFonnte(...args),
  sendNotificationToMerchant: (...args) => mockSendNotificationToMerchant(...args),
  __mockSendNotification: mockSendNotification,
  __mockSendWAFonnte: mockSendWAFonnte,
  __mockSendNotificationToMerchant: mockSendNotificationToMerchant,
}));

jest.mock('../../templates', () => ({
  food: {
    accepted: jest.fn(() => 'Terima kasih! Pesanan Anda telah diterima.'),
    completed: jest.fn(
      (name, id, data) => `Halo ${name}, pesanan ARO-${id} selesai. Total: Rp${data.total}`
    ),
  },
  transport: {
    accepted: jest.fn(() => 'Driver sedang menuju ke lokasi Anda.'),
  },
}));

jest.mock('../../src/dispatch', () => {
  const mockDispatchOrder = jest.fn();
  const mockSetNoDriverStatus = jest.fn();
  const mockGetOnlineAvailableDriversCount = jest.fn();
  const mockGetDispatchRegionConfig = jest.fn(() => ({
    maxRadius: 10,
    radiusIncrement: 2,
    maxSearchMinutes: 5,
  }));
  return {
    dispatchOrder: (...args) => mockDispatchOrder(...args),
    setNoDriverStatus: (...args) => mockSetNoDriverStatus(...args),
    getOnlineAvailableDriversCount: (...args) => mockGetOnlineAvailableDriversCount(...args),
    getDispatchRegionConfig: (...args) => mockGetDispatchRegionConfig(...args),
    __mockDispatchOrder: mockDispatchOrder,
    __mockSetNoDriverStatus: mockSetNoDriverStatus,
    __mockGetOnlineAvailableDriversCount: mockGetOnlineAvailableDriversCount,
  };
});

const admin = require('firebase-admin');
const dispatch = require('../../src/dispatch');
const {
  notificationHandler,
  handleDispatchRejection,
} = require('../../src/handlers/notificationHandler');

const getDoc = () => admin.__mockDoc;
const getCol = () => admin.__mockCol;
const getChild = () => admin.__mockChild;

beforeEach(() => {
  jest.clearAllMocks();
});

const baseOrderEvent = (overrides = {}) => ({
  orderId: 'order123',
  newValue: {
    status: 'accepted',
    customerId: 'cust1',
    serviceType: 'food',
    merchantId: 'merchant1',
    customer: { name: 'Budi', wa: '08123456789' },
    items: [{ desc: 'Nasi Goreng', qty: 2 }],
    ...overrides.newValue,
  },
  previousValue: {
    status: 'searching',
    ...overrides.previousValue,
  },
});

describe('handleDispatchRejection', () => {
  const orderId = 'order123';
  const baseNewValue = {
    serviceType: 'food',
    dispatch: {
      offeredTo: 'driver1',
      rejectedDrivers: [],
      status: 'rejected',
      regionType: 'kota',
      currentRadius: 3,
      iteration: 1,
      startedSearchingAt: { toDate: () => new Date(Date.now() - 60000) },
    },
    pickup: { lat: -6.2, lng: 106.8 },
  };
  const basePreviousValue = {
    dispatch: { status: 'offered', offeredTo: 'driver1' },
  };

  function makeEvent(overrides = {}) {
    return {
      newValue: { ...baseNewValue, ...overrides.newValue },
      previousValue: { ...basePreviousValue, ...overrides.previousValue },
      orderId,
    };
  }

  test('removes incoming order from rejected driver RTDB', async () => {
    await handleDispatchRejection(makeEvent(), baseNewValue, basePreviousValue, orderId);
    expect(getChild().remove).toHaveBeenCalled();
  });

  test('adds driver to rejectedDrivers list', async () => {
    await handleDispatchRejection(makeEvent(), baseNewValue, basePreviousValue, orderId);
    expect(getDoc().update).toHaveBeenCalledWith(
      expect.objectContaining({
        'dispatch.rejectedDrivers': ['driver1'],
      })
    );
  });

  test('calls dispatchOrder to find next driver', async () => {
    dispatch.__mockDispatchOrder.mockResolvedValue(true);
    await handleDispatchRejection(makeEvent(), baseNewValue, basePreviousValue, orderId);
    expect(dispatch.__mockDispatchOrder).toHaveBeenCalledWith(
      orderId,
      baseNewValue,
      expect.any(Object)
    );
  });

  test('calls setNoDriverStatus when dispatchOrder fails and max radius reached', async () => {
    dispatch.__mockDispatchOrder.mockResolvedValue(false);
    const exhaustedValue = {
      ...baseNewValue,
      dispatch: {
        ...baseNewValue.dispatch,
        currentRadius: 15,
        startedSearchingAt: { toDate: () => new Date(Date.now() - 60000) },
      },
    };
    await handleDispatchRejection(
      makeEvent({ newValue: exhaustedValue }),
      exhaustedValue,
      basePreviousValue,
      orderId
    );
    expect(dispatch.__mockSetNoDriverStatus).toHaveBeenCalledWith(orderId, exhaustedValue);
  });

  test('does not call setNoDriverStatus when dispatch succeeds', async () => {
    dispatch.__mockDispatchOrder.mockResolvedValue(true);
    await handleDispatchRejection(makeEvent(), baseNewValue, basePreviousValue, orderId);
    expect(dispatch.__mockSetNoDriverStatus).not.toHaveBeenCalled();
  });
});

describe('notificationHandler', () => {
  describe('WAITING_FOOD status — handleTypeSpecificLogging', () => {
    test('sends notification to merchant when status changes to WAITING_FOOD', async () => {
      const event = baseOrderEvent({
        newValue: { status: 'WAITING_FOOD' },
        previousValue: { status: 'accepted' },
      });
      await notificationHandler(event);
      expect(mockSendNotificationToMerchant).toHaveBeenCalledWith(
        'merchant1',
        expect.objectContaining({ title: 'Driver Menunggu' })
      );
    });

    test('does not send merchant notification if no merchantId', async () => {
      const event = baseOrderEvent({
        newValue: { status: 'WAITING_FOOD', merchantId: null },
        previousValue: { status: 'accepted' },
      });
      await notificationHandler(event);
      expect(mockSendNotificationToMerchant).not.toHaveBeenCalled();
    });
  });

  describe('WA notifications — handleWANotifications', () => {
    test('sends WA for accepted status', async () => {
      getDoc().get.mockResolvedValue({
        exists: true,
        data: () => ({ fcmToken: 'fcm1', whatsapp: '08123456789' }),
      });
      const event = baseOrderEvent();
      await notificationHandler(event);
      expect(mockSendWAFonnte).toHaveBeenCalledWith('08123456789', expect.any(String));
    });

    test('does not send WA if status not in notify list', async () => {
      const event = baseOrderEvent({
        newValue: { status: 'searching' },
      });
      await notificationHandler(event);
      expect(mockSendWAFonnte).not.toHaveBeenCalled();
    });

    test('does not send WA if status unchanged', async () => {
      const event = baseOrderEvent({
        newValue: { status: 'accepted' },
        previousValue: { status: 'accepted' },
      });
      await notificationHandler(event);
      expect(mockSendWAFonnte).not.toHaveBeenCalled();
    });

    test('does not send WA if no WA number', async () => {
      getDoc().get.mockResolvedValue({ exists: true, data: () => ({ fcmToken: 'fcm1' }) });
      const event = baseOrderEvent({
        newValue: { customer: { name: 'Budi' } },
      });
      await notificationHandler(event);
      expect(mockSendWAFonnte).not.toHaveBeenCalled();
    });
  });

  describe('FCM notifications — handleFCMNotifications', () => {
    test('sends FCM for accepted status', async () => {
      getDoc().get.mockResolvedValue({
        exists: true,
        data: () => ({ fcmToken: 'fcm1', whatsapp: '08123456789' }),
      });
      const event = baseOrderEvent();
      await notificationHandler(event);
      expect(mockSendNotification).toHaveBeenCalledWith(
        'cust1',
        expect.objectContaining({ title: 'Pesanan Diterima!' })
      );
    });

    test('sends FCM for arriving status', async () => {
      getDoc().get.mockResolvedValue({
        exists: true,
        data: () => ({ fcmToken: 'fcm1', whatsapp: '08123456789' }),
      });
      const event = baseOrderEvent({
        newValue: { status: 'arriving' },
        previousValue: { status: 'accepted' },
      });
      await notificationHandler(event);
      expect(mockSendNotification).toHaveBeenCalledWith(
        'cust1',
        expect.objectContaining({ title: 'Driver Tiba' })
      );
    });

    test('sends FCM for completed status', async () => {
      getDoc().get.mockResolvedValue({
        exists: true,
        data: () => ({ fcmToken: 'fcm1', whatsapp: '08123456789' }),
      });
      const event = baseOrderEvent({
        newValue: { status: 'completed', completedAt: { toDate: () => new Date() } },
        previousValue: { status: 'on_route' },
      });
      await notificationHandler(event);
      expect(mockSendNotification).toHaveBeenCalledWith(
        'cust1',
        expect.objectContaining({ title: 'Pesanan Selesai' })
      );
    });

    test('does not send FCM if no customerId', async () => {
      const event = baseOrderEvent({
        newValue: { customerId: null },
      });
      await notificationHandler(event);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });
});
