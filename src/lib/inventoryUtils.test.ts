import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getExpiryStatus } from './inventoryUtils';

describe('getExpiryStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "good" if no date is provided', () => {
    expect(getExpiryStatus(undefined)).toBe('good');
  });

  it('should return "expired" if the date is in the past', () => {
    expect(getExpiryStatus('2023-12-31T23:59:59Z')).toBe('expired');
  });

  it('should return "expired" if the date is exactly now', () => {
    expect(getExpiryStatus('2024-01-01T12:00:00Z')).toBe('expired');
  });

  it('should return "expiring-soon" if the date is within 7 days', () => {
    expect(getExpiryStatus('2024-01-08T12:00:00Z')).toBe('expiring-soon');
    expect(getExpiryStatus('2024-01-02T12:00:00Z')).toBe('expiring-soon');
  });

  it('should return "good" if the date is more than 7 days in the future', () => {
    expect(getExpiryStatus('2024-01-08T12:00:01Z')).toBe('good');
    expect(getExpiryStatus('2024-01-10T12:00:00Z')).toBe('good');
  });
});
