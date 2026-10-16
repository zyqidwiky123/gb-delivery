jest.mock('firebase-admin', () => {
  const mockDoc = { get: jest.fn(), update: jest.fn(), set: jest.fn() };
  const mockCol = {
    doc: jest.fn(() => mockDoc),
    get: jest.fn(),
    add: jest.fn(),
    where: jest.fn(() => mockCol),
    limit: jest.fn(() => mockCol),
  };
  const mockRef = {
    once: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    child: jest.fn(() => mockRef),
  };
  const firestoreFn = jest.fn(() => ({ collection: jest.fn(() => mockCol) }));
  firestoreFn.FieldValue = {
    increment: jest.fn((n) => n),
    serverTimestamp: jest.fn(() => new Date()),
    delete: jest.fn(() => '__delete__'),
  };
  return {
    firestore: firestoreFn,
    database: jest.fn(() => ({ ref: jest.fn(() => mockRef) })),
    messaging: jest.fn(() => ({ send: jest.fn() })),
    initializeApp: jest.fn(),
    credential: { applicationDefault: jest.fn() },
    __mockDoc: mockDoc,
    __mockCol: mockCol,
  };
});

const admin = require('firebase-admin');
const DriverRepository = require('../../src/repositories/driverRepo');

function getCol() {
  return admin.__mockCol;
}
function getDoc() {
  return admin.__mockDoc;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DriverRepository', () => {
  const repo = new DriverRepository();

  describe('getById', () => {
    test('returns driver data when exists', async () => {
      getDoc().get.mockResolvedValue({
        exists: true,
        id: 'd1',
        data: () => ({ name: 'Driver 1', rating: 4.5 }),
      });
      const result = await repo.getById('d1');
      expect(result).toEqual({ id: 'd1', name: 'Driver 1', rating: 4.5 });
    });

    test('returns null when not found', async () => {
      getDoc().get.mockResolvedValue({ exists: false });
      const result = await repo.getById('d1');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    test('updates driver firestore doc', async () => {
      await repo.update('d1', { rating: 5.0 });
      expect(getDoc().update).toHaveBeenCalledWith({ rating: 5.0 });
    });
  });

  describe('adjustBalance', () => {
    test('increments balance by amount', async () => {
      await repo.adjustBalance('d1', 10000);
      expect(getDoc().update).toHaveBeenCalledWith({ balance: 10000 });
    });
  });

  describe('getOnlineDrivers', () => {
    function setupMocks({ rtdbData, fsData }) {
      const mockRef = admin.database().ref('drivers');
      const rtdbForEach = jest.fn((cb) => {
        if (rtdbData) Object.entries(rtdbData).forEach(([k, v]) => cb({ key: k, val: () => v }));
      });
      mockRef.once.mockResolvedValue({ forEach: rtdbForEach, val: () => rtdbData });

      const fsForEach = jest.fn((cb) => {
        if (fsData) Object.entries(fsData).forEach(([k, v]) => cb({ id: k, data: () => v }));
      });
      getCol().get.mockResolvedValue({ forEach: fsForEach, docs: [], empty: !fsData });
    }

    test('merges RTDB and Firestore data for online drivers', async () => {
      setupMocks({
        rtdbData: {
          d1: {
            isOnline: true,
            status: 'online',
            location: { lat: -6.2, lng: 106.8 },
            lastActive: Date.now(),
            todayOnlineMs: 100000,
          },
          d2: {
            isOnline: true,
            status: 'online',
            location: { lat: -6.3, lng: 106.9 },
            lastActive: Date.now(),
            todayOnlineMs: 50000,
          },
          d3: { isOnline: false, status: 'offline' },
        },
        fsData: {
          d1: { name: 'Driver 1', rating: 4.5, balance: 50000 },
          d2: { name: 'Driver 2', rating: 4.0, balance: 30000 },
          d3: { name: 'Driver 3', rating: 5.0, balance: 100000 },
        },
      });

      const drivers = await repo.getOnlineDrivers();
      expect(drivers).toHaveLength(2);
      expect(drivers[0].id).toBe('d1');
      expect(drivers[0].name).toBe('Driver 1');
      expect(drivers[0].isOnline).toBe(true);
      expect(drivers[1].id).toBe('d2');
    });

    test('returns empty array when no online drivers', async () => {
      setupMocks({
        rtdbData: {},
        fsData: { d1: { name: 'Driver 1' } },
      });
      const drivers = await repo.getOnlineDrivers();
      expect(drivers).toHaveLength(0);
    });
  });

  describe('setStatus', () => {
    test('sets driver status in RTDB', async () => {
      await repo.setStatus('d1', 'busy');
      expect(admin.database().ref().set).toHaveBeenCalledWith('busy');
    });
  });

  describe('setIncomingOrder', () => {
    test('sets incoming order in RTDB', async () => {
      await repo.setIncomingOrder('d1', 'order123');
      const calls = admin.database().ref().child.mock.calls;
      expect(calls[0][0]).toBe('d1/incoming');
      expect(calls[1][0]).toBe('order123');
    });
  });

  describe('removeIncomingOrder', () => {
    test('removes incoming order from RTDB', async () => {
      await repo.removeIncomingOrder('d1', 'order123');
      const calls = admin.database().ref().child.mock.calls;
      expect(calls[0][0]).toBe('d1/incoming');
      expect(calls[1][0]).toBe('order123');
    });
  });
});
