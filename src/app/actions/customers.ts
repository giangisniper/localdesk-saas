"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customerNotes, customers } from "@/db/schema";
import { actionCtx } from "@/lib/auth";
import { fail, parse, safely, type ActionResult } from "@/lib/action";
import { customerSchema } from "@/lib/validation";
import { findCustomerByEmail, logActivity } from "@/server/booking";

export async function saveCustomerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return safely<{ id: string }>(async () => {
    const ctx = await actionCtx("customers:manage");
    const p = parse(customerSchema, input);
    if (!p.ok) return p.res;
    const { id, ...v } = p.data;
    const dup = await findCustomerByEmail(ctx.business.id, v.email, id);
    if (dup) return fail(`${dup.name} already uses this email.`, { email: `Already used by ${dup.name}` });
    if (id) {
      const [u] = await db.update(customers).set(v).where(and(eq(customers.id, id), eq(customers.businessId, ctx.business.id))).returning();
      if (!u) return fail("Customer not found.");
      revalidatePath("/customers");
      return { ok: true, data: { id } };
    }
    const [c] = await db.insert(customers).values({ ...v, businessId: ctx.business.id }).returning();
    await logActivity(ctx.business.id, "customer.created", `${c!.name} added as a customer`, ctx.user.name);
    revalidatePath("/customers");
    return { ok: true, data: { id: c!.id } };
  });
}

export async function deleteCustomerAction(id: string): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("settings:manage");
    const idp = z.string().uuid().safeParse(id);
    if (!idp.success) return fail("Invalid customer.");
    await db.delete(customers).where(and(eq(customers.id, idp.data), eq(customers.businessId, ctx.business.id)));
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

const noteSchema = z.object({ customerId: z.string().uuid(), body: z.string().trim().min(1, "Write a note").max(2000) });
export async function addNoteAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("customers:manage");
    const p = parse(noteSchema, input);
    if (!p.ok) return p.res;
    const [c] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, p.data.customerId), eq(customers.businessId, ctx.business.id)));
    if (!c) return fail("Customer not found.");
    await db.insert(customerNotes).values({ customerId: c.id, authorId: ctx.user.id, body: p.data.body });
    revalidatePath(`/customers/${c.id}`);
    return { ok: true };
  });
}

export async function deleteNoteAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("customers:manage");
    const p = parse(z.object({ customerId: z.string().uuid(), noteId: z.string().uuid() }), input);
    if (!p.ok) return p.res;
    const [c] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, p.data.customerId), eq(customers.businessId, ctx.business.id)));
    if (!c) return fail("Customer not found.");
    await db.delete(customerNotes).where(and(eq(customerNotes.id, p.data.noteId), eq(customerNotes.customerId, c.id)));
    revalidatePath(`/customers/${c.id}`);
    return { ok: true };
  });
}
