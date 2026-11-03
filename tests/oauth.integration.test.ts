import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray, like } from "drizzle-orm";
import { db, pool } from "@/db";
import { oauthAccounts, users } from "@/db/schema";
import { linkIdentity, listLinks, loginWithIdentity, unlinkIdentity } from "@/server/oauth";
import { hashPassword } from "@/lib/auth";

const tag = `oauthtest${Date.now()}`;
const em = (n: string) => `${n}.${tag}@example.com`;
const sub = (n: string) => `${tag}-${n}`;
afterAll(async () => { await db.delete(users).where(like(users.email, `%${tag}%`)); await pool.end(); });

const profile = (n: string, extra: Record<string, unknown> = {}) => ({ provider: "google" as const, subject: sub(n), email: em(n), emailVerified: true, name: `User ${n}`, ...extra });

describe("OAuth identity model", () => {
  it("creates a passwordless account on first login and reuses it afterwards", async () => {
    const a = await loginWithIdentity(profile("a"));
    expect(a).toMatchObject({ ok: true, isNew: true });
    const [u] = await db.select().from(users).where(eq(users.email, em("a")));
    expect(u!.passwordHash).toBeNull(); expect(u!.name).toBe("User a");
    const again = await loginWithIdentity(profile("a", { email: "changed@elsewhere.example", name: "Other" }));
    expect(again).toEqual({ ok: true, userId: u!.id, isNew: false }); // keyed by subject, not email
    expect(await db.select().from(users).where(like(users.email, `%.${tag}@%`))).toHaveLength(1);
  });
  it("enforces provider identity uniqueness at the database level", async () => {
    const [u] = await db.select().from(users).where(eq(users.email, em("a")));
    const [other] = await db.insert(users).values({ email: em("dup"), name: "Dup", passwordHash: null }).returning();
    await expect(db.insert(oauthAccounts).values({ userId: other!.id, provider: "google", providerAccountId: sub("a") })).rejects.toBeTruthy(); // same identity, other user
    await expect(db.insert(oauthAccounts).values({ userId: u!.id, provider: "google", providerAccountId: "another-sub" })).rejects.toBeTruthy(); // 2nd google link for one user
  });
  it("NEVER auto-links an OAuth identity to an existing password account with the same email", async () => {
    const [victim] = await db.insert(users).values({ email: em("victim"), name: "Victim", passwordHash: await hashPassword("victim-password-1") }).returning();
    const attack = await loginWithIdentity(profile("attacker", { email: em("victim") }));
    expect(attack).toEqual({ ok: false, code: "account_exists" });
    expect(await listLinks(victim!.id)).toHaveLength(0);
    // case/whitespace variants of the email are treated the same
    expect(await loginWithIdentity(profile("attacker2", { email: ` ${em("victim").toUpperCase()} ` }))).toEqual({ ok: false, code: "account_exists" });
    const [still] = await db.select().from(users).where(eq(users.id, victim!.id));
    expect(still!.passwordHash).toBeTruthy();
  });
  it("requires a verified email with valid syntax for new accounts", async () => {
    expect(await loginWithIdentity(profile("unv", { emailVerified: false }))).toEqual({ ok: false, code: "email_unverified" });
    expect(await loginWithIdentity(profile("noemail", { email: undefined }))).toEqual({ ok: false, code: "no_email" });
    expect(await loginWithIdentity(profile("bad", { email: "not-an-email" }))).toEqual({ ok: false, code: "no_email" });
    expect(await db.select().from(users).where(like(users.email, `unv.${tag}%`))).toHaveLength(0);
  });
  it("supports Apple private-relay addresses and persists the first-login name", async () => {
    const relay = `abc123.${tag}@privaterelay.appleid.com`;
    const r = await loginWithIdentity({ provider: "apple", subject: sub("apple1"), email: relay, emailVerified: true, name: "Ada Lovelace" });
    expect(r).toMatchObject({ ok: true, isNew: true });
    const [u] = await db.select().from(users).where(eq(users.email, relay));
    expect(u!.name).toBe("Ada Lovelace");
    // returning Apple login without a name or even an email still works (subject lookup)
    expect(await loginWithIdentity({ provider: "apple", subject: sub("apple1"), emailVerified: false })).toMatchObject({ ok: true, isNew: false });
  });
  it("links a provider only for the given authenticated user, and guards collisions", async () => {
    const [pwUser] = await db.insert(users).values({ email: em("pw"), name: "Pw", passwordHash: await hashPassword("password-pw-1") }).returning();
    expect(await linkIdentity(pwUser!.id, profile("pwg", { email: "whatever@else.example" }))).toEqual({ ok: true, alreadyLinked: false });
    expect(await linkIdentity(pwUser!.id, profile("pwg"))).toEqual({ ok: true, alreadyLinked: true });
    expect(await linkIdentity(pwUser!.id, profile("pwg2"))).toEqual({ ok: false, code: "provider_already_linked" });
    const [stranger] = await db.insert(users).values({ email: em("stranger"), name: "Stranger", passwordHash: await hashPassword("password-st-1") }).returning();
    expect(await linkIdentity(stranger!.id, profile("pwg"))).toEqual({ ok: false, code: "identity_in_use" }); // identity already belongs to pwUser
    // after linking, signing in with that identity yields the *password user's* account
    expect(await loginWithIdentity(profile("pwg"))).toEqual({ ok: true, userId: pwUser!.id, isNew: false });
  });
  it("won't remove the last sign-in method", async () => {
    const [only] = await db.select().from(users).where(eq(users.email, em("a")));
    expect(await unlinkIdentity(only!.id, "google")).toMatchObject({ ok: false });
    const [pwUser] = await db.select().from(users).where(eq(users.email, em("pw")));
    expect(await unlinkIdentity(pwUser!.id, "google")).toEqual({ ok: true }); // has a password
    expect(await unlinkIdentity(pwUser!.id, "google")).toMatchObject({ ok: false });
  });
  it("cascades identities when a user is deleted", async () => {
    const [u] = await db.select().from(users).where(eq(users.email, em("a")));
    await db.delete(users).where(eq(users.id, u!.id));
    expect(await db.select().from(oauthAccounts).where(inArray(oauthAccounts.providerAccountId, [sub("a")]))).toHaveLength(0);
  });
});
