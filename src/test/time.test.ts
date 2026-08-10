import { describe, expect, it } from 'vitest';
import {
  getDateRangeFromStrings,
  getStartOfTodayInSiteTimezone,
  getStartOfTomorrowInSiteTimezone,
  getTodayStringInSiteTimezone,
} from '../lib/time';

describe('Site timezone boundaries', () => {
  it('uses Asia/Jakarta calendar boundaries independently of host timezone', () => {
    const beforeMidnightWib = new Date('2026-08-10T16:59:00.000Z');
    expect(getTodayStringInSiteTimezone('Asia/Jakarta', beforeMidnightWib)).toBe('2026-08-10');
    expect(getStartOfTodayInSiteTimezone('Asia/Jakarta', beforeMidnightWib).toISOString()).toBe(
      '2026-08-09T17:00:00.000Z'
    );
    expect(getStartOfTomorrowInSiteTimezone('Asia/Jakarta', beforeMidnightWib).toISOString()).toBe(
      '2026-08-10T17:00:00.000Z'
    );

    const afterMidnightWib = new Date('2026-08-10T17:01:00.000Z');
    expect(getTodayStringInSiteTimezone('Asia/Jakarta', afterMidnightWib)).toBe('2026-08-11');
  });

  it('creates a half-open range for an inclusive site date filter', () => {
    const range = getDateRangeFromStrings('2026-08-10', '2026-08-10', 'Asia/Jakarta');
    expect(range.start?.toISOString()).toBe('2026-08-09T17:00:00.000Z');
    expect(range.endExclusive?.toISOString()).toBe('2026-08-10T17:00:00.000Z');
  });

  it('handles IANA daylight-saving offset changes without assuming a fixed offset', () => {
    const range = getDateRangeFromStrings('2026-03-08', '2026-03-08', 'America/New_York');
    expect(range.start?.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(range.endExclusive?.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });

  it('rejects invalid calendar dates', () => {
    expect(() => getDateRangeFromStrings('2026-02-30', '2026-02-30', 'Asia/Jakarta')).toThrow(
      'Tanggal kalender tidak valid'
    );
  });
});
