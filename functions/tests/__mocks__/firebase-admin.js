const mockFirestore = () => {
  const mockDoc = {
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockCollection = {
    doc: jest.fn(() => mockDoc),
    add: jest.fn(),
    get: jest.fn(),
    where: jest.fn(() => mockCollection),
    orderBy: jest.fn(() => mockCollection),
    limit: jest.fn(() => mockCollection),
    forEach: jest.fn(),
  };

  const mockFieldValue = {
    increment: jest.fn((n) => n),
    serverTimestamp: jest.fn(() => new Date()),
    delete: jest.fn(() => '__delete__'),
  };

  const mockTimestamp = {
    fromDate: jest.fn((d) => ({
      toDate: () => d,
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
    })),
    now: jest.fn(() => ({
      toDate: () => new Date(),
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
    })),
  };

  return {
    collection: jest.fn(() => mockCollection),
    FieldValue: mockFieldValue,
    Timestamp: mockTimestamp,
    doc: mockDoc,
    collectionRef: mockCollection,
    getAll: jest.fn(),
    runTransaction: jest.fn(),
  };
};

const mockDatabase = () => {
  const mockRef = {
    once: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    child: jest.fn(() => mockRef),
    orderByChild: jest.fn(() => mockRef),
    equalTo: jest.fn(() => mockRef),
    limitToLast: jest.fn(() => mockRef),
    forEach: jest.fn(),
    val: jest.fn(),
  };

  return {
    ref: jest.fn(() => mockRef),
    refFromURL: jest.fn(() => mockRef),
  };
};

const mockMessaging = () => ({
  send: jest.fn(),
  sendEach: jest.fn(),
  sendMulticast: jest.fn(),
});

const firestore = mockFirestore();
const database = mockDatabase();
const messaging = mockMessaging();

const mockAdmin = {
  firestore: jest.fn(() => firestore),
  database: jest.fn(() => database),
  messaging: jest.fn(() => messaging),
  credential: {
    applicationDefault: jest.fn(),
    cert: jest.fn(),
  },
  initializeApp: jest.fn(),
  storage: jest.fn(() => ({
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        save: jest.fn(),
        delete: jest.fn(),
        getSignedUrl: jest.fn(),
        getMetadata: jest.fn(),
        exists: jest.fn(),
        download: jest.fn(),
      })),
      getFiles: jest.fn(),
      upload: jest.fn(),
    })),
  })),
};

module.exports = mockAdmin;
module.exports.firestore = firestore;
module.exports.database = database;
module.exports.messaging = messaging;
