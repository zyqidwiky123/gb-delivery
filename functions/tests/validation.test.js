const { validateEmail, validateFirebaseUid, validateOrderId, sanitizeString } = require('../src/validation');

describe('validateEmail', () => {
  test('valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name+tag@domain.co.id')).toBe(true);
    expect(validateEmail('a@b.co')).toBe(true);
  });

  test('invalid emails', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(123)).toBe(false);
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
  });
});

describe('validateFirebaseUid', () => {
  test('valid uids', () => {
    expect(validateFirebaseUid('abc123xyz789def456ghi')).toBe(true);
    expect(validateFirebaseUid('a'.repeat(28))).toBe(true);
  });

  test('invalid uids', () => {
    expect(validateFirebaseUid('')).toBe(false);
    expect(validateFirebaseUid(null)).toBe(false);
    expect(validateFirebaseUid('short')).toBe(false);
    expect(validateFirebaseUid('uid with spaces 12345')).toBe(false);
  });
});

describe('validateOrderId', () => {
  test('valid order IDs', () => {
    expect(validateOrderId('abc123')).toBe(true);
    expect(validateOrderId('a'.repeat(5))).toBe(true);
    expect(validateOrderId('a'.repeat(20))).toBe(true);
  });

  test('invalid order IDs', () => {
    expect(validateOrderId('')).toBe(false);
    expect(validateOrderId(null)).toBe(false);
    expect(validateOrderId('abcd')).toBe(false);
    expect(validateOrderId(12345)).toBe(false);
  });
});

describe('sanitizeString', () => {
  test('removes HTML tags', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitizeString('<b>bold</b>')).toBe('bold');
    expect(sanitizeString('<a href="bad">link</a>')).toBe('link');
  });

  test('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  test('respects max length', () => {
    const long = 'a'.repeat(1000);
    expect(sanitizeString(long, 10)).toBe('a'.repeat(10));
  });

  test('handles null/undefined', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
    expect(sanitizeString('')).toBe('');
  });
});
