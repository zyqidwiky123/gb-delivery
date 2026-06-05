// setupTests.js
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia for ResizeObserver
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Firebase modules
vi.mock('../firebase/config', () => {
  return {
    auth: {},
    db: {},
    storage: {},
    messaging: {},
  };
});

// Mock Firebase auth methods that might be used in components
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
  signInWithEmailAndPassword: vi.fn(),
}));

// Mock Firebase firestore
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  updateDoc: vi.fn(),
}));

// Mock Firebase storage
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

// Mock Firebase messaging
vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(),
}));