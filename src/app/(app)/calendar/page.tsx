import { requireCtx } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { addDaysStr, dayRange, DATE_RE, monthStart, todayIn, weekStart } from "@/lib/time";
import { appointmentsInRange, customerOptions, formOptions } from "@/server/queries";
import { CalendarView } from "@/components/calendar-view";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { staff } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { business, role, user } = await requireCtx("calendar:view");
  const sp = await searchParams;
  const tz = business.timezone;
  const today = todayIn(tz);
  const view = (["day", "week", "month"] as const).find((v) => v === sp.view) ?? "day";
  const date = sp.date && DATE_RE.test(sp.date) ? sp.date : today;
  const [fromDate, toDate] = view === "day" ? [date, addDaysStr(date, 1)]
    : view === "week" ? [weekStart(date), addDaysStr(weekStart(date), 7)]
    : [weekStart(monthStart(date)), addDaysStr(weekStart(monthStart(date)), 42)];
  const [options, customers, [mine]] = await Promise.all([
    formOptions(business.id), customerOptions(business.id),
    db.select({ id: staff.id }).from(staff).where(and(eq(staff.businessId, business.id), eq(staff.userId, user.id))),
  ]);
  const staffFilter = sp.staff && options.staff.some((s) => s.id === sp.staff) ? sp.staff : "all";
  const rows = await appointmentsInRange(business.id, dayRange(fromDate, tz).start, dayRange(toDate, tz).start, staffFilter === "all" ? undefined : staffFilter);
  const appts = rows.map((r) => ({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString() }));

  return (
    <div>
      <PageHeader title="Calendar" description="Click an empty slot to book, or an appointment to edit it." />
      <CalendarView view={view} date={date} today={today} tz={tz} appts={appts} staffFilter={staffFilter} openHours={business.openingHours}
        newOnLoad={sp.new === "1"} defaultStaffId={mine?.id}
        data={{ services: options.services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents, active: s.active })), staff: options.staff.map((s) => ({ id: s.id, name: s.name, active: s.active })), links: options.links, customers, currency: business.currency, canDelete: can(role, "settings:manage") }} />
    </div>
  );
}
