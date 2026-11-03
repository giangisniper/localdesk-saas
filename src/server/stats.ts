import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { granularity, type DateRange } from "@/lib/range";
import { addDaysStr, zonedInstant } from "@/lib/time";

type Biz = { id: string; timezone: string };

function bounds(from: string, to: string, tz: string) {
  return { start: zonedInstant(from, "00:00", tz), end: zonedInstant(addDaysStr(to, 1), "00:00", tz) };
}

async function rows<T>(q: ReturnType<typeof sql>): Promise<T[]> {
  const r = await db.execute(q);
  return r.rows as T[];
}

const n = (v: unknown) => Number(v ?? 0);

async function periodTotals(b: Biz, from: string, to: string) {
  const { start, end } = bounds(from, to, b.timezone);
  const [r] = await rows<Record<string, string>>(sql`
    SELECT
      COALESCE(SUM(price_cents) FILTER (WHERE status = 'completed'), 0) AS revenue,
      COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) AS booked,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
      COUNT(*) FILTER (WHERE status = 'no_show') AS no_show,
      COUNT(*) AS total,
      COUNT(DISTINCT customer_id) FILTER (WHERE status NOT IN ('cancelled')) AS active_customers
    FROM appointments
    WHERE business_id = ${b.id} AND starts_at >= ${start} AND starts_at < ${end}`);
  const [c] = await rows<Record<string, string>>(sql`
    SELECT COUNT(*) AS new_customers FROM customers
    WHERE business_id = ${b.id} AND created_at >= ${start} AND created_at < ${end}`);
  const revenue = n(r?.revenue);
  const completed = n(r?.completed);
  return {
    revenue,
    booked: n(r?.booked),
    completed,
    cancelled: n(r?.cancelled),
    noShow: n(r?.no_show),
    total: n(r?.total),
    activeCustomers: n(r?.active_customers),
    newCustomers: n(c?.new_customers),
    avgTicket: completed ? Math.round(revenue / completed) : 0,
  };
}

export async function kpis(b: Biz, range: DateRange) {
  const [current, previous] = await Promise.all([
    periodTotals(b, range.from, range.to),
    periodTotals(b, range.prevFrom, range.prevTo),
  ]);
  return { current, previous };
}

/** Revenue / appointment time series bucketed by day, week or month in the business timezone. */
export async function timeSeries(b: Biz, range: DateRange) {
  const g = granularity(range.days);
  const { start, end } = bounds(range.from, range.to, b.timezone);
  const data = await rows<{ bucket: string; revenue: string; appointments: string; cancelled: string }>(sql`
    SELECT to_char(date_trunc(${sql.raw(`'${g}'`)}, starts_at AT TIME ZONE ${b.timezone}), 'YYYY-MM-DD') AS bucket,
      COALESCE(SUM(price_cents) FILTER (WHERE status = 'completed'), 0) AS revenue,
      COUNT(*) FILTER (WHERE status <> 'cancelled') AS appointments,
      COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
    FROM appointments
    WHERE business_id = ${b.id} AND starts_at >= ${start} AND starts_at < ${end}
    GROUP BY 1 ORDER BY 1`);
  // fill gaps so charts have continuous x axes
  const map = new Map(data.map((d) => [d.bucket, d]));
  const out: { bucket: string; revenue: number; appointments: number; cancelled: number }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < range.days; i++) {
    const day = addDaysStr(range.from, i);
    const key = bucketKey(day, g);
    if (seen.has(key)) continue;
    seen.add(key);
    const d = map.get(key);
    out.push({ bucket: key, revenue: n(d?.revenue) / 100, appointments: n(d?.appointments), cancelled: n(d?.cancelled) });
  }
  return { granularity: g, points: out };
}

function bucketKey(day: string, g: "day" | "week" | "month") {
  if (g === "day") return day;
  if (g === "month") return day.slice(0, 8) + "01";
  const d = new Date(day + "T00:00:00Z");
  const wd = (d.getUTCDay() + 6) % 7;
  return addDaysStr(day, -wd);
}

export async function popularServices(b: Biz, range: DateRange) {
  const { start, end } = bounds(range.from, range.to, b.timezone);
  const r = await rows<{ name: string; color: string; count: string; revenue: string }>(sql`
    SELECT s.name, s.color, COUNT(*) AS count,
      COALESCE(SUM(a.price_cents) FILTER (WHERE a.status = 'completed'), 0) AS revenue
    FROM appointments a JOIN services s ON s.id = a.service_id
    WHERE a.business_id = ${b.id} AND a.starts_at >= ${start} AND a.starts_at < ${end} AND a.status <> 'cancelled'
    GROUP BY s.id ORDER BY count DESC LIMIT 8`);
  return r.map((x) => ({ name: x.name, color: x.color, count: n(x.count), revenue: n(x.revenue) / 100 }));
}

