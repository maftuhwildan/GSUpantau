/**
 * Site-timezone helpers. Returned Date values represent UTC instants and do
 * not depend on the operating system timezone of the Node.js process.
 */

export function getSiteTimezone(): string {
  return process.env.SITE_TIMEZONE || 'Asia/Jakarta';
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function getPartsInTimezone(date: Date, timezone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function parseDateOnly(value: string): Pick<DateParts, 'year' | 'month' | 'day'> {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) throw new Error(`Tanggal harus menggunakan format YYYY-MM-DD: ${value}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));

  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    throw new Error(`Tanggal kalender tidak valid: ${value}`);
  }
  return { year, month, day };
}

function formatDateOnly(date: Date, timezone: string): string {
  const { year, month, day } = getPartsInTimezone(date, timezone);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addCalendarDays(value: string, days: number): string {
  const { year, month, day } = parseDateOnly(value);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return `${String(result.getUTCFullYear()).padStart(4, '0')}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = getPartsInTimezone(date, timezone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function startOfDateInTimezone(value: string, timezone: string): Date {
  const { year, month, day } = parseDateOnly(value);
  const localAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let candidate = localAsUtc;

  for (let attempt = 0; attempt < 4; attempt++) {
    const nextCandidate = localAsUtc - getTimezoneOffsetMs(new Date(candidate), timezone);
    if (nextCandidate === candidate) break;
    candidate = nextCandidate;
  }

  const result = new Date(candidate);
  const roundTrip = getPartsInTimezone(result, timezone);
  if (
    roundTrip.year !== year ||
    roundTrip.month !== month ||
    roundTrip.day !== day ||
    roundTrip.hour !== 0 ||
    roundTrip.minute !== 0 ||
    roundTrip.second !== 0
  ) {
    throw new Error(`Tidak dapat menentukan awal hari ${value} untuk timezone ${timezone}`);
  }
  return result;
}

export function getTodayStringInSiteTimezone(
  timezone: string = getSiteTimezone(),
  now: Date = new Date()
): string {
  return formatDateOnly(now, timezone);
}

export function getStartOfTodayInSiteTimezone(
  timezone: string = getSiteTimezone(),
  now: Date = new Date()
): Date {
  return startOfDateInTimezone(getTodayStringInSiteTimezone(timezone, now), timezone);
}

export function getStartOfTomorrowInSiteTimezone(
  timezone: string = getSiteTimezone(),
  now: Date = new Date()
): Date {
  const today = getTodayStringInSiteTimezone(timezone, now);
  return startOfDateInTimezone(addCalendarDays(today, 1), timezone);
}

/** Inclusive calendar dates become the half-open range [start, endExclusive). */
export function getDateRangeFromStrings(
  dateFrom?: string | null,
  dateTo?: string | null,
  timezone: string = getSiteTimezone()
): { start: Date | null; endExclusive: Date | null } {
  const start = dateFrom ? startOfDateInTimezone(dateFrom, timezone) : null;
  const endExclusive = dateTo
    ? startOfDateInTimezone(addCalendarDays(dateTo, 1), timezone)
    : null;
  return { start, endExclusive };
}
