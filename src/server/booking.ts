import "server-only";
import { and, eq, inArray, gt, lt, ne, notInArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  activity, appointments, businesses, customers, services, staff, staffHours, staffServices, timeOff,
} from "@/db/schema";
import { computeSlots, hasConflict } from "@/lib/availability";
import { ActionError } from "@/lib/auth";
import { isOverlapError } from "@/lib/action";
import { dayRange, fmtDateTime, zonedInstant } from "@/lib/time";

type Business = typeof businesses.$inferSelect;
const INACTIVE = ["cancelled", "no_show"] as const;

export async function logActivity(businessId: string, type: string, message: string, actor: string, tx: Tx | typeof db = db) {
  await tx.insert(activity).values({ businessId, type, message, actor });
}

/** Busy intervals for one staff member (active appointments + time off) overlapping a window. */
async function busyFor(staffIds: string[], from: Date, to: Date, excludeId?: string) {
  if (staffIds.length === 0) return new Map<string, { start: Date; end: Date }[]>();
  const appts = await db
    .select({ staffId: appointments.staffId, start: appointments.startsAt, end: appointments.endsAt })
    .from(appointments)
    .where(and(
      inArray(appointments.staffId, staffIds),
      notInArray(appointments.status, [...INACTIVE]),
      lt(appointments.startsAt, to),
      gt(appointments.endsAt, from),
      excludeId ? ne(appointments.id, excludeId) : undefined,
    ));
  const offs = await db
    .select({ staffId: timeOff.staffId, start: timeOff.startsAt, end: timeOff.endsAt })
    .from(timeOff)
    .where(and(inArray(timeOff.staffId, staffIds), lt(timeOff.startsAt, to), gt(timeOff.endsAt, from)));
  const map = new Map<string, { start: Date; end: Date }[]>();
  for (const r of [...appts, ...offs]) map.set(r.staffId, [...(map.get(r.staffId) ?? []), { start: r.start, end: r.end }]);
  return map;
}

export async function availableSlots(
  business: Business,
  opts: { serviceId: string; staffId?: string; date: string; now?: Date },
) {
  const [service] = await db.select().from(services).where(and(eq(services.id, opts.serviceId), eq(services.businessId, business.id), eq(services.active, true)));
  if (!service) return [];
  const eligible = await db
    .select({ id: staff.id })
    .from(staff)
    .innerJoin(staffServices, eq(staffServices.staffId, staff.id))
    .where(and(eq(staff.businessId, business.id), eq(staff.active, true), eq(staffServices.serviceId, service.id), opts.staffId ? eq(staff.id, opts.staffId) : undefined));
  const ids = eligible.map((e) => e.id);
  if (ids.length === 0) return [];
  const hours = await db.select().from(staffHours).where(inArray(staffHours.staffId, ids));
  const { start, end } = dayRange(opts.date, business.timezone);
  const pad = 24 * 3600_000;
  const busy = await busyFor(ids, new Date(start.getTime() - pad), new Date(end.getTime() + pad));
  return computeSlots({
    date: opts.date,
    timezone: business.timezone,
    durationMin: service.durationMin,
    slotIntervalMin: business.slotIntervalMin,
    bufferMin: business.bufferMin,
    minNoticeHours: business.minNoticeHours,
    maxAdvanceDays: business.maxAdvanceDays,
    now: opts.now ?? new Date(),
    openingHours: business.openingHours,
    staff: ids.map((id) => ({ id, hours: hours.filter((h) => h.staffId === id), busy: busy.get(id) ?? [] })),
  });
}

export interface BookInput {
  id?: string;
  customerId: string;
  serviceId: string;
  staffId: string;
  date: string;
  time: string;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
  notes: string;
  priceCents?: number;
  source: "dashboard" | "online";
}

