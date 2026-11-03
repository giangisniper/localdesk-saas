"use server";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { businesses, customers, services, staff } from "@/db/schema";
import { fail, parse, safely, type ActionResult } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { dateStr, publicBookingSchema } from "@/lib/validation";
import { zonedInstant, fmtDateTime } from "@/lib/time";
import { availableSlots, logActivity, saveAppointment } from "@/server/booking";

async function ip() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
async function bizBySlug(slug: string) {
  const [b] = await db.select().from(businesses).where(and(eq(businesses.slug, slug), eq(businesses.onlineBookingEnabled, true)));
  return b ?? null;
}

const slotsSchema = z.object({ slug: z.string().min(1).max(60), serviceId: z.string().uuid(), staffId: z.string().uuid().or(z.literal("any")), date: dateStr });

export async function getSlotsAction(input: unknown): Promise<ActionResult<{ time: string; iso: string }[]>> {
  return safely<{ time: string; iso: string }[]>(async () => {
    if (!rateLimit(`slots:${await ip()}`, 90, 60_000)) return fail("Too many requests. Please slow down.");
    const p = parse(slotsSchema, input);
    if (!p.ok) return p.res;
    const biz = await bizBySlug(p.data.slug);
    if (!biz) return fail("This business isn't accepting online bookings.");
    const [svc] = await db.select({ b: services.bookableOnline }).from(services).where(and(eq(services.id, p.data.serviceId), eq(services.businessId, biz.id)));
    if (!svc?.b) return fail("Service unavailable.");
    const slots = await availableSlots(biz, { serviceId: p.data.serviceId, staffId: p.data.staffId === "any" ? undefined : p.data.staffId, date: p.data.date });
    return { ok: true, data: slots.map((s) => ({ time: formatInTimeZone(s.startsAt, biz.timezone, "HH:mm"), iso: s.startsAt.toISOString() })) };
  });
}

export interface BookingConfirmation { when: string; service: string; staff: string; business: string; status: string; cancellationHours: number }

export async function createPublicBookingAction(input: unknown): Promise<ActionResult<BookingConfirmation>> {
  return safely<BookingConfirmation>(async () => {
    if (!rateLimit(`book:${await ip()}`, 10, 60 * 60_000)) return fail("Too many bookings from this device. Please try again later.");
    const p = parse(publicBookingSchema, input);
    if (!p.ok) return p.res;
    const d = p.data;
    const biz = await bizBySlug(d.slug);
    if (!biz) return fail("This business isn't accepting online bookings.");
    const [svc] = await db.select().from(services).where(and(eq(services.id, d.serviceId), eq(services.businessId, biz.id), eq(services.active, true), eq(services.bookableOnline, true)));
    if (!svc) return fail("That service is no longer available.");

    // Re-verify the slot against live availability (rules, hours, conflicts)
    const startsAt = zonedInstant(d.date, d.time, biz.timezone);
    const slots = await availableSlots(biz, { serviceId: svc.id, staffId: d.staffId === "any" ? undefined : d.staffId, date: d.date });
    const slot = slots.find((s) => s.startsAt.getTime() === startsAt.getTime());
    if (!slot) return fail("Sorry, that time was just taken. Please pick another slot.");
    const staffId = slot.staffIds[Math.floor(Math.random() * slot.staffIds.length)]!;

    const [existing] = await db.select().from(customers).where(and(eq(customers.businessId, biz.id), sql`lower(${customers.email}) = ${d.email}`));
    let customerId = existing?.id;
    if (!customerId) {
      const [c] = await db.insert(customers).values({ businessId: biz.id, name: d.name, email: d.email, phone: d.phone }).returning({ id: customers.id });
      customerId = c!.id;
    } else if (!existing!.phone && d.phone) await db.update(customers).set({ phone: d.phone }).where(eq(customers.id, customerId));

    const status = biz.autoConfirm ? "confirmed" : "scheduled";
    await saveAppointment(biz, { customerId, serviceId: svc.id, staffId, date: d.date, time: d.time, status, notes: d.notes, source: "online" }, "Online booking");
    const [member] = await db.select({ name: staff.name }).from(staff).where(eq(staff.id, staffId));
    await logActivity(biz.id, "booking.online", `New online booking from ${d.name}`, "Online booking");
    return { ok: true, data: { when: fmtDateTime(startsAt, biz.timezone), service: svc.name, staff: member?.name ?? "", business: biz.name, status, cancellationHours: biz.cancellationHours } };
  });
}
