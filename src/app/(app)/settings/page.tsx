import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { requireCtx } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "@/components/settings-tabs";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { business, user, role } = await requireCtx("settings:manage");
  const members = can(role, "team:manage")
    ? await db.select({ userId: users.id, name: users.name, email: users.email, role: memberships.role }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.businessId, business.id)).orderBy(asc(users.name))
    : [];
  const { onboardedAt, createdAt, ...b } = business;
  void onboardedAt; void createdAt;
  return (
    <div>
      <PageHeader title="Settings" description="Business profile, opening hours, booking rules and your account." />
      <SettingsTabs business={b} user={user} role={role} members={members} appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"} />
    </div>
  );
}