/** Create or update an appointment, enforcing tenancy, staff/service match and no overlaps. */
export async function saveAppointment(business: Business, input: BookInput, actor: string) {
  const [service] = await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.businessId, business.id)));
  const [member] = await db.select().from(staff).where(and(eq(staff.id, input.staffId), eq(staff.businessId, business.id)));
  const [customer] = await db.select().from(customers).where(and(eq(customers.id, input.customerId), eq(customers.businessId, business.id)));
  if (!service || !member || !customer) throw new ActionError("Customer, service or staff member not found.");
  if (!input.id && (!service.active || !member.active)) throw new ActionError("That service or staff member is archived and can't take new bookings.");
  const [link] = await db.select().from(staffServices).where(and(eq(staffServices.staffId, member.id), eq(staffServices.serviceId, service.id)));
  if (!link) throw new ActionError(`${member.name} doesn't perform ${service.name}.`);

  const startsAt = zonedInstant(input.date, input.time, business.timezone);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
  const isActive = !INACTIVE.includes(input.status as never);
  if (isActive) {
    const busy = (await busyFor([member.id], new Date(startsAt.getTime() - 86400_000), new Date(endsAt.getTime() + 86400_000), input.id)).get(member.id) ?? [];
    if (hasConflict({ start: startsAt, end: endsAt }, busy))
      throw new ActionError(`${member.name} is not available at that time (already booked or on time off).`);
  }
  const priceCents = input.priceCents ?? service.priceCents;
  const values = {
    businessId: business.id, customerId: customer.id, staffId: member.id, serviceId: service.id,
    startsAt, endsAt, status: input.status, priceCents, notes: input.notes, source: input.source,
    cancelledAt: input.status === "cancelled" ? new Date() : null,
  };
  try {
    if (input.id) {
      const [updated] = await db.update(appointments).set(values).where(and(eq(appointments.id, input.id), eq(appointments.businessId, business.id))).returning();
      if (!updated) throw new ActionError("Appointment not found.");
      await logActivity(business.id, "appointment.updated", `${customer.name} · ${service.name} updated (${fmtDateTime(startsAt, business.timezone)})`, actor);
      return updated;
    }
    const [created] = await db.insert(appointments).values(values).returning();
    await logActivity(
      business.id,
      input.source === "online" ? "appointment.online" : "appointment.created",
      `${customer.name} booked ${service.name} with ${member.name} (${fmtDateTime(startsAt, business.timezone)})`,
      actor,
    );
    return created!;
  } catch (e) {
    if (isOverlapError(e)) throw new ActionError(`${member.name} was just booked for that time. Pick another slot.`);
    throw e;
  }
}

export async function setStatus(business: Business, id: string, status: BookInput["status"], actor: string) {
  const [appt] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.businessId, business.id)));
  if (!appt) throw new ActionError("Appointment not found.");
  const reactivating = INACTIVE.includes(appt.status as never) && !INACTIVE.includes(status as never);
  try {
    await db.update(appointments).set({ status, cancelledAt: status === "cancelled" ? new Date() : null }).where(eq(appointments.id, id));
  } catch (e) {
    if (reactivating && isOverlapError(e)) throw new ActionError("That time slot has since been taken, so the appointment can't be restored.");
    throw e;
  }
  const [c] = await db.select({ name: customers.name }).from(customers).where(eq(customers.id, appt.customerId));
  await logActivity(business.id, `appointment.${status}`, `${c?.name ?? "Appointment"} marked ${status.replace("_", " ")}`, actor);
}


/**
 * Customers are unique per business by email (case-insensitive) when an email is given.
 * Scoped to one tenant: the same address may exist in other businesses. Enforced in the application
 * (not a DB constraint) because pre-existing data may legitimately contain duplicates.
 */
export async function findCustomerByEmail(businessId: string, email: string, excludeId?: string) {
  if (!email) return null;
  const [row] = await db.select({ id: customers.id, name: customers.name }).from(customers)
    .where(and(eq(customers.businessId, businessId), sql`lower(${customers.email}) = ${email.toLowerCase()}`, excludeId ? ne(customers.id, excludeId) : undefined)).limit(1);
  return row ?? null;
}
