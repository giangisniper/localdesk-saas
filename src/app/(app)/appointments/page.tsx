import Link from "next/link";
import { Search } from "lucide-react";
import { requireCtx } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { dayRange, todayIn, DATE_RE } from "@/lib/time";
import { customerOptions, formOptions, searchAppointments } from "@/server/queries";
import { AppointmentsTable } from "@/components/appointments-table";
import { Pagination } from "@/components/pagination";
import { PageHeader, Select, Input, Button } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";

export const metadata = { title: "Appointments" };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { business, role } = await requireCtx("appointments:manage");
  const sp = await searchParams;
  const tz = business.timezone;
  const today = todayIn(tz);
  const when = ["upcoming", "past", "all"].includes(sp.when ?? "") ? sp.when! : "upcoming";
  const from = sp.from && DATE_RE.test(sp.from) ? dayRange(sp.from, tz).start : when === "upcoming" ? dayRange(today, tz).start : undefined;
  const to = sp.to && DATE_RE.test(sp.to) ? dayRange(sp.to, tz).end : when === "past" ? dayRange(today, tz).start : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const [options, customers, result] = await Promise.all([
    formOptions(business.id), customerOptions(business.id),
    searchAppointments(business.id, {
      status: sp.status || undefined, staffId: sp.staff || undefined, q: sp.q?.trim() || undefined, from, to, page, pageSize: PAGE_SIZE,
      sort: when === "past" || when === "all" ? "desc" : "asc",
    }),
  ]);
  const rows = result.rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString() }));
  return (
    <div>
      <PageHeader title="Appointments" description="Search, filter and manage every booking." actions={<Link href="/calendar?new=1" className={buttonClass("primary")}>New appointment</Link>} />
      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-ink-400" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search customer or service" className="pl-8" aria-label="Search appointments" />
        </div>
        <Select name="when" defaultValue={when} aria-label="Time period" className="w-32"><option value="upcoming">Upcoming</option><option value="past">Past</option><option value="all">All time</option></Select>
        <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="w-36">
          <option value="">Any status</option>{["scheduled", "confirmed", "completed", "cancelled", "no_show"].map((s) => <option key={s} value={s}>{s.replace("_", "-")}</option>)}
        </Select>
        <Select name="staff" defaultValue={sp.staff ?? ""} aria-label="Staff" className="w-40"><option value="">All staff</option>{options.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Button type="submit" variant="secondary">Apply</Button>
        {(sp.q || sp.status || sp.staff || sp.when) && <Link href="/appointments" className="text-[13px] font-medium text-ink-500 hover:text-ink-900">Reset</Link>}
      </form>
      <AppointmentsTable rows={rows} tz={tz} currency={business.currency}
        data={{ services: options.services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, active: s.active })), staff: options.staff.map((s) => ({ id: s.id, name: s.name, active: s.active })), links: options.links, customers, currency: business.currency, canDelete: can(role, "settings:manage") }} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} basePath="/appointments" params={{ q: sp.q, when, status: sp.status, staff: sp.staff }} />
    </div>
  );
}
