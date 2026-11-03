import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Set up your business" };
export default async function Page() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.business?.onboardedAt) redirect("/dashboard");
  return <OnboardingWizard defaultName={s.user.name} />;
}
