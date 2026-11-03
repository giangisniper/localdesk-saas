import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "../auth-forms";
import { OAuthButtons } from "@/components/oauth-buttons";
import { oauthErrorMessage } from "@/lib/oauth/config";

export const metadata = { title: "Sign in" };
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (await getSession()) redirect("/dashboard");
  return <LoginForm oauth={<OAuthButtons mode="login" />} initialError={oauthErrorMessage(error)} />;
}
