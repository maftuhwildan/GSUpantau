export interface DateOnlyRange {
  from?: string
  to?: string
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDateOnly(value?: string): Date | undefined {
  if (!value) return undefined

  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return undefined

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined
  }

  return date
}

export function formatDateOnly(date?: Date): string {
  if (!date || Number.isNaN(date.getTime())) return ""

  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function getTodayDateOnly(
  now: Date = new Date(),
  timeZone = "Asia/Jakarta"
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}`
}

export function appendDateRangeParams(
  params: URLSearchParams,
  range: DateOnlyRange,
  fromKey = "date_from",
  toKey = "date_to"
): URLSearchParams {
  if (range.from) params.set(fromKey, range.from)
  if (range.to) params.set(toKey, range.to)
  return params
}
