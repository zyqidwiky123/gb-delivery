import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import { getOpeningStatus } from '../timeUtils';

describe('getOpeningStatus', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T10:00:00'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  test('returns unknown for null input', () => {
    const result = getOpeningStatus(null);
    expect(result.status).toBe('unknown');
  });

  test('returns unknown for empty array', () => {
    const result = getOpeningStatus([]);
    expect(result.status).toBe('unknown');
  });

  test('handles weekdayText object format', () => {
    const result = getOpeningStatus({
      weekdayText: ['Monday: 9:00 AM – 5:00 PM'],
    });
    expect(result.status).toBe('open');
  });

  test('detects closed status', () => {
    const result = getOpeningStatus(['Monday: Closed']);
    expect(result.status).toBe('closed');
  });

  test('detects open 24 hours', () => {
    const result = getOpeningStatus(['Monday: Open 24 hours']);
    expect(result.status).toBe('open');
  });

  test('returns open during business hours', () => {
    const result = getOpeningStatus(['Monday: 8:00 AM – 5:00 PM']);
    expect(result.status).toBe('open');
  });

  test('returns closed outside business hours', () => {
    const result = getOpeningStatus(['Monday: 12:00 PM – 1:00 PM']);
    expect(result.status).toBe('closed');
  });
});
