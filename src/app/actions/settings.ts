"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, memberships, users } from "@/db/schema";
import { actionCtx, hashPassword, verifyPassword } from "@/lib/auth";
import { fail, parse, safely, type ActionResult } from "@/lib/action";
import { accountSchema, bookingRulesSchema, businessSchema, notificationsSchema, openingHoursSchema, passwordChangeSchema, registerSchema } from "@/lib/validation";

function done(): ActionResult { revalidatePath("/", "layout"); return { ok: true }; }

export async function updateBusinessAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("settings:manage");
    const p = parse(businessSchema, input);
    if (!p.ok) return p.res;
    try { new Intl.DateTimeFormat("en", { timeZone: p.data.timezone }); } catch { return fail("Unknown timezone.", { timezone: "Unknown timezone" }); }
    const [dup] = await db.select({ id: businesses.id }).from(businesses).where(and(eq(businesses.slug, p.data.slug), ne(businesses.id, ctx.business.id)));
    if (dup) return fail("That booking URL is taken.", { slug: "Already in use — choose another" });
    await db.update(businesses).set(p.data).where(eq(businesses.id, ctx.business.id));
    return done();
  });
}

export async function updateHoursAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("settings:manage");
    const p = parse(openingHoursSchema, input);
    if (!p.ok) return p.res;
    await db.update(businesses).set({ openingHours: p.data }).where(eq(businesses.id, ctx.business.id));
    return done();
  });
}

export async function updateRulesAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("settings:manage");
    const p = parse(bookingRulesSchema, input);
    if (!p.ok) return p.res;
    await db.update(businesses).set(p.data).where(eq(businesses.id, ctx.business.id));
    return done();
  });
}

export async function updateNotificationsAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("settings:manage");
    const p = parse(notificationsSchema, input);
    if (!p.ok) return p.res;
    await db.update(businesses).set({ notifications: p.data }).where(eq(businesses.id, ctx.business.id));
    return done();
  });
}

export async function updateAccountAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx();
    const p = parse(accountSchema, input);
    if (!p.ok) return p.res;
    await db.update(users).set({ name: p.data.name }).where(eq(users.id, ctx.user.id));
    return done();
  });
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx();
    const p = parse(passwordChangeSchema, input);
    if (!p.ok) return p.res;
    const [u] = await db.select().from(users).where(eq(users.id, ctx.user.id));
    if (!u || !(await verifyPassword(p.data.current, u.passwordHash))) return fail("Current password is incorrect.", { current: "Incorrect password" });
    await db.update(users).set({ passwordHash: await hashPassword(p.data.next) }).where(eq(users.id, u.id));
    return { ok: true };
  });
}

const memberSchema = z.object({ name: registerSchema.shape.name, email: registerSchema.shape.email, password: registerSchema.shape.password, role: z.enum(["admin", "staff"]) });
export async function addMemberAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("team:manage");
    const p = parse(memberSchema, input);
    if (!p.ok) return p.res;
    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${p.data.email}`);
    if (existing) return fail("That email already has a LocalDesk account.", { email: "Email already registered" });
    await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ name: p.data.name, email: p.data.email, passwordHash: await hashPassword(p.data.password) }).returning();
      await tx.insert(memberships).values({ userId: u!.id, businessId: ctx.business.id, role: p.data.role });
    });
    return done();
  });
}

export async function changeRoleAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("team:manage");
    const p = parse(z.object({ userId: z.string().uuid(), role: z.enum(["admin", "staff"]) }), input);
    if (!p.ok) return p.res;
    if (p.data.userId === ctx.user.id) return fail("You can't change your own role.");
    await db.update(memberships).set({ role: p.data.role }).where(and(eq(memberships.userId, p.data.userId), eq(memberships.businessId, ctx.business.id), ne(memberships.role, "owner")));
    return done();
  });
}

export async function removeMemberAction(userId: string): Promise<ActionResult> {
  return safely(async () => {
    const ctx = await actionCtx("team:manage");
    if (!z.string().uuid().safeParse(userId).success) return fail("Invalid user.");
    if (userId === ctx.user.id) return fail("You can't remove yourself.");
    await db.delete(memberships).where(and(eq(memberships.userId, userId), eq(memberships.businessId, ctx.business.id), ne(memberships.role, "owner")));
    return done();
  });
}
