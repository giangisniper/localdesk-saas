import { requireCtx } from "@/lib/auth";
import { formOptions, staffWithDetails } from "@/server/queries";
import { PageHeader } from "@/components/ui";
import { StaffManager } from "@/components/staff-manager";
import { todayIn } from "@/lib/time";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { business } = await requireCtx("staff:manage");
  const [members, o] = await Promise.all([staffWithDetails(business.id), formOptions(business.id)]);
  return (
    <div>
      <PageHeader title="Team" description="Your professionals, their working hours and the services they perform." />
      <StaffManager tz={business.timezone} today={todayIn(business.timezone)} services={o.services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
        staff={members.map((m) => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, title: m.title, color: m.color, active: m.active, hours: m.hours, serviceIds: m.serviceIds,
          timeOff: m.timeOff.map((t) => ({ id: t.id, startsAt: t.startsAt.toISOString(), endsAt: t.endsAt.toISOString(), reason: t.reason })) }))} />
    </div>
  );
}
