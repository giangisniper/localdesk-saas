import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT, exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import { signFlow, verifyFlow, statesMatch, randomToken } from "@/lib/oauth/state";
import { buildAppleClientSecret, parseAppleUserField, truthy } from "@/lib/oauth/apple";
import { providerStatus, redirectUri, oauthErrorMessage } from "@/lib/oauth/config";

beforeAll(() => { process.env.AUTH_SECRET = "unit-test-secret-0123456789abcdef0123456789"; });

describe("OAuth flow state (signed cookie)", () => {
  const flow = () => ({ provider: "google" as const, state: randomToken(), nonce: randomToken(), codeVerifier: randomToken(), mode: "login" as const });
  it("round-trips a valid flow", async () => {
    const f = flow();
    expect(await verifyFlow(await signFlow(f), "google")).toMatchObject({ state: f.state, nonce: f.nonce, mode: "login" });
  });
  it("rejects missing, tampered, expired, wrong-provider and wrong-type tokens", async () => {
    const t = await signFlow(flow());
    expect(await verifyFlow(undefined, "google")).toBeNull();
    expect(await verifyFlow("garbage", "google")).toBeNull();
    expect(await verifyFlow(t.slice(0, -4) + "AAAA", "google")).toBeNull();
    expect(await verifyFlow(t, "apple")).toBeNull(); // cookie issued for google cannot complete an apple flow
    const key = (await import("node:crypto")).createHash("sha256").update(`oauth-flow|${process.env.AUTH_SECRET}`).digest();
    const expired = await new SignJWT({ typ: "oauth-flow", ...flow() }).setProtectedHeader({ alg: "HS256" }).setExpirationTime(Math.floor(Date.now() / 1000) - 10).sign(key);
    expect(await verifyFlow(expired, "google")).toBeNull();
    const wrongType = await new SignJWT({ typ: "session", ...flow() }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("5m").sign(key);
    expect(await verifyFlow(wrongType, "google")).toBeNull();
  });
  it("a session token is not a valid flow token and vice versa", async () => {
    const sessionLike = await new SignJWT({ sv: 0 }).setProtectedHeader({ alg: "HS256" }).setSubject("u").setExpirationTime("5m").sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
    expect(await verifyFlow(sessionLike, "google")).toBeNull();
    const f = await signFlow(flow());
    await expect(jwtVerify(f, new TextEncoder().encode(process.env.AUTH_SECRET!))).rejects.toBeTruthy();
  });
  it("compares the echoed state strictly", () => {
    expect(statesMatch("abc", "abc")).toBe(true);
    for (const bad of ["abd", "ab", "abcd", "", null, undefined]) expect(statesMatch("abc", bad as string)).toBe(false);
  });
});

describe("Apple helpers", () => {
  it("builds a verifiable ES256 client secret with the right claims", async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true });
    const pem = await exportPKCS8(privateKey);
    const now = 1_800_000_000;
    for (const key of [pem, pem.replace(/\n/g, "\\n")]) { // real PEM and the single-line .env form
      const jwt = await buildAppleClientSecret({ teamId: "TEAM123456", keyId: "KEY1234567", clientId: "com.example.web", privateKey: key }, now);
      const { payload, protectedHeader } = await jwtVerify(jwt, publicKey, { currentDate: new Date((now + 10) * 1000) });
      expect(protectedHeader).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
      expect(payload).toMatchObject({ iss: "TEAM123456", sub: "com.example.web", aud: "https://appleid.apple.com", iat: now, exp: now + 300 });
    }
  });
  it("parses the first-login `user` field defensively", () => {
    expect(parseAppleUserField(JSON.stringify({ name: { firstName: "Ada", lastName: "Lovelace" }, email: "x@y.z" }))).toEqual({ name: "Ada Lovelace" });
    expect(parseAppleUserField(JSON.stringify({ name: { firstName: "Ada" } }))).toEqual({ name: "Ada" });
    expect(parseAppleUserField("not json")).toEqual({});
    expect(parseAppleUserField(null)).toEqual({});
    expect(parseAppleUserField(JSON.stringify({ name: { firstName: "x".repeat(500) } })).name!.length).toBe(80);
    expect(truthy("true") && truthy(true) && !truthy("false") && !truthy(undefined)).toBe(true);
  });
});

describe("provider readiness", () => {
  const full = { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s", APPLE_CLIENT_ID: "c", APPLE_TEAM_ID: "t", APPLE_KEY_ID: "k", APPLE_PRIVATE_KEY: "p" };
  it("is not ready without credentials", () => {
    const s = providerStatus("google", { NEXT_PUBLIC_APP_URL: "http://localhost:3000" });
    expect(s.ready).toBe(false); expect(s.missing).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
    expect(providerStatus("google", { ...full, GOOGLE_CLIENT_SECRET: "  " }).ready).toBe(false);
  });
  it("google works on localhost over http and on https domains, but not on raw http hosts", () => {
    expect(providerStatus("google", { ...full, NEXT_PUBLIC_APP_URL: "http://localhost:3000" }).ready).toBe(true);
    expect(providerStatus("google", { ...full, NEXT_PUBLIC_APP_URL: "https://app.example.com" }).ready).toBe(true);
    expect(providerStatus("google", { ...full, NEXT_PUBLIC_APP_URL: "http://192.168.0.34:3000" }).ready).toBe(false);
  });
  it("apple requires https and refuses localhost / LAN IPs", () => {
    expect(providerStatus("apple", { ...full, NEXT_PUBLIC_APP_URL: "https://app.example.com" }).ready).toBe(true);
    expect(providerStatus("apple", { ...full, NEXT_PUBLIC_APP_URL: "http://localhost:3000" }).ready).toBe(false);
    expect(providerStatus("apple", { ...full, NEXT_PUBLIC_APP_URL: "http://192.168.0.34:3000" }).ready).toBe(false);
  });
  it("derives redirect URIs from the configured app URL only", () => {
    expect(redirectUri("google", { NEXT_PUBLIC_APP_URL: "https://app.example.com/" })).toBe("https://app.example.com/api/auth/google/callback");
  });
  it("only exposes whitelisted error messages", () => {
    expect(oauthErrorMessage("account_exists")).toMatch(/already exists/);
    for (const bad of ["<script>", "constructor", "__proto__", undefined, ""]) expect(oauthErrorMessage(bad as string)).toBeUndefined();
  });
});
