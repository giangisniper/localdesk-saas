import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lt, notInArray, or, sql, count } from "drizzle-orm";
import { db } from "@/db";
import { activity, appointments, customerNotes, customers, services, staff, staffHours, staffServices, timeOff, users } from "@/db/schema";

export const apptSelect = {
  id: appointments.id,
  startsAt: appointments.startsAt,
  endsAt: appointments.endsAt,
  status: appointments.status,
  priceCents: appointments.priceCents,
  notes: appointments.notes,
  source: appointments.source,
  customerId: customers.id,
  customerName: customers.name,
  serviceId: services.id,
  serviceName: services.name,
  serviceColor: services.color,
  staffId: staff.id,
  staffName: staff.name,
  staffColor: staff.color,
};
export type ApptRow = {
  id: string; startsAt: Date; endsAt: Date; status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
  priceCents: number; notes: string; source: "dashboard" | "online"; customerId: string; customerName: string;
  serviceId: string; serviceName: string; serviceColor: string; staffId: string; staffName: string; staffColor: string;
};

function apptBase() {
  return db.select(apptSelect).from(appointments)
    .innerJoin(customers, eq(customers.id, appointments.customerId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(staff, eq(staff.id, appointments.staffId));
}

export function appointmentsInRange(businessId: string, start: Date, end: Date, staffId?: string) {
  return apptBase().where(and(
    eq(appointments.businessId, businessId), gte(appointments.startsAt, start), lt(appointments.startsAt, end),
    staffId ? eq(appointments.staffId, staffId) : undefined,
  )).orderBy(asc(appointments.startsAt)) as unknown as Promise<ApptRow[]>;
}

export function upcomingAppointments(businessId: string, limit = 6) {
  return apptBase().where(and(
    eq(appointments.businessId, businessId), gte(appointments.endsAt, new Date()), notInArray(appointments.status, ["cancelled", "no_show", "completed"]),
  )).orderBy(asc(appointments.startsAt)).limit(limit) as unknown as Promise<ApptRow[]>;
}

export interface ApptFilters { status?: string; staffId?: string; q?: string; from?: Date; to?: Date; page: number; pageSize: number; sort: "asc" | "desc" }
export async function searchAppointments(businessId: string, f: ApptFilters) {
  const where = and(
    eq(appointments.businessId, businessId),
    f.status ? eq(appointments.status, f.status as ApptRow["status"]) : undefined,
    f.staffId ? eq(appointments.staffId, f.staffId) : undefined,
    f.from ? gte(appointments.startsAt, f.from) : undefined,
    f.to ? lt(appointments.startsAt, f.to) : undefined,
    f.q ? or(ilike(customers.name, `%${f.q}%`), ilike(services.name, `%${f.q}%`)) : undefined,
  );
  const [rows, [total]] = await Promise.all([
    apptBase().where(where).orderBy(f.sort === "asc" ? asc(appointments.startsAt) : desc(appointments.startsAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize) as unknown as Promise<ApptRow[]>,
    db.select({ n: count() }).from(appointments)
      .innerJoin(customers, eq(customers.id, appointments.customerId))
      .innerJoin(services, eq(services.id, appointments.serviceId)).where(where),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export function recentActivity(businessId: string, limit = 8) {
  return db.select().from(activity).where(eq(activity.businessId, businessId)).orderBy(desc(activity.createdAt)).limit(limit);
}

export async function formOptions(businessId: string) {
  const [svc, st, links] = await Promise.all([
    db.select().from(services).where(eq(services.businessId, businessId)).orderBy(asc(services.category), asc(services.name)),
    db.select().from(staff).where(eq(staff.businessId, businessId)).orderBy(asc(staff.name)),
    db.select({ staffId: staffServices.staffId, serviceId: staffServices.serviceId }).from(staffServices)
      .innerJoin(staff, eq(staff.id, staffServices.staffId)).where(eq(staff.businessId, businessId)),
  ]);
  return { services: svc, staff: st, links };
}

export function customerOptions(businessId: string) {
  return db.select({ id: customers.id, name: customers.name, email: customers.email, phone: customers.phone })
    .from(customers).where(eq(customers.businessId, businessId)).orderBy(asc(customers.name));
}

export async function listCustomers(businessId: string, opts: { q?: string; tag?: string; sort: string; page: number; pageSize: number }) {
  const where = and(
    eq(customers.businessId, businessId),
    opts.q ? or(ilike(customers.name, `%${opts.q}%`), ilike(customers.email, `%${opts.q}%`), ilike(customers.phone, `%${opts.q}%`)) : undefined,
    opts.tag === "__none" ? sql`cardinality(${customers.tags}) = 0` : opts.tag ? sql`${opts.tag} = ANY(${customers.tags})` : undefined,
  );
  const stats = db.select({
    customerId: appointments.customerId,
    visits: sql<number>`count(*) filter (where ${appointments.status} = 'completed')`.as("visits"),
    spent: sql<number>`coalesce(sum(${appointments.priceCents}) filter (where ${appointments.status} = 'completed'), 0)`.as("spent"),
    lastVisit: sql<Date | null>`max(${appointments.startsAt}) filter (where ${appointments.status} = 'completed')`.as("last_visit"),
    nextVisit: sql<Date | null>`min(${appointments.startsAt}) filter (where ${appointments.startsAt} > now() and ${appointments.status} in ('scheduled','confirmed'))`.as("next_visit"),
  }).from(appointments).where(eq(appointments.businessId, businessId)).groupBy(appointments.customerId).as("st");
  const order = {
    name: asc(customers.name),
    recent: sql`${stats.lastVisit} desc nulls last`,
    spent: sql`${stats.spent} desc nulls last`,
    newest: desc(customers.createdAt),
  }[opts.sort] ?? asc(customers.name);
  const [rows, [total]] = await Promise.all([
    db.select({
      id: customers.id, name: customers.name, email: customers.email, phone: customers.phone, tags: customers.tags, createdAt: customers.createdAt,
      visits: sql<number>`coalesce(${stats.visits}, 0)`, spent: sql<number>`coalesce(${stats.spent}, 0)`, lastVisit: stats.lastVisit, nextVisit: stats.nextVisit,
    }).from(customers).leftJoin(stats, eq(stats.customerId, customers.id)).where(where).orderBy(order).limit(opts.pageSize).offset((opts.page - 1) * opts.pageSize),
    db.select({ n: count() }).from(customers).where(where),
  ]);
  return { rows: rows.map((r) => ({ ...r, visits: Number(r.visits), spent: Number(r.spent), lastVisit: r.lastVisit ? new Date(r.lastVisit) : null, nextVisit: r.nextVisit ? new Date(r.nextVisit) : null })), total: total?.n ?? 0 };
}

export async function customerTags(businessId: string) {
  const r = await db.execute(sql`SELECT DISTINCT unnest(tags) AS tag FROM customers WHERE business_id = ${businessId} ORDER BY 1`);
  return (r.rows as { tag: string }[]).map((x) => x.tag);
}

export async function customerDetail(businessId: string, id: string) {
  const [c] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, businessId)));
  if (!c) return null;
  const [history, notes] = await Promise.all([
    apptBase().where(and(eq(appointments.businessId, businessId), eq(appointments.customerId, id))).orderBy(desc(appointments.startsAt)) as unknown as Promise<ApptRow[]>,
    db.select({ id: customerNotes.id, body: customerNotes.body, createdAt: customerNotes.createdAt, author: users.name })
      .from(customerNotes).leftJoin(users, eq(users.id, customerNotes.authorId)).where(eq(customerNotes.customerId, id)).orderBy(desc(customerNotes.createdAt)),
  ]);
  return { customer: c, history, notes };
}

export async function staffWithDetails(businessId: string) {
  const members = await db.select().from(staff).where(eq(staff.businessId, businessId)).orderBy(asc(staff.name));
  const ids = members.map((m) => m.id);
  if (!ids.length) return [];
  const [hours, links, offs] = await Promise.all([
    db.select().from(staffHours).where(inArray(staffHours.staffId, ids)),
    db.select().from(staffServices).where(inArray(staffServices.staffId, ids)),
    db.select().from(timeOff).where(and(inArray(timeOff.staffId, ids), gte(timeOff.endsAt, new Date()))).orderBy(asc(timeOff.startsAt)),
  ]);
  return members.map((m) => ({
    ...m,
    hours: hours.filter((h) => h.staffId === m.id).map((h) => ({ weekday: h.weekday, startTime: h.startTime.slice(0, 5), endTime: h.endTime.slice(0, 5) })),
    serviceIds: links.filter((l) => l.staffId === m.id).map((l) => l.serviceId),
    timeOff: offs.filter((o) => o.staffId === m.id),
  }));
}
