/**
 * Utility functions for handling site timezone boundaries (default: Asia/Jakarta).
 * Authoritative operational timestamps (like `received_at`) are stored in UTC in PostgreSQL,
 * but daily operational statistics and date filtering must align with the site timezone.
 */

export function getSiteTimezone(): string {
  return process.env.SITE_TIMEZONE || 'Asia/Jakarta';
}

/**
 * Returns the start of "today" (00:00:00.000) in the specified IANA timezone,
 * converted to a standard JavaScript Date object (UTC representation).
 */
export function getStartOfTodayInSiteTimezone(timezone: string = getSiteTimezone()): Date {
  const now = new Date();
  
  // Format current time in target timezone to get YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const todayStr = formatter.format(now); // e.g. "2026-08-08"
  
  // Create start of day in target timezone
  // For Asia/Jakarta (UTC+7), 2026-08-08 00:00:00 WIB is 2026-08-07 17:00:00 UTC.
  const startOfDayString = `${todayStr}T00:00:00.000`;
  
  // Calculate offset using Intl to construct accurate Date
  const utcDate = new Date(`${startOfDayString}Z`);
  const tzDateString = utcDate.toLocaleString('en-US', { timeZone: timezone });
  const tzDate = new Date(tzDateString);
  const offsetMs = utcDate.getTime() - tzDate.getTime();

  return new Date(utcDate.getTime() + offsetMs);
}

/**
 * Returns today's date string formatted as "YYYY-MM-DD" in site timezone.
 */
export function getTodayStringInSiteTimezone(timezone: string = getSiteTimezone()): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Converts date strings (YYYY-MM-DD) for start and end dates in site timezone
 * into Date objects in UTC suitable for querying PostgreSQL timestamps.
 */
export function getDateRangeFromStrings(
  dateFrom?: string | null,
  dateTo?: string | null,
  timezone: string = getSiteTimezone()
): { start: Date | null; end: Date | null } {
  let start: Date | null = null;
  let end: Date | null = null;

  if (dateFrom) {
    const startStr = `${dateFrom}T00:00:00.000Z`;
    const utcDate = new Date(startStr);
    const tzDateString = utcDate.toLocaleString('en-US', { timeZone: timezone });
    const tzDate = new Date(tzDateString);
    const offsetMs = utcDate.getTime() - tzDate.getTime();
    start = new Date(utcDate.getTime() + offsetMs);
  }

  if (dateTo) {
    const endStr = `${dateTo}T23:59:59.999Z`;
    const utcDate = new Date(endStr);
    const tzDateString = utcDate.toLocaleString('en-US', { timeZone: timezone });
    const tzDate = new Date(tzDateString);
    const offsetMs = utcDate.getTime() - tzDate.getTime();
    end = new Date(utcDate.getTime() + offsetMs);
  }

  return { start, end };
}
