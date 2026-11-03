"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, customers } from "@/db/schema";
import { actionCtx } from "@/lib/auth";
import { fail, parse, safely, type ActionResult } from "@/lib/action";
import { parsePriceToCents } from "@/lib/money";
import { appointmentSchema, customerSchema } from "@/lib/validation";
import { logActivity, saveAppointment, setStatus } from "@/server/booking";

const inputSchema = appointmentSchema.extend({
  customerId: z.string().uuid().optional(),
  newCustomer: customerSchema.pick({ name: true, email: true, phone: true }).optional(),
});

export async function saveAppointmentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return safely<{ id: string }>(async () => {
    const ctx = await actionCtx("appointments:manage");
    const p = parse(inputSchema, input);
    if (!p.ok) return p.res;
    const d = p.data;
    let customerId = d.customerId;
    if (!customerId) {
      if (!d.newCustomer) return fail("Choose a customer or add a new one.", { customerId: "Select a customer" });
      const [c] = await db.insert(customers).values({ businessId: ctx.business.id, ...d.newCustomer }).returning();
      customerId = c!.id;
      await logActivity(ctx.business.id, "customer.created", `${c!.name} added as a customer`, ctx.user.name);
    }
    let priceCents: number | undefined;
    if (d.price) {
      const parsed = parsePriceToCents(d.price);
      if (parsed === null) return fail("Enter a valid price.", { price: "Enter a valid price" });
      priceCents = parsed;
    }
    const appt = await saveAppointment(ctx.business, { ...d, customerId, priceCents, source: "dashboard" }, ctx.user.name);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: appt.id } };
  });
}

const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]) });
export async function setStatusAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("appointments:manage");
    const p = parse(statusSchema, input);
    if (!p.ok) return p.res;
    await setStatus(ctx.business, p.data.id, p.data.status, ctx.user.name);
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export async function deleteAppointmentAction(id: string): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("appointments:manage");
    if (ctx.role === "staff") return fail("Only admins can permanently delete appointments. Cancel it instead.");
    const idp = z.string().uuid().safeParse(id);
    if (!idp.success) return fail("Invalid appointment.");
    await db.delete(appointments).where(and(eq(appointments.id, idp.data), eq(appointments.businessId, ctx.business.id)));
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
