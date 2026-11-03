import { differenceInCalendarDays, parseISO } from "date-fns";
import { addDaysStr, DATE_RE, monthStart, todayIn } from "./time";

export type RangeKey = "7d" | "30d" | "90d" | "12m" | "custom";
export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "12m", label: "12 months" },
];

export interface DateRange {
  key: RangeKey;
  from: string; // inclusive, business-local
  to: string; // inclusive
  days: number;
  prevFrom: string;
  prevTo: string;
}

export function resolveRange(params: { range?: string; from?: string; to?: string }, tz: string, now = new Date()): DateRange {
  const today = todayIn(tz, now);
  let key = (params.range as RangeKey) || "30d";
  let from: string;
  let to = today;
  if (key === "custom" && params.from && params.to && DATE_RE.test(params.from) && DATE_RE.test(params.to) && params.from <= params.to) {
    from = params.from;
    to = params.to;
    if (differenceInCalendarDays(parseISO(to), parseISO(from)) > 730) from = addDaysStr(to, -730);
  } else if (key === "7d") from = addDaysStr(today, -6);
  else if (key === "90d") from = addDaysStr(today, -89);
  else if (key === "12m") from = monthStart(addDaysStr(today, -335));
  else {
    key = "30d";
    from = addDaysStr(today, -29);
  }
  const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  return { key, from, to, days, prevFrom: addDaysStr(from, -days), prevTo: addDaysStr(from, -1) };
}

export function granularity(days: number): "day" | "week" | "month" {
  return days <= 45 ? "day" : days <= 140 ? "week" : "month";
}
