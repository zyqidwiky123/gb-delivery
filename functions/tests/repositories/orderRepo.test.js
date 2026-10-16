jest.mock('firebase-admin', () => {
  const mockDoc = { get: jest.fn(), update: jest.fn(), set: jest.fn(), delete: jest.fn() };
  const mockCol = {
    doc: jest.fn(() => mockDoc),
    get: jest.fn(),
    add: jest.fn(),
    where: jest.fn(() => mockCol),
    limit: jest.fn(() => mockCol),
    orderBy: jest.fn(() => mockCol),
  };
  const firestoreFn = jest.fn(() => ({ collection: jest.fn(() => mockCol) }));
  firestoreFn.FieldValue = {
    increment: jest.fn((n) => n),
    serverTimestamp: jest.fn(() => new Date()),
    delete: jest.fn(() => '__delete__'),
  };
  return {
    firestore: firestoreFn,
    database: jest.fn(() => ({
      ref: jest.fn(() => ({
        once: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        child: jest.fn(),
      })),
    })),
    messaging: jest.fn(() => ({ send: jest.fn() })),
    initializeApp: jest.fn(),
    credential: { applicationDefault: jest.fn() },
    __mockDoc: mockDoc,
    __mockCol: mockCol,
  };
});

const admin = require('firebase-admin');
const OrderRepository = require('../../src/repositories/orderRepo');

function getCol() {
  return admin.__mockCol;
}
function getDoc() {
  return admin.__mockDoc;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OrderRepository', () => {
  const repo = new OrderRepository();

  test('getById returns data when doc exists', async () => {
    getDoc().get.mockResolvedValue({
      exists: true,
      id: 'order1',
      data: () => ({ status: 'searching', total: 50000 }),
    });
    const result = await repo.getById('order1');
    expect(result).toEqual({ id: 'order1', status: 'searching', total: 50000 });
  });

  test('getById returns null when doc not found', async () => {
    getDoc().get.mockResolvedValue({ exists: false });
    const result = await repo.getById('order1');
    expect(result).toBeNull();
  });

  test('update calls doc.update with data', async () => {
    await repo.update('order1', { status: 'accepted', driverId: 'd1' });
    expect(getDoc().update).toHaveBeenCalledWith({ status: 'accepted', driverId: 'd1' });
  });

  test('set calls doc.set with merge', async () => {
    await repo.set('order1', { driverId: 'd1' });
    expect(getDoc().set).toHaveBeenCalledWith({ driverId: 'd1' }, { merge: true });
  });

  test('create calls collection.add with data', async () => {
    getCol().add.mockResolvedValue({ id: 'newOrder' });
    const result = await repo.create({ serviceType: 'food', customerId: 'c1' });
    expect(getCol().add).toHaveBeenCalledWith({ serviceType: 'food', customerId: 'c1' });
    expect(result).toEqual({ id: 'newOrder' });
  });

  test('queryByField returns array of docs', async () => {
    const fakeDocs = [
      { id: 'o1', data: () => ({ status: 'searching' }) },
      { id: 'o2', data: () => ({ status: 'searching' }) },
    ];
    getCol().get.mockResolvedValue({ docs: fakeDocs, forEach: jest.fn() });
    const results = await repo.queryByField('status', 'searching', 10);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: 'o1', status: 'searching' });
  });
});
