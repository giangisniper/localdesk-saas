import { toMinutes, weekdayOf, zonedInstant } from "./time";

export type Interval = { start: Date; end: Date };
export type Window = { open: string; close: string };

export interface SlotInput {
  date: string; // business-local yyyy-MM-dd
  timezone: string;
  durationMin: number;
  slotIntervalMin: number;
  bufferMin: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  now: Date;
  openingHours: Record<string, Window[]>; // business hours by weekday ("0".."6")
  staff: {
    id: string;
    hours: { weekday: number; startTime: string; endTime: string }[];
    busy: Interval[]; // existing active appointments + time off
  }[];
}

export interface Slot {
  startsAt: Date;
  staffIds: string[];
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

/** Intersect two lists of minute ranges. */
function intersect(a: [number, number][], b: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [s1, e1] of a)
    for (const [s2, e2] of b) {
      const s = Math.max(s1, s2);
      const e = Math.min(e1, e2);
      if (s < e) out.push([s, e]);
    }
  return out;
}

/**
 * Compute bookable start times for a given day. A slot is offered when at least one
 * staff member is inside working hours (and business opening hours), has no
 * overlapping appointment/time-off (buffer included), and the notice/advance rules hold.
 */
export function computeSlots(input: SlotInput): Slot[] {
  const { date, timezone: tz, durationMin, slotIntervalMin, bufferMin } = input;
  const weekday = weekdayOf(date);
  const earliest = new Date(input.now.getTime() + input.minNoticeHours * 3600_000);
  const latest = new Date(input.now.getTime() + input.maxAdvanceDays * 86400_000);
  const bizWindows = (input.openingHours[String(weekday)] ?? []).map(
    (w) => [toMinutes(w.open), toMinutes(w.close)] as [number, number],
  );
  if (bizWindows.length === 0) return [];

  const slots = new Map<number, string[]>();
  for (const member of input.staff) {
    const own = member.hours
      .filter((h) => h.weekday === weekday)
      .map((h) => [toMinutes(h.startTime), toMinutes(h.endTime)] as [number, number]);
    for (const [ws, we] of intersect(own, bizWindows)) {
      for (let m = ws; m + durationMin <= we; m += slotIntervalMin) {
        const start = zonedInstant(date, `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, tz);
        if (start < earliest || start > latest) continue;
        const end = new Date(start.getTime() + durationMin * 60_000);
        const padded: Interval = {
          start: new Date(start.getTime() - bufferMin * 60_000),
          end: new Date(end.getTime() + bufferMin * 60_000),
        };
        if (member.busy.some((b) => overlaps(padded, b))) continue;
        const key = start.getTime();
        slots.set(key, [...(slots.get(key) ?? []), member.id]);
      }
    }
  }
  return [...slots.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, staffIds]) => ({ startsAt: new Date(t), staffIds }));
}

/** True if the proposed interval collides with any busy interval. */
export function hasConflict(proposed: Interval, busy: Interval[]) {
  return busy.some((b) => overlaps(proposed, b));
}
