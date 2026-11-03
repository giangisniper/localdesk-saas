import { requireCtx } from "@/lib/auth";
import { formOptions } from "@/server/queries";
import { PageHeader } from "@/components/ui";
import { ServiceManager } from "@/components/service-manager";

export const metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const { business } = await requireCtx("services:manage");
  const o = await formOptions(business.id);
  return (
    <div>
      <PageHeader title="Services" description="What you offer, how long it takes and what it costs." />
      <ServiceManager currency={business.currency} staff={o.staff.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
        services={o.services.map((s) => ({ id: s.id, name: s.name, description: s.description, category: s.category, durationMin: s.durationMin, priceCents: s.priceCents, color: s.color, active: s.active, bookableOnline: s.bookableOnline, staffIds: o.links.filter((l) => l.serviceId === s.id).map((l) => l.staffId) }))} />
    </div>
  );
}
