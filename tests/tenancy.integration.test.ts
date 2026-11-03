import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db";
import { appointments, businesses, customers, services, staff, staffHours, staffServices, timeOff } from "@/db/schema";
import { availableSlots, saveAppointment, setStatus } from "@/server/booking";
import { customerDetail, listCustomers, appointmentsInRange } from "@/server/queries";
import * as stats from "@/server/stats";
import { resolveRange } from "@/lib/range";
import { ActionError } from "@/lib/auth";

type Tenant = { biz: typeof businesses.$inferSelect; customer: string; staff: string; service: string };
const created: string[] = [];
const OPEN = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [String(d), [{ open: "00:00", close: "23:59" }]]));
// a far-future Monday-ish date inside any advance window is not needed: dashboard saves ignore notice rules
const DATE = "2031-03-10";

async function tenant(name: string): Promise<Tenant> {
  const [biz] = await db.insert(businesses).values({ name, slug: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timezone: "UTC", openingHours: OPEN, minNoticeHours: 0, maxAdvanceDays: 5000 }).returning();
  created.push(biz!.id);
  const [c] = await db.insert(customers).values({ businessId: biz!.id, name: `${name} customer`, email: `${name}@x.test` }).returning();
  const [s] = await db.insert(staff).values({ businessId: biz!.id, name: `${name} staff` }).returning();
  const [v] = await db.insert(services).values({ businessId: biz!.id, name: `${name} svc`, durationMin: 30, priceCents: 5000 }).returning();
  await db.insert(staffServices).values({ staffId: s!.id, serviceId: v!.id });
  await db.insert(staffHours).values([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ staffId: s!.id, weekday, startTime: "08:00", endTime: "18:00" })));
  return { biz: biz!, customer: c!.id, staff: s!.id, service: v!.id };
}
const input = (t: Tenant, time: string, extra: Record<string, unknown> = {}) => ({
  customerId: t.customer, serviceId: t.service, staffId: t.staff, date: DATE, time, status: "confirmed" as const, notes: "", source: "dashboard" as const, ...extra,
});

let A: Tenant, B: Tenant, bAppt: string;
beforeAll(async () => {
  A = await tenant("alpha"); B = await tenant("bravo");
  bAppt = (await saveAppointment(B.biz, input(B, "09:00", { status: "completed" }), "test")).id;
});
afterAll(async () => {
  await db.delete(businesses).where(inArray(businesses.id, created));
  await pool.end();
});

describe("cross-tenant isolation", () => {
  it("cannot book using another tenant's customer, staff or service", async () => {
    await expect(saveAppointment(A.biz, input(A, "10:00", { customerId: B.customer }), "t")).rejects.toBeInstanceOf(ActionError);
    await expect(saveAppointment(A.biz, input(A, "10:00", { staffId: B.staff }), "t")).rejects.toBeInstanceOf(ActionError);
    await expect(saveAppointment(A.biz, input(A, "10:00", { serviceId: B.service }), "t")).rejects.toBeInstanceOf(ActionError);
  });
  it("cannot update or change status of another tenant's appointment", async () => {
    await expect(saveAppointment(A.biz, input(A, "11:00", { id: bAppt, status: "cancelled" }), "t")).rejects.toBeInstanceOf(ActionError);
    await expect(setStatus(A.biz, bAppt, "cancelled", "t")).rejects.toBeInstanceOf(ActionError);
    const [row] = await db.select().from(appointments).where(eq(appointments.id, bAppt));
    expect(row!.status).toBe("completed");
    expect(row!.businessId).toBe(B.biz.id);
  });
  it("availability never exposes foreign services or staff", async () => {
    expect(await availableSlots(A.biz, { serviceId: B.service, date: DATE })).toEqual([]);
    expect(await availableSlots(A.biz, { serviceId: A.service, staffId: B.staff, date: DATE })).toEqual([]);
    expect((await availableSlots(A.biz, { serviceId: A.service, date: DATE })).length).toBeGreaterThan(0);
  });
  it("reads (lists, profiles, calendar, financial stats) are tenant-scoped", async () => {
    expect(await customerDetail(A.biz.id, B.customer)).toBeNull();
    const list = await listCustomers(A.biz.id, { sort: "name", page: 1, pageSize: 50 });
    expect(list.rows.every((r) => r.id !== B.customer)).toBe(true);
    const day = new Date(`${DATE}T00:00:00Z`);
    expect(await appointmentsInRange(A.biz.id, day, new Date(day.getTime() + 86400_000))).toHaveLength(0);
    expect(await appointmentsInRange(B.biz.id, day, new Date(day.getTime() + 86400_000))).toHaveLength(1);
    const range = { key: "custom" as const, from: DATE, to: DATE, days: 1, prevFrom: "2031-03-09", prevTo: "2031-03-09" };
    expect((await stats.kpis({ id: A.biz.id, timezone: "UTC" }, range)).current.revenue).toBe(0);
    expect((await stats.kpis({ id: B.biz.id, timezone: "UTC" }, range)).current.revenue).toBe(5000);
    expect(await stats.topCustomers({ id: A.biz.id, timezone: "UTC" })).toEqual([]);
  });
});

describe("booking rules & concurrency", () => {
  it("lets exactly one of many concurrent bookings win the same slot", async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => saveAppointment(A.biz, input(A, "14:00"), "t")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toBeInstanceOf(ActionError);
  });
  it("allows editing an appointment without conflicting with itself, and re-booking after cancel", async () => {
    const a = await saveAppointment(A.biz, input(A, "15:00"), "t");
    await saveAppointment(A.biz, input(A, "15:00", { id: a.id, notes: "edited" }), "t");
    await setStatus(A.biz, a.id, "cancelled", "t");
    await saveAppointment(A.biz, input(A, "15:00"), "t");
    await expect(setStatus(A.biz, a.id, "confirmed", "t")).rejects.toBeInstanceOf(ActionError); // slot was retaken
  });
  it("rejects bookings during staff time off and slots hide it", async () => {
    await db.insert(timeOff).values({ staffId: A.staff, startsAt: new Date("2031-03-11T00:00:00Z"), endsAt: new Date("2031-03-12T00:00:00Z"), reason: "x" });
    await expect(saveAppointment(A.biz, input(A, "10:00", { date: "2031-03-11" }), "t")).rejects.toBeInstanceOf(ActionError);
    expect(await availableSlots(A.biz, { serviceId: A.service, date: "2031-03-11" })).toEqual([]);
  });
  it("rejects staff who don't perform the service", async () => {
    const [other] = await db.insert(staff).values({ businessId: A.biz.id, name: "no-skill" }).returning();
    await expect(saveAppointment(A.biz, input(A, "10:00", { staffId: other!.id }), "t")).rejects.toBeInstanceOf(ActionError);
  });
  it("resolveRange never returns inverted or oversized ranges", () => {
    const r = resolveRange({ range: "custom", from: "2000-01-01", to: "2030-01-01" }, "UTC", new Date("2030-06-01"));
    expect(r.days).toBeLessThanOrEqual(731);
  });
});
