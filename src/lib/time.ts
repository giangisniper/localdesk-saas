import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

/** All "date strings" are yyyy-MM-dd calendar days in the business timezone. */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIn(tz: string, now = new Date()) {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

/** UTC instant for a wall-clock time ("HH:mm") on a business-local date. */
export function zonedInstant(date: string, time: string, tz: string): Date {
  return fromZonedTime(`${date}T${time.length === 5 ? time + ":00" : time}`, tz);
}

export function dayRange(date: string, tz: string) {
  return { start: zonedInstant(date, "00:00", tz), end: zonedInstant(addDaysStr(date, 1), "00:00", tz) };
}

export function addDaysStr(date: string, n: number) {
  return format(addDays(parseISO(date), n), "yyyy-MM-dd");
}

export function weekdayOf(date: string) {
  return parseISO(date).getDay(); // 0 = Sunday (calendar date, tz independent)
}

/** Monday-based week start. */
export function weekStart(date: string) {
  const wd = weekdayOf(date);
  return addDaysStr(date, -((wd + 6) % 7));
}

export function monthStart(date: string) {
  return date.slice(0, 8) + "01";
}

export function fmtTime(d: Date | string, tz: string) {
  return formatInTimeZone(d, tz, "HH:mm");
}
export function fmtDate(d: Date | string, tz: string, pattern = "EEE d MMM") {
  return formatInTimeZone(d, tz, pattern);
}
export function fmtDateTime(d: Date | string, tz: string) {
  return formatInTimeZone(d, tz, "EEE d MMM, HH:mm");
}
export function localDateOf(d: Date | string, tz: string) {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}
export function localMinutes(d: Date | string, tz: string) {
  const z = toZonedTime(d, tz);
  return z.getHours() * 60 + z.getMinutes();
}

export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + (m ?? 0);
}
export function fromMinutes(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
