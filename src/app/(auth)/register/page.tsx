import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RegisterForm } from "../auth-forms";
import { OAuthButtons } from "@/components/oauth-buttons";
import { oauthErrorMessage } from "@/lib/oauth/config";

export const metadata = { title: "Create account" };
export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (await getSession()) redirect("/dashboard");
  return <RegisterForm oauth={<OAuthButtons mode="register" />} initialError={oauthErrorMessage(error)} />;
}
