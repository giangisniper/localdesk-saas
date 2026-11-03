import { startOAuth } from "@/server/oauth-flow";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  return startOAuth(provider, req.headers.get("x-forwarded-host") ?? req.headers.get("host"), url.searchParams.get("mode"));
}