export async function staffPerformance(b: Biz, range: DateRange) {
  const { start, end } = bounds(range.from, range.to, b.timezone);
  const r = await rows<{ name: string; color: string; count: string; revenue: string; minutes: string }>(sql`
    SELECT st.name, st.color, COUNT(*) AS count,
      COALESCE(SUM(a.price_cents) FILTER (WHERE a.status = 'completed'), 0) AS revenue,
      COALESCE(SUM(EXTRACT(EPOCH FROM (a.ends_at - a.starts_at)) / 60), 0) AS minutes
    FROM appointments a JOIN staff st ON st.id = a.staff_id
    WHERE a.business_id = ${b.id} AND a.starts_at >= ${start} AND a.starts_at < ${end} AND a.status NOT IN ('cancelled', 'no_show')
    GROUP BY st.id ORDER BY revenue DESC`);
  return r.map((x) => ({ name: x.name, color: x.color, count: n(x.count), revenue: n(x.revenue) / 100, hours: Math.round(n(x.minutes) / 6) / 10 }));
}

export async function byWeekday(b: Biz, range: DateRange) {
  const { start, end } = bounds(range.from, range.to, b.timezone);
  const r = await rows<{ dow: string; count: string }>(sql`
    SELECT EXTRACT(ISODOW FROM starts_at AT TIME ZONE ${b.timezone}) AS dow, COUNT(*) AS count
    FROM appointments WHERE business_id = ${b.id} AND starts_at >= ${start} AND starts_at < ${end} AND status NOT IN ('cancelled')
    GROUP BY 1`);
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names.map((name, i) => ({ name, count: n(r.find((x) => n(x.dow) === i + 1)?.count) }));
}

export async function byHour(b: Biz, range: DateRange) {
  const { start, end } = bounds(range.from, range.to, b.timezone);
  const r = await rows<{ h: string; count: string }>(sql`
    SELECT EXTRACT(HOUR FROM starts_at AT TIME ZONE ${b.timezone}) AS h, COUNT(*) AS count
    FROM appointments WHERE business_id = ${b.id} AND starts_at >= ${start} AND starts_at < ${end} AND status NOT IN ('cancelled')
    GROUP BY 1 ORDER BY 1`);
  return r.map((x) => ({ name: `${String(n(x.h)).padStart(2, "0")}:00`, count: n(x.count) }));
}

export async function statusBreakdown(b: Biz, range: DateRange) {
  const { start, end } = bounds(range.from, range.to, b.timezone);
  const r = await rows<{ status: string; count: string }>(sql`
    SELECT status, COUNT(*) AS count FROM appointments
    WHERE business_id = ${b.id} AND starts_at >= ${start} AND starts_at < ${end} GROUP BY status`);
  return r.map((x) => ({ status: x.status, count: n(x.count) }));
}

/** New vs returning customers per month + repeat rate. A customer is "returning" in a period
 * if they had a (non-cancelled) appointment earlier than that period. */
export async function retention(b: Biz, range: DateRange) {
  const { start, end } = bounds(range.from, range.to, b.timezone);
  const monthly = await rows<{ month: string; new_c: string; returning_c: string }>(sql`
    WITH appts AS (
      SELECT customer_id, starts_at,
        MIN(starts_at) OVER (PARTITION BY customer_id) AS first_at
      FROM appointments WHERE business_id = ${b.id} AND status NOT IN ('cancelled')
    )
    SELECT to_char(date_trunc('month', starts_at AT TIME ZONE ${b.timezone}), 'YYYY-MM-01') AS month,
      COUNT(DISTINCT customer_id) FILTER (WHERE date_trunc('month', first_at AT TIME ZONE ${b.timezone}) = date_trunc('month', starts_at AT TIME ZONE ${b.timezone})) AS new_c,
      COUNT(DISTINCT customer_id) FILTER (WHERE date_trunc('month', first_at AT TIME ZONE ${b.timezone}) < date_trunc('month', starts_at AT TIME ZONE ${b.timezone})) AS returning_c
    FROM appts WHERE starts_at >= ${start} AND starts_at < ${end}
    GROUP BY 1 ORDER BY 1`);
  const [t] = await rows<{ customers: string; repeat: string; lapsed: string }>(sql`
    WITH c AS (
      SELECT customer_id, COUNT(*) FILTER (WHERE status IN ('completed')) AS visits, MAX(starts_at) AS last_at
      FROM appointments WHERE business_id = ${b.id} AND status NOT IN ('cancelled') GROUP BY customer_id
    )
    SELECT COUNT(*) FILTER (WHERE visits >= 1) AS customers,
      COUNT(*) FILTER (WHERE visits >= 2) AS repeat,
      COUNT(*) FILTER (WHERE last_at < now() - interval '60 days') AS lapsed
    FROM c`);
  const total = n(t?.customers);
  return {
    monthly: monthly.map((m) => ({ month: m.month, new: n(m.new_c), returning: n(m.returning_c) })),
    repeatRate: total ? Math.round((n(t?.repeat) / total) * 100) : 0,
    customersWithVisits: total,
    lapsed: n(t?.lapsed),
  };
}

export async function topCustomers(b: Biz, limit = 5) {
  const r = await rows<{ id: string; name: string; visits: string; spent: string }>(sql`
    SELECT c.id, c.name, COUNT(*) AS visits, COALESCE(SUM(a.price_cents), 0) AS spent
    FROM appointments a JOIN customers c ON c.id = a.customer_id
    WHERE a.business_id = ${b.id} AND a.status = 'completed'
    GROUP BY c.id ORDER BY spent DESC LIMIT ${limit}`);
  return r.map((x) => ({ id: x.id, name: x.name, visits: n(x.visits), spent: n(x.spent) }));
}
