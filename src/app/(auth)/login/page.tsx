import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "../auth-forms";

export const metadata = { title: "Sign in" };
export default async function Page() {
  if (await getSession()) redirect("/dashboard");
  return <LoginForm />;
}
