import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { resolveRange } from "@/lib/range";
import { changePct, formatMoney, pct } from "@/lib/utils";
import * as stats from "@/server/stats";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { StatCard } from "@/components/stat-card";
import { RangeFilter } from "@/components/range-filter";
import { RetentionChart, SimpleBars, StatusDonut, TrendChart } from "@/components/charts";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { business } = await requireCtx("analytics:view");
  const range = resolveRange(await searchParams, business.timezone);
  // retention needs at least a few months of context regardless of the filter
  const retentionRange = { ...range, from: range.days < 120 ? resolveRange({ range: "12m" }, business.timezone).from : range.from };
  const b = { id: business.id, timezone: business.timezone };
  const [k, series, popular, staffPerf, weekday, hour, status, retention, top] = await Promise.all([
    stats.kpis(b, range), stats.timeSeries(b, range), stats.popularServices(b, range), stats.staffPerformance(b, range),
    stats.byWeekday(b, range), stats.byHour(b, range), stats.statusBreakdown(b, range), stats.retention(b, retentionRange), stats.topCustomers(b, 5),
  ]);
  const { current: c, previous: p } = k;
  const cur = (v: number) => formatMoney(v, business.currency);
  const noShowRate = pct(c.noShow, c.completed + c.noShow);
  const prevNoShow = pct(p.noShow, p.completed + p.noShow);
  const maxRev = Math.max(1, ...staffPerf.map((s) => s.revenue));

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description={`Business performance · ${range.from} → ${range.to}`} />
      <RangeFilter current={range.key} from={range.from} to={range.to} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue" value={cur(c.revenue)} delta={changePct(c.revenue, p.revenue)} />
        <StatCard label="Average ticket" value={cur(c.avgTicket)} delta={changePct(c.avgTicket, p.avgTicket)} />
        <StatCard label="No-show rate" value={`${noShowRate}%`} delta={noShowRate - prevNoShow} invert />
        <StatCard label="Repeat customer rate" value={`${retention.repeatRate}%`} hint={`${retention.lapsed} customers inactive for 60+ days`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Revenue trend" description="Completed appointments" />
          <div className="px-3 pb-4"><TrendChart data={series.points} dataKey="revenue" granularity={series.granularity} money currency={business.currency} label="Revenue" /></div></Card>
        <Card><CardHeader title="Appointment trend" description="Excludes cancellations" />
          <div className="px-3 pb-4"><TrendChart data={series.points} dataKey="appointments" granularity={series.granularity} label="Appointments" /></div></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardHeader title="Customer retention" description="Customers seen each month, split by new vs returning" />
          <div className="px-3 pb-4"><RetentionChart data={retention.monthly} /></div></Card>
        <Card><CardHeader title="Appointment outcomes" />
          <div className="px-5 pb-5 pt-2"><StatusDonut data={status} /></div></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Popular services" description="Appointments and revenue" />
          <div className="overflow-x-auto px-5 pb-4"><table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-500"><tr><th className="py-2 text-left font-medium">Service</th><th className="py-2 text-right font-medium">Bookings</th><th className="py-2 text-right font-medium">Revenue</th></tr></thead>
            <tbody className="divide-y divide-ink-100">{popular.map((s) => (
              <tr key={s.name}><td className="py-2.5"><span className="mr-2 inline-block size-2 rounded-full" style={{ background: s.color }} />{s.name}</td><td className="py-2.5 text-right tabular">{s.count}</td><td className="py-2.5 text-right tabular">{formatMoney(s.revenue * 100, business.currency)}</td></tr>
            ))}</tbody>
          </table></div></Card>
        <Card><CardHeader title="Team performance" description="Revenue and booked hours" />
          <ul className="space-y-4 px-5 pb-5">{staffPerf.map((s) => (
            <li key={s.name}>
              <div className="mb-1 flex items-baseline justify-between text-sm"><span className="font-medium">{s.name}</span><span className="tabular text-ink-600">{formatMoney(s.revenue * 100, business.currency)} <span className="text-ink-400">· {s.count} appts · {s.hours} h</span></span></div>
              <div className="h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full" style={{ width: `${(s.revenue / maxRev) * 100}%`, background: s.color }} /></div>
            </li>))}</ul></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader title="Busiest days" /><div className="px-3 pb-4"><SimpleBars data={weekday} label="Appointments by weekday" /></div></Card>
        <Card><CardHeader title="Busiest hours" /><div className="px-3 pb-4"><SimpleBars data={hour} label="Appointments by hour" /></div></Card>
        <Card><CardHeader title="Top customers" description="By lifetime spend" />
          <ul className="divide-y divide-ink-100 px-5 pb-2">{top.map((t, i) => (
            <li key={t.id} className="flex items-center justify-between py-3 text-sm"><span className="flex items-center gap-3"><span className="w-4 text-ink-400 tabular">{i + 1}</span><Link href={`/customers/${t.id}`} className="font-medium hover:text-brand-700">{t.name}</Link></span><span className="tabular text-ink-600">{formatMoney(t.spent, business.currency)} <span className="text-ink-400">· {t.visits}</span></span></li>
          ))}</ul></Card>
      </div>
    </div>
  );
}
