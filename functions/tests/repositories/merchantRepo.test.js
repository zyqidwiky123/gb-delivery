jest.mock('firebase-admin', () => {
  const mockDoc = { get: jest.fn(), update: jest.fn(), set: jest.fn() };
  const mockCol = {
    doc: jest.fn(() => mockDoc),
    get: jest.fn(),
    add: jest.fn(),
    where: jest.fn(() => mockCol),
    limit: jest.fn(() => mockCol),
  };
  const firestoreFn = jest.fn(() => ({ collection: jest.fn(() => mockCol) }));
  firestoreFn.FieldValue = { increment: jest.fn((n) => n) };
  return {
    firestore: firestoreFn,
    database: jest.fn(),
    messaging: jest.fn(),
    initializeApp: jest.fn(),
    credential: { applicationDefault: jest.fn() },
    __mockDoc: mockDoc,
    __mockCol: mockCol,
  };
});

const admin = require('firebase-admin');
const MerchantRepository = require('../../src/repositories/merchantRepo');

function getCol() {
  return admin.__mockCol;
}
function getDoc() {
  return admin.__mockDoc;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MerchantRepository', () => {
  const repo = new MerchantRepository();

  test('getById returns merchant data when exists', async () => {
    getDoc().get.mockResolvedValue({
      exists: true,
      id: 'm1',
      data: () => ({ name: 'Warung Sate', phone: '628123456789' }),
    });
    const result = await repo.getById('m1');
    expect(result).toEqual({ id: 'm1', name: 'Warung Sate', phone: '628123456789' });
  });

  test('getById returns null when not found', async () => {
    getDoc().get.mockResolvedValue({ exists: false });
    const result = await repo.getById('m1');
    expect(result).toBeNull();
  });

  test('update calls doc.update', async () => {
    await repo.update('m1', { name: 'Warung Baru' });
    expect(getDoc().update).toHaveBeenCalledWith({ name: 'Warung Baru' });
  });

  test('getAll returns all merchants', async () => {
    const fakeDocs = [
      { id: 'm1', data: () => ({ name: 'M1' }) },
      { id: 'm2', data: () => ({ name: 'M2' }) },
    ];
    getCol().get.mockResolvedValue({ docs: fakeDocs, forEach: jest.fn() });
    const results = await repo.getAll();
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('M1');
  });
});
