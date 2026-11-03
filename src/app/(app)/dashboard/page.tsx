import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, CalendarX2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requireCtx } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { resolveRange } from "@/lib/range";
import { changePct, formatMoney, pct } from "@/lib/utils";
import { fmtDate, fmtTime } from "@/lib/time";
import * as stats from "@/server/stats";
import { recentActivity, upcomingAppointments } from "@/server/queries";
import { Avatar, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { StatCard } from "@/components/stat-card";
import { RangeFilter } from "@/components/range-filter";
import { SimpleBars, TrendChart } from "@/components/charts";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { business, role, user } = await requireCtx();
  if (!can(role, "dashboard:view")) redirect("/calendar");
  const range = resolveRange(await searchParams, business.timezone);
  const b = { id: business.id, timezone: business.timezone };
  const [k, series, popular, upcoming, feed] = await Promise.all([
    stats.kpis(b, range), stats.timeSeries(b, range), stats.popularServices(b, range),
    upcomingAppointments(business.id, 6), recentActivity(business.id, 8),
  ]);
  const { current: c, previous: p } = k;
  const cur = (v: number) => formatMoney(v, business.currency);
  const cancelRate = pct(c.cancelled, c.total);
  const prevCancelRate = pct(p.cancelled, p.total);
  const hour = Number(fmtTime(new Date(), business.timezone).slice(0, 2));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`}
        description={`${business.name} · ${range.from} → ${range.to}`}
        actions={<Link href="/calendar?new=1" className={buttonClass("primary")}><CalendarPlus className="size-4" />New appointment</Link>}
      />
      <RangeFilter current={range.key} from={range.from} to={range.to} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={cur(c.revenue)} delta={changePct(c.revenue, p.revenue)} />
        <StatCard label="Appointments" value={String(c.booked)} delta={changePct(c.booked, p.booked)} />
        <StatCard label="New customers" value={String(c.newCustomers)} delta={changePct(c.newCustomers, p.newCustomers)} />
        <StatCard label="Cancellation rate" value={`${cancelRate}%`} delta={cancelRate - prevCancelRate} invert />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue" description={`Completed appointments · avg. ticket ${cur(c.avgTicket)}`} />
          <div className="px-3 pb-4"><TrendChart data={series.points} dataKey="revenue" granularity={series.granularity} money currency={business.currency} label="Revenue" /></div>
        </Card>
        <Card>
          <CardHeader title="Top services" description="By appointments booked" />
          <div className="px-3 pb-4"><SimpleBars data={popular.slice(0, 6)} horizontal height={260} label="Top services by appointments" /></div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Upcoming appointments" action={<Link href="/appointments?when=upcoming" className="text-[13px] font-medium text-brand-700 hover:underline">View all</Link>} />
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarX2 className="size-5" />} title="Nothing scheduled" description="New bookings from your booking page and calendar show up here." />
          ) : (
            <ul className="divide-y divide-ink-100 px-5 pb-2">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <div className="w-14 shrink-0 text-center leading-tight">
                    <p className="text-[11px] font-medium uppercase text-ink-400">{fmtDate(a.startsAt, business.timezone, "EEE d")}</p>
                    <p className="text-sm font-semibold tabular">{fmtTime(a.startsAt, business.timezone)}</p>
                  </div>
                  <span className="h-9 w-1 rounded-full" style={{ background: a.serviceColor }} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/customers/${a.customerId}`} className="block truncate text-sm font-medium hover:underline">{a.customerName}</Link>
                    <p className="truncate text-[13px] text-ink-500">{a.serviceName} · {a.staffName}</p>
                  </div>
                  <span className="hidden sm:block"><StatusBadge status={a.status} /></span>
                  <span className="hidden w-16 text-right text-sm tabular text-ink-600 sm:block">{cur(a.priceCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent activity" />
          {feed.length === 0 ? <EmptyState icon={<Clock className="size-5" />} title="No activity yet" /> : (
            <ul className="space-y-4 px-5 pb-5">
              {feed.map((f) => (
                <li key={f.id} className="flex gap-3">
                  <Avatar name={f.actor} size={28} color="#5d5a52" />
                  <div className="min-w-0">
                    <p className="text-[13px] leading-snug text-ink-800">{f.message}</p>
                    <p className="mt-0.5 text-xs text-ink-400">{f.actor} · {formatDistanceToNow(f.createdAt, { addSuffix: true })}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
