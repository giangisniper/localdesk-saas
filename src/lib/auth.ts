import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { shouldUseSecureCookie } from "./cookie";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, memberships, users, type Role } from "@/db/schema";
import { can, type Permission } from "./permissions";

const COOKIE = "ld_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set and at least 32 characters long");
  return new TextEncoder().encode(s);
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

async function cookieOptions() {
  const secure = shouldUseSecureCookie({
    override: process.env.AUTH_COOKIE_SECURE,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    forwardedProto: (await headers()).get("x-forwarded-proto"),
  });
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
}

export async function createSession(userId: string, sessionVersion: number) {
  const token = await new SignJWT({ sv: sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(userId)
    .setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  (await cookies()).set(COOKIE, token, { ...(await cookieOptions()), maxAge: MAX_AGE });
}

export async function destroySession() {
  (await cookies()).set(COOKIE, "", { ...(await cookieOptions()), maxAge: 0 });
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let userId: string;
  let sv = 0;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    userId = payload.sub;
    sv = typeof payload.sv === "number" ? payload.sv : -1;
  } catch {
    return null;
  }
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, userId));
  if (!user || user.sessionVersion !== sv) return null;
  const [m] = await db
    .select({ business: businesses, role: memberships.role })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(eq(memberships.userId, userId))
    .limit(1);
  return { user: { id: user.id, name: user.name, email: user.email }, business: m?.business ?? null, role: (m?.role ?? null) as Role | null };
});

export type Ctx = {
  user: { id: string; name: string; email: string };
  business: typeof businesses.$inferSelect;
  role: Role;
};

/** For pages/layouts: redirects when unauthenticated or not onboarded / lacking permission. */
export async function requireCtx(permission?: Permission): Promise<Ctx> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.business || !s.role) redirect("/onboarding");
  if (!s.business.onboardedAt) redirect("/onboarding");
  if (permission && !can(s.role, permission)) redirect("/calendar");
  return { user: s.user, business: s.business, role: s.role };
}

/** For server actions: throws instead of redirecting. */
export async function actionCtx(permission?: Permission): Promise<Ctx> {
  const s = await getSession();
  if (!s || !s.business || !s.role) throw new ActionError("You need to sign in again.");
  if (permission && !can(s.role, permission)) throw new ActionError("You don't have permission to do that.");
  return { user: s.user, business: s.business, role: s.role };
}

export class ActionError extends Error {}

export async function userHasBusiness(userId: string, businessId: string) {
  const [r] = await db.select().from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.businessId, businessId)));
  return !!r;
}
