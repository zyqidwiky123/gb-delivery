const fs = require('fs');
const path = require('path');

const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');
let rules = '';

beforeAll(() => {
  try {
    rules = fs.readFileSync(RULES_PATH, 'utf8');
  } catch {
    console.warn('firestore.rules not found at', RULES_PATH);
  }
});

describe('Firestore rules file', () => {
  test('exists and is readable', () => {
    expect(rules.length).toBeGreaterThan(0);
  });

  test('uses rules_version 2', () => {
    expect(rules).toContain("rules_version = '2'");
  });

  test('has signedIn helper function', () => {
    expect(rules).toContain('function signedIn()');
    expect(rules).toContain('request.auth != null');
  });

  test('has isAdmin helper function', () => {
    expect(rules).toContain('function isAdmin()');
    expect(rules).toContain('.role == "admin"');
  });

  test('has isDriver helper function', () => {
    expect(rules).toContain('function isDriver()');
    expect(rules).toContain('.role == "driver"');
  });

  test('settings/public is publicly readable', () => {
    const publicMatch = rules.match(/match \/settings\/public\/\{doc\}[\s\S]*?allow read: if true/);
    expect(publicMatch).not.toBeNull();
  });

  test('settings/public write requires admin', () => {
    const publicMatch = rules.match(
      /match \/settings\/public\/\{doc\}[\s\S]*?allow write: if isAdmin\(\)/
    );
    expect(publicMatch).not.toBeNull();
  });

  test('settings/configs requires admin for read and write', () => {
    const configsSection = rules.match(/match \/settings\/configs\/\{doc\}[\s\S]*?\}/);
    expect(configsSection).not.toBeNull();
    expect(configsSection[0]).toMatch(/allow read,\s*write: if isAdmin\(\)/);
  });

  test('orders collection has create, read, update, delete rules', () => {
    expect(rules).toMatch(/match \/orders\/\{orderId\}/);

    // Check various operations
    const orderSection = rules.match(/match \/orders\/\{orderId\}[\s\S]*?\}/);
    expect(orderSection).not.toBeNull();
    expect(orderSection[0]).toContain('allow create: if signedIn()');
    expect(orderSection[0]).toContain('allow read: if');
    expect(orderSection[0]).toContain('allow update: if');
    expect(orderSection[0]).toContain('allow delete: if isAdmin()');
  });

  test('merchants collection is publicly readable', () => {
    expect(rules).toMatch(/match \/merchants\/\{merchantId\}[\s\S]*?allow read: if true/);
  });

  test('users collection has self-write and admin-write rules', () => {
    const userMatch = rules.match(/match \/users\/\{userId\}[\s\S]*?\}/);
    expect(userMatch).not.toBeNull();
    expect(userMatch[0]).toContain('request.auth.uid == userId || isAdmin()');
  });

  test('banners collection is publicly readable', () => {
    expect(rules).toMatch(/match \/banners\/\{bannerId\}[\s\S]*?allow read: if true/);
  });

  test('has no world-readable settings/configs', () => {
    // Ensure settings/configs is NOT readable by everyone
    const configsSection = rules.match(/match \/settings\/configs\/\{doc\}[\s\S]*?\}/);
    if (configsSection) {
      expect(configsSection[0]).not.toMatch(/allow read: if true/);
    }
  });
});
