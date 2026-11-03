import { finishOAuth } from "@/server/oauth-flow";

export const dynamic = "force-dynamic";

// Google: GET with ?code&state. Apple: cross-site POST (form_post) with code, state and, on first login only, `user`.
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  return finishOAuth(provider, new URL(req.url).searchParams);
}

export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (provider !== "apple") return new Response("Method not allowed", { status: 405 });
  const form = await req.formData().catch(() => null);
  const params = new URLSearchParams();
  form?.forEach((v, k) => { if (typeof v === "string") params.set(k, v); });
  return finishOAuth(provider, params);
}
