import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { oauthAccounts, users } from "@/db/schema";
import { isValidEmail } from "@/lib/email";
import type { Provider } from "@/lib/oauth/config";

export interface OAuthProfile { provider: Provider; subject: string; email?: string; emailVerified: boolean; name?: string }
export type OAuthErrorCode = "no_email" | "email_unverified" | "account_exists" | "identity_in_use" | "provider_already_linked";
export type LoginOutcome = { ok: true; userId: string; isNew: boolean } | { ok: false; code: OAuthErrorCode };
export type LinkOutcome = { ok: true; alreadyLinked: boolean } | { ok: false; code: OAuthErrorCode };

async function findIdentity(provider: Provider, subject: string) {
  const [row] = await db.select().from(oauthAccounts).where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, subject)));
  return row ?? null;
}

const isUniqueViolation = (e: unknown) => (e as { code?: string; cause?: { code?: string } })?.code === "23505" || (e as { cause?: { code?: string } })?.cause?.code === "23505";

/**
 * Sign-in / sign-up with an identity that the caller has ALREADY verified cryptographically.
 *
 * Account-takeover rules:
 *  - An identity is looked up by (provider, subject), never by email.
 *  - A *new* identity whose email matches an existing LocalDesk user is refused. It is never attached
 *    automatically; the owner of that account must sign in with their existing method and connect the
 *    provider from Settings (see `linkIdentity`).
 *  - New accounts require an email that the provider asserts is verified.
 */
export async function loginWithIdentity(p: OAuthProfile): Promise<LoginOutcome> {
  const existing = await findIdentity(p.provider, p.subject);
  if (existing) return { ok: true, userId: existing.userId, isNew: false };

  const email = p.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) return { ok: false, code: "no_email" };
  if (!p.emailVerified) return { ok: false, code: "email_unverified" };
  const [clash] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
  if (clash) return { ok: false, code: "account_exists" };

  try {
    const userId = await db.transaction(async (tx) => {
      const name = (p.name?.trim() || email.split("@")[0]!).slice(0, 80);
      const [u] = await tx.insert(users).values({ email, name: name.length >= 2 ? name : email, passwordHash: null }).returning({ id: users.id });
      await tx.insert(oauthAccounts).values({ userId: u!.id, provider: p.provider, providerAccountId: p.subject, email });
      return u!.id;
    });
    return { ok: true, userId, isNew: true };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // lost a race: either the identity or the email appeared in the meantime — re-evaluate once
    const again = await findIdentity(p.provider, p.subject);
    return again ? { ok: true, userId: again.userId, isNew: false } : { ok: false, code: "account_exists" };
  }
}

/** Attach an identity to a user who is currently authenticated (caller guarantees that). */
export async function linkIdentity(userId: string, p: OAuthProfile): Promise<LinkOutcome> {
  const existing = await findIdentity(p.provider, p.subject);
  if (existing) return existing.userId === userId ? { ok: true, alreadyLinked: true } : { ok: false, code: "identity_in_use" };
  const [mine] = await db.select({ id: oauthAccounts.id }).from(oauthAccounts).where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, p.provider)));
  if (mine) return { ok: false, code: "provider_already_linked" };
  try {
    await db.insert(oauthAccounts).values({ userId, provider: p.provider, providerAccountId: p.subject, email: p.email ?? null });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, code: "identity_in_use" };
    throw e;
  }
  return { ok: true, alreadyLinked: false };
}

/** Remove a provider link, but never leave the account without any way to sign in. */
export async function unlinkIdentity(userId: string, provider: Provider): Promise<{ ok: true } | { ok: false; reason: string }> {
  return db.transaction(async (tx) => {
    const [u] = await tx.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).for("update");
    const links = await tx.select().from(oauthAccounts).where(eq(oauthAccounts.userId, userId));
    if (!links.some((l) => l.provider === provider)) return { ok: false as const, reason: "That provider isn't connected." };
    if (!u?.hash && links.length < 2) return { ok: false as const, reason: "Set a password or connect another sign-in method first, otherwise you would be locked out." };
    await tx.delete(oauthAccounts).where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)));
    return { ok: true as const };
  });
}

export async function listLinks(userId: string) {
  return db.select({ provider: oauthAccounts.provider, email: oauthAccounts.email, createdAt: oauthAccounts.createdAt }).from(oauthAccounts).where(eq(oauthAccounts.userId, userId));
}
