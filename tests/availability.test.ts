import { describe, expect, it } from "vitest";
import { computeSlots, hasConflict } from "@/lib/availability";
import { zonedInstant } from "@/lib/time";

const TZ = "Europe/Rome";
const base = {
  date: "2030-06-05", // Wednesday
  timezone: TZ, durationMin: 60, slotIntervalMin: 30, bufferMin: 0, minNoticeHours: 0, maxAdvanceDays: 4000,
  now: new Date("2030-01-01T00:00:00Z"),
  openingHours: { "3": [{ open: "09:00", close: "13:00" }] },
};
const staff = (busy: { start: Date; end: Date }[] = []) => ({ id: "s1", hours: [{ weekday: 3, startTime: "09:00", endTime: "17:00" }], busy });

describe("computeSlots", () => {
  it("offers slots within the intersection of business and staff hours", () => {
    const slots = computeSlots({ ...base, staff: [staff()] });
    expect(slots[0]!.startsAt).toEqual(zonedInstant("2030-06-05", "09:00", TZ));
    expect(slots.at(-1)!.startsAt).toEqual(zonedInstant("2030-06-05", "12:00", TZ)); // last 60-min slot ends 13:00
    expect(slots).toHaveLength(7);
  });
  it("removes slots overlapping existing appointments", () => {
    const busy = [{ start: zonedInstant("2030-06-05", "10:00", TZ), end: zonedInstant("2030-06-05", "11:00", TZ) }];
    const times = computeSlots({ ...base, staff: [staff(busy)] }).map((s) => s.startsAt.toISOString());
    expect(times).not.toContain(zonedInstant("2030-06-05", "09:30", TZ).toISOString());
    expect(times).not.toContain(zonedInstant("2030-06-05", "10:30", TZ).toISOString());
    expect(times).toContain(zonedInstant("2030-06-05", "09:00", TZ).toISOString());
    expect(times).toContain(zonedInstant("2030-06-05", "11:00", TZ).toISOString());
  });
  it("applies buffers around appointments", () => {
    const busy = [{ start: zonedInstant("2030-06-05", "10:00", TZ), end: zonedInstant("2030-06-05", "11:00", TZ) }];
    const times = computeSlots({ ...base, bufferMin: 30, staff: [staff(busy)] }).map((s) => s.startsAt.toISOString());
    expect(times).not.toContain(zonedInstant("2030-06-05", "11:00", TZ).toISOString());
    expect(times).not.toContain(zonedInstant("2030-06-05", "09:00", TZ).toISOString());
  });
  it("honours minimum notice and advance limits", () => {
    const now = zonedInstant("2030-06-05", "09:00", TZ);
    const slots = computeSlots({ ...base, now, minNoticeHours: 2, staff: [staff()] });
    expect(slots[0]!.startsAt >= new Date(now.getTime() + 2 * 3600_000)).toBe(true);
    expect(computeSlots({ ...base, now: new Date("2030-05-01T00:00:00Z"), maxAdvanceDays: 10, staff: [staff()] })).toHaveLength(0);
  });
  it("returns nothing on closed days and merges staff availability", () => {
    expect(computeSlots({ ...base, date: "2030-06-09", staff: [staff()] })).toHaveLength(0);
    const two = computeSlots({ ...base, staff: [staff(), { ...staff(), id: "s2" }] });
    expect(two[0]!.staffIds).toEqual(["s1", "s2"]);
  });
  it("handles DST transitions (Europe/Rome, 2030-03-31)", () => {
    const slots = computeSlots({ ...base, date: "2030-03-31", openingHours: { "0": [{ open: "09:00", close: "11:00" }] }, staff: [{ id: "s", hours: [{ weekday: 0, startTime: "09:00", endTime: "11:00" }], busy: [] }] });
    expect(slots[0]!.startsAt.toISOString()).toBe("2030-03-31T07:00:00.000Z"); // CEST = UTC+2
  });
});

describe("hasConflict", () => {
  const a = { start: new Date("2030-01-01T10:00:00Z"), end: new Date("2030-01-01T11:00:00Z") };
  it("treats touching intervals as non-overlapping", () => {
    expect(hasConflict({ start: a.end, end: new Date("2030-01-01T12:00:00Z") }, [a])).toBe(false);
    expect(hasConflict({ start: new Date("2030-01-01T10:30:00Z"), end: new Date("2030-01-01T11:30:00Z") }, [a])).toBe(true);
  });
});
