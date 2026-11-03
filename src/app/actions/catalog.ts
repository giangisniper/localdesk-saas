"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, count } from "drizzle-orm";
import { db } from "@/db";
import { appointments, services, staff, staffHours, staffServices, timeOff } from "@/db/schema";
import { actionCtx } from "@/lib/auth";
import { fail, parse, safely, type ActionResult } from "@/lib/action";
import { parsePriceToCents } from "@/lib/money";
import { serviceSchema, staffSchema, timeOffSchema } from "@/lib/validation";
import { zonedInstant, addDaysStr } from "@/lib/time";
import { logActivity } from "@/server/booking";

const uuid = z.string().uuid();

export async function saveServiceAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("services:manage");
    const p = parse(serviceSchema, input);
    if (!p.ok) return p.res;
    const { id, price, staffIds, ...v } = p.data;
    const priceCents = parsePriceToCents(price);
    if (priceCents === null) return fail("Enter a valid price.", { price: "Enter a valid price" });
    const valid = staffIds.length
      ? (await db.select({ id: staff.id }).from(staff).where(and(eq(staff.businessId, ctx.business.id), inArray(staff.id, staffIds)))).map((s) => s.id)
      : [];
    await db.transaction(async (tx) => {
      let serviceId = id;
      if (id) {
        const [u] = await tx.update(services).set({ ...v, priceCents }).where(and(eq(services.id, id), eq(services.businessId, ctx.business.id))).returning({ id: services.id });
        if (!u) throw new Error("not found");
        await tx.delete(staffServices).where(eq(staffServices.serviceId, id));
      } else {
        const [c] = await tx.insert(services).values({ ...v, priceCents, businessId: ctx.business.id }).returning({ id: services.id });
        serviceId = c!.id;
      }
      if (valid.length) await tx.insert(staffServices).values(valid.map((staffId) => ({ staffId, serviceId: serviceId! })));
    });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function deleteServiceAction(id: string): Promise<ActionResult<{ archived: boolean }>> {
  return safely<{ archived: boolean }>(async () => {
    const ctx = await actionCtx("services:manage");
    const idp = uuid.safeParse(id);
    if (!idp.success) return fail("Invalid service.");
    const [used] = await db.select({ n: count() }).from(appointments).where(and(eq(appointments.serviceId, idp.data), eq(appointments.businessId, ctx.business.id)));
    if ((used?.n ?? 0) > 0) {
      await db.update(services).set({ active: false }).where(and(eq(services.id, idp.data), eq(services.businessId, ctx.business.id)));
      revalidatePath("/", "layout");
      return { ok: true, data: { archived: true } };
    }
    await db.delete(services).where(and(eq(services.id, idp.data), eq(services.businessId, ctx.business.id)));
    revalidatePath("/", "layout");
    return { ok: true, data: { archived: false } };
  });
}

export async function saveStaffAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("staff:manage");
    const p = parse(staffSchema, input);
    if (!p.ok) return p.res;
    const { id, hours, serviceIds, ...v } = p.data;
    // overlapping shifts on one weekday would be confusing — reject
    for (let wd = 0; wd < 7; wd++) {
      const day = hours.filter((h) => h.weekday === wd).sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 1; i < day.length; i++) if (day[i]!.startTime < day[i - 1]!.endTime) return fail("Shifts on the same day can't overlap.");
    }
    const validServices = serviceIds.length
      ? (await db.select({ id: services.id }).from(services).where(and(eq(services.businessId, ctx.business.id), inArray(services.id, serviceIds)))).map((s) => s.id)
      : [];
    await db.transaction(async (tx) => {
      let staffId = id;
      if (id) {
        const [u] = await tx.update(staff).set(v).where(and(eq(staff.id, id), eq(staff.businessId, ctx.business.id))).returning({ id: staff.id });
        if (!u) throw new Error("not found");
        await tx.delete(staffHours).where(eq(staffHours.staffId, id));
        await tx.delete(staffServices).where(eq(staffServices.staffId, id));
      } else {
        const [c] = await tx.insert(staff).values({ ...v, businessId: ctx.business.id }).returning({ id: staff.id });
        staffId = c!.id;
      }
      if (hours.length) await tx.insert(staffHours).values(hours.map((h) => ({ ...h, staffId: staffId! })));
      if (validServices.length) await tx.insert(staffServices).values(validServices.map((serviceId) => ({ staffId: staffId!, serviceId })));
      if (!id) await logActivity(ctx.business.id, "staff.created", `${v.name} joined the team`, ctx.user.name, tx);
    });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function deleteStaffAction(id: string): Promise<ActionResult<{ archived: boolean }>> {
  return safely<{ archived: boolean }>(async () => {
    const ctx = await actionCtx("staff:manage");
    const idp = uuid.safeParse(id);
    if (!idp.success) return fail("Invalid staff member.");
    const [used] = await db.select({ n: count() }).from(appointments).where(and(eq(appointments.staffId, idp.data), eq(appointments.businessId, ctx.business.id)));
    if ((used?.n ?? 0) > 0) {
      await db.update(staff).set({ active: false }).where(and(eq(staff.id, idp.data), eq(staff.businessId, ctx.business.id)));
      revalidatePath("/", "layout");
      return { ok: true, data: { archived: true } };
    }
    await db.delete(staff).where(and(eq(staff.id, idp.data), eq(staff.businessId, ctx.business.id)));
    revalidatePath("/", "layout");
    return { ok: true, data: { archived: false } };
  });
}

export async function addTimeOffAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("staff:manage");
    const p = parse(timeOffSchema, input);
    if (!p.ok) return p.res;
    const [m] = await db.select({ id: staff.id }).from(staff).where(and(eq(staff.id, p.data.staffId), eq(staff.businessId, ctx.business.id)));
    if (!m) return fail("Staff member not found.");
    await db.insert(timeOff).values({
      staffId: m.id, reason: p.data.reason,
      startsAt: zonedInstant(p.data.startDate, "00:00", ctx.business.timezone),
      endsAt: zonedInstant(addDaysStr(p.data.endDate, 1), "00:00", ctx.business.timezone),
    });
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function removeTimeOffAction(id: string): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("staff:manage");
    const idp = uuid.safeParse(id);
    if (!idp.success) return fail("Invalid entry.");
    const mine = await db.select({ id: staff.id }).from(staff).where(eq(staff.businessId, ctx.business.id));
    await db.delete(timeOff).where(and(eq(timeOff.id, idp.data), inArray(timeOff.staffId, mine.map((m) => m.id))));
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
