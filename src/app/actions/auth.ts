"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { businesses, memberships, services, staff, staffHours, staffServices, users } from "@/db/schema";
import { createSession, destroySession, getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { fail, parse, safely, type ActionResult } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { parsePriceToCents } from "@/lib/money";
import { loginSchema, onboardingSchema, registerSchema } from "@/lib/validation";
import { slugify } from "@/lib/utils";
import { toMinutes } from "@/lib/time";

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

// Pre-computed hash so unknown-email logins take the same time as wrong-password ones.
const DUMMY_HASH = "$2b$12$XyiJTczvYW/KpMFiKiw9Iur10T.nmO6EsZ2d.lGtV3rZtCD2PAsua";

export async function registerAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    if (!rateLimit(`register:${await clientKey()}`, 8, 15 * 60_000)) return fail("Too many attempts. Try again in a few minutes.");
    const p = parse(registerSchema, input);
    if (!p.ok) return p.res;
    const { name, email, password } = p.data;
    const [dup] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
    if (dup) return fail("An account with this email already exists.", { email: "Email already registered" });
    const [u] = await db.insert(users).values({ name, email, passwordHash: await hashPassword(password) }).returning();
    await createSession(u!.id, u!.sessionVersion);
    return { ok: true };
  });
}

export async function loginAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const p = parse(loginSchema, input);
    if (!p.ok) return p.res;
    const { email, password } = p.data;
    if (!rateLimit(`login:${await clientKey()}:${email}`, 8, 10 * 60_000)) return fail("Too many attempts. Try again in a few minutes.");
    const [u] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
    const valid = await verifyPassword(password, u?.passwordHash ?? DUMMY_HASH);
    if (!u || !valid) return fail("Incorrect email or password.");
    await createSession(u.id, u.sessionVersion);
    return { ok: true };
  });
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [hit] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.slug, candidate));
    if (!hit) return candidate;
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function onboardingAction(input: unknown): Promise<ActionResult> {
  return safely(async () => {
    const s = await getSession();
    if (!s) return fail("Please sign in first.");
    if (s.business?.onboardedAt) return fail("Your business is already set up.");
    const p = parse(onboardingSchema, input);
    if (!p.ok) return p.res;
    const d = p.data;
    const priceCents = parsePriceToCents(d.firstService.price);
    if (priceCents === null) return fail("Enter a valid price.", { "firstService.price": "Enter a valid price" });
    if (Object.values(d.openingHours).every((w) => w.length === 0)) return fail("Open at least one day of the week.");
    const slug = await uniqueSlug(d.name);
    await db.transaction(async (tx) => {
      const [biz] = await tx.insert(businesses).values({
        name: d.name, slug, category: d.category, timezone: d.timezone, currency: d.currency,
        openingHours: d.openingHours, email: s.user.email, onboardedAt: new Date(),
      }).returning();
      await tx.insert(memberships).values({ userId: s.user.id, businessId: biz!.id, role: "owner" });
      const [svc] = await tx.insert(services).values({
        businessId: biz!.id, name: d.firstService.name, durationMin: d.firstService.durationMin, priceCents,
      }).returning();
      const [st] = await tx.insert(staff).values({ businessId: biz!.id, name: d.staffName, userId: s.user.id, email: s.user.email }).returning();
      await tx.insert(staffServices).values({ staffId: st!.id, serviceId: svc!.id });
      const hours = Object.entries(d.openingHours).flatMap(([wd, ws]) =>
        ws.filter((w) => toMinutes(w.open) < toMinutes(w.close)).map((w) => ({ staffId: st!.id, weekday: Number(wd), startTime: w.open, endTime: w.close })));
      if (hours.length) await tx.insert(staffHours).values(hours);
    });
    return { ok: true };
  });
}

