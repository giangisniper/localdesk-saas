import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "@/db";
import { appointments, businesses, customers, services, staff } from "@/db/schema";

// Requires a migrated database (npm run db:migrate). Creates and removes its own tenant.
let ids: { business: string; customer: string; staff: string; service: string };

beforeAll(async () => {
  const [b] = await db.insert(businesses).values({ name: "Test Co", slug: `test-${Date.now()}`, timezone: "UTC" }).returning();
  const [c] = await db.insert(customers).values({ businessId: b!.id, name: "Tess Ter" }).returning();
  const [s] = await db.insert(staff).values({ businessId: b!.id, name: "Stan" }).returning();
  const [v] = await db.insert(services).values({ businessId: b!.id, name: "Cut", durationMin: 30, priceCents: 1000 }).returning();
  ids = { business: b!.id, customer: c!.id, staff: s!.id, service: v!.id };
});
afterAll(async () => {
  await db.delete(businesses).where(eq(businesses.id, ids.business));
  await pool.end();
});

const appt = (start: string, end: string, status: "scheduled" | "cancelled" = "scheduled") => ({
  businessId: ids.business, customerId: ids.customer, staffId: ids.staff, serviceId: ids.service,
  startsAt: new Date(start), endsAt: new Date(end), priceCents: 1000, status,
});

describe("double-booking protection (database constraint)", () => {
  it("rejects overlapping active appointments for the same staff member", async () => {
    await db.insert(appointments).values(appt("2031-01-01T10:00:00Z", "2031-01-01T10:30:00Z"));
    await expect(db.insert(appointments).values(appt("2031-01-01T10:15:00Z", "2031-01-01T10:45:00Z"))).rejects.toMatchObject({ cause: { code: "23P01" } });
  });
  it("allows back-to-back appointments and overlaps with cancelled ones", async () => {
    await db.insert(appointments).values(appt("2031-01-01T10:30:00Z", "2031-01-01T11:00:00Z"));
    await db.insert(appointments).values(appt("2031-01-01T10:00:00Z", "2031-01-01T10:30:00Z", "cancelled"));
  });
  it("rejects appointments that end before they start", async () => {
    await expect(db.insert(appointments).values(appt("2031-01-02T10:30:00Z", "2031-01-02T10:00:00Z"))).rejects.toBeTruthy();
  });
});
