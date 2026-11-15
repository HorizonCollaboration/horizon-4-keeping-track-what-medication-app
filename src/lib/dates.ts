/*
 * Dates and times as people read them. The medicine list is Canadian, so days
 * start and end on Eastern time, whatever clock the server keeps.
 */
export const timeZone = "America/Toronto";

const day = 24 * 60 * 60 * 1000;

const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The calendar day something happened on, as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  return keyFormat.format(date);
}

/** How many calendar days before today this was: 0 today, 1 yesterday. */
export function daysAgo(date: Date, now: Date): number {
  return Math.round((Date.parse(dayKey(now)) - Date.parse(dayKey(date))) / day);
}

/** "Today", "Yesterday", or a date such as "Mon 10 Nov". */
export function dayLabel(date: Date, now: Date): string {
  const ago = daysAgo(date, now);

  if (ago === 0) {
    return "Today";
  }

  if (ago === 1) {
    return "Yesterday";
  }

  return shortDate.format(date);
}

/** "Today", "Yesterday", "3 days ago", or a date for anything older than a week. */
export function whenText(date: Date, now: Date): string {
  const ago = daysAgo(date, now);

  return ago > 1 && ago < 7 ? `${ago} days ago` : dayLabel(date, now);
}

/** A 24-hour time such as "14:05". */
export function timeText(date: Date): string {
  return time.format(date);
}

const fullDate = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** A YYYY-MM-DD date, such as an expected return date, as "10 Nov 2026". */
export function calendarDate(value: string): string {
  return fullDate.format(new Date(`${value}T12:00:00Z`));
}

/** The date this many days from today, as YYYY-MM-DD. */
export function dateFromToday(days: number, now: Date): string {
  return dayKey(new Date(now.getTime() + days * day));
}

/** The same moment this many days ago. */
export function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * day);
}

/** A moment in each of the last few calendar days, today first, whatever the clocks did in between. */
export function lastDays(now: Date, count: number): Date[] {
  // Midday UTC is morning in Toronto: the same calendar day, well away from midnight.
  const today = Date.parse(`${dayKey(now)}T12:00:00Z`);

  return Array.from({ length: count }, (_, ago) => new Date(today - ago * day));
}
