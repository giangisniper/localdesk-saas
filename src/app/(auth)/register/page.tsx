import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RegisterForm } from "../auth-forms";

export const metadata = { title: "Create account" };
export default async function Page() {
  if (await getSession()) redirect("/dashboard");
  return <RegisterForm />;
}
