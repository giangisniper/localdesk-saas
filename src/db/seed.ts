import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import * as s from "./schema";
import { addDaysStr, todayIn, weekdayOf, zonedInstant } from "../lib/time";

const TZ = "Europe/Rome";
export const DEMO_PASSWORD = "LocalDesk2026!";

// deterministic PRNG so the demo data is reproducible
let seed = 20260611;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
const weighted = <T,>(a: [T, number][]) => {
  const total = a.reduce((x, [, w]) => x + w, 0);
  let r = rnd() * total;
  for (const [v, w] of a) if ((r -= w) <= 0) return v;
  return a[0]![0];
};

const FIRST = ["Giulia","Marco","Sofia","Luca","Chiara","Alessandro","Elena","Matteo","Francesca","Davide","Martina","Andrea","Sara","Federico","Valentina","Simone","Alice","Lorenzo","Beatrice","Gabriele","Anna","Riccardo","Ilaria","Tommaso","Camilla","Emma","Paolo","Laura","Nicola","Silvia","Claire","James","Hannah","Daniel","Maria","Pedro","Nina","Oliver","Julia","Thomas"];
const LAST = ["Rossi","Bianchi","Romano","Colombo","Ricci","Marino","Greco","Bruno","Gallo","Conti","De Luca","Mancini","Costa","Giordano","Rizzo","Lombardi","Moretti","Barbieri","Fontana","Santoro","Mariani","Rinaldi","Caruso","Ferrara","Galli","Martini","Leone","Longo","Gentile","Villa"];
const NOTES = ["Prefers morning appointments.","Allergic to ammonia-based colour — use alternative.","Likes a quiet chair, no small talk.","Bring inspiration photos next time.","Referred by a friend — send a thank-you.","Sensitive scalp, gentle products only.","Usually runs 5 minutes late.","Wants to try a balayage next season."];

async function main() {
  const [existing] = await db.select().from(s.businesses).where(eq(s.businesses.slug, "studio-luna"));
  if (existing) await db.delete(s.businesses).where(eq(s.businesses.id, existing.id));
  await db.delete(s.users).where(eq(s.users.email, "owner@demo.localdesk.app"));
  await db.delete(s.users).where(eq(s.users.email, "manager@demo.localdesk.app"));
  await db.delete(s.users).where(eq(s.users.email, "staff@demo.localdesk.app"));

  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const [owner, manager, staffUser] = await db.insert(s.users).values([
    { name: "Giulia Ferrante", email: "owner@demo.localdesk.app", passwordHash: hash },
    { name: "Marco Villa", email: "manager@demo.localdesk.app", passwordHash: hash },
    { name: "Elena Sartori", email: "staff@demo.localdesk.app", passwordHash: hash },
  ]).returning();

  const weekHours = (close = "19:00"): s.OpeningHours => ({
    "1": [{ open: "09:00", close }], "2": [{ open: "09:00", close }], "3": [{ open: "09:00", close }],
    "4": [{ open: "09:00", close }], "5": [{ open: "09:00", close }], "6": [{ open: "09:00", close: "17:00" }],
  });
  const [biz] = await db.insert(s.businesses).values({
    name: "Studio Luna", slug: "studio-luna", category: "Hair & Beauty",
    description: "Independent hair and beauty studio in the heart of Milan. Cuts, colour and treatments by appointment.",
    email: "hello@studioluna.example", phone: "+39 02 5550 0142", address: "Via Tortona 18, 20144 Milano MI",
    timezone: TZ, currency: "EUR", slotIntervalMin: 15, minNoticeHours: 2, maxAdvanceDays: 60, cancellationHours: 24, bufferMin: 0,
    openingHours: weekHours(), onboardedAt: new Date(),
  }).returning();
  const businessId = biz!.id;
  await db.insert(s.memberships).values([
    { userId: owner!.id, businessId, role: "owner" },
    { userId: manager!.id, businessId, role: "admin" },
    { userId: staffUser!.id, businessId, role: "staff" },
  ]);

  const staffRows = await db.insert(s.staff).values([
    { businessId, name: "Giulia Ferrante", title: "Founder · Colour specialist", email: "giulia@studioluna.example", color: "#0d9488", userId: owner!.id },
    { businessId, name: "Elena Sartori", title: "Senior stylist", email: "elena@studioluna.example", color: "#7c3aed", userId: staffUser!.id },
    { businessId, name: "Tommaso Greco", title: "Barber", email: "tommaso@studioluna.example", color: "#ea580c" },
    { businessId, name: "Nina Petrova", title: "Beauty therapist", email: "nina@studioluna.example", color: "#db2777" },
  ]).returning();
  const [giulia, elena, tommaso, nina] = staffRows as [typeof staffRows[0], typeof staffRows[0], typeof staffRows[0], typeof staffRows[0]];

  const svc = await db.insert(s.services).values([
    { businessId, name: "Women's Cut & Style", category: "Hair", durationMin: 60, priceCents: 5500, color: "#0d9488", description: "Consultation, wash, precision cut and blow-dry." },
    { businessId, name: "Men's Cut", category: "Hair", durationMin: 30, priceCents: 2800, color: "#ea580c", description: "Classic or modern cut, finished with styling." },
    { businessId, name: "Beard Trim", category: "Hair", durationMin: 20, priceCents: 1500, color: "#f59e0b", description: "Shape, trim and hot-towel finish." },
    { businessId, name: "Full Colour", category: "Colour", durationMin: 120, priceCents: 9500, color: "#7c3aed", description: "Single-process colour with gloss and treatment." },
    { businessId, name: "Balayage", category: "Colour", durationMin: 180, priceCents: 16000, color: "#8b5cf6", description: "Hand-painted highlights for a natural, sun-kissed look." },
    { businessId, name: "Root Touch-up", category: "Colour", durationMin: 75, priceCents: 6500, color: "#6366f1", description: "Regrowth coverage with gloss." },
    { businessId, name: "Keratin Treatment", category: "Treatments", durationMin: 150, priceCents: 14000, color: "#0891b2", description: "Smoothing treatment that lasts up to 3 months." },
    { businessId, name: "Express Facial", category: "Beauty", durationMin: 45, priceCents: 4800, color: "#db2777", description: "Cleanse, exfoliate and hydrating mask." },
    { businessId, name: "Manicure", category: "Beauty", durationMin: 45, priceCents: 3500, color: "#e11d48", description: "Shape, cuticle care and polish." },
    { businessId, name: "Bridal Trial", category: "Events", durationMin: 90, priceCents: 8500, color: "#be185d", description: "Hair and makeup trial for your wedding day.", bookableOnline: false },
  ]).returning();
  const S = Object.fromEntries(svc.map((x) => [x.name, x]));
  const roster: [typeof giulia, string[]][] = [
    [giulia, ["Women's Cut & Style", "Full Colour", "Balayage", "Root Touch-up", "Keratin Treatment", "Bridal Trial"]],
    [elena, ["Women's Cut & Style", "Men's Cut", "Full Colour", "Root Touch-up", "Keratin Treatment", "Bridal Trial"]],
    [tommaso, ["Men's Cut", "Beard Trim"]],
    [nina, ["Express Facial", "Manicure", "Bridal Trial"]],
  ];
  await db.insert(s.staffServices).values(roster.flatMap(([st, names]) => names.map((n) => ({ staffId: st.id, serviceId: S[n]!.id }))));

  // Working hours (weekday 0=Sun)
  const hoursFor: Record<string, number[]> = {
    [giulia.id]: [2, 3, 4, 5, 6], [elena.id]: [1, 2, 3, 4, 5], [tommaso.id]: [2, 3, 4, 5, 6], [nina.id]: [1, 3, 4, 5],
  };
  await db.insert(s.staffHours).values(
    staffRows.flatMap((st) => hoursFor[st.id]!.flatMap((wd) =>
      wd === 6 ? [{ staffId: st.id, weekday: wd, startTime: "09:00", endTime: "17:00" }]
        : [{ staffId: st.id, weekday: wd, startTime: "09:00", endTime: "13:00" }, { staffId: st.id, weekday: wd, startTime: "14:00", endTime: "19:00" }])),
  );

  const today = todayIn(TZ);
  await db.insert(s.timeOff).values({
    staffId: nina.id, startsAt: zonedInstant(addDaysStr(today, 12), "00:00", TZ), endsAt: zonedInstant(addDaysStr(today, 17), "00:00", TZ), reason: "Holiday",
  });

  // Customers: created progressively over the last ~14 months
  const customerValues: (typeof s.customers.$inferInsert)[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 90; i++) {
    let name: string;
    do name = `${pick(FIRST)} ${pick(LAST)}`; while (used.has(name));
    used.add(name);
    const created = zonedInstant(addDaysStr(today, -Math.floor(rnd() * rnd() * 420) - 1), "10:00", TZ);
    customerValues.push({
      businessId, name, createdAt: created,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
      phone: `+39 3${Math.floor(rnd() * 90 + 10)} ${Math.floor(rnd() * 900 + 100)} ${Math.floor(rnd() * 9000 + 1000)}`,
      tags: rnd() < 0.2 ? ["VIP"] : rnd() < 0.15 ? ["Colour client"] : [],
      marketingOptIn: rnd() < 0.6,
    });
  }
  customerValues.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
  const customers = await db.insert(s.customers).values(customerValues).returning();
  // Each customer has a loyalty weight: some are regulars
  const loyalty = customers.map(() => weighted([[1, 5], [3, 3], [8, 1.5]]));

  const noteRows = customers.filter(() => rnd() < 0.3).map((c) => ({
    customerId: c.id, authorId: owner!.id, body: pick(NOTES), createdAt: new Date(c.createdAt.getTime() + 86400_000 * 3),
  }));
  if (noteRows.length) await db.insert(s.customerNotes).values(noteRows);

  // Appointments: simulate each staff's day
  const nowMs = Date.now();
  const appts: (typeof s.appointments.$inferInsert)[] = [];
  for (let d = -330; d <= 21; d++) {
    const date = addDaysStr(today, d);
    const wd = weekdayOf(date);
    const growth = 0.55 + 0.45 * Math.min(1, (d + 330) / 330); // business grows through the year
    for (const st of staffRows) {
      if (!hoursFor[st.id]!.includes(wd)) continue;
      if (st.id === nina.id && d >= 12 && d < 17) continue;
      const allowed = roster.find(([x]) => x.id === st.id)![1].map((n) => S[n]!);
      const windows: [number, number][] = wd === 6 ? [[540, 1020]] : [[540, 780], [840, 1140]];
      for (const [ws, we] of windows) {
        let cursor = ws + Math.floor(rnd() * 3) * 15;
        while (cursor < we) {
          if (rnd() > 0.72 * growth * (d > 0 ? Math.max(0.35, 1 - d / 28) : 1)) { cursor += 30; continue; }
          const service = weighted(allowed.map((x) => [x, x.durationMin > 100 ? 0.8 : 2] as [typeof x, number]));
          if (cursor + service.durationMin > we) break;
          const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
          const startsAt = zonedInstant(date, hh(cursor), TZ);
          const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
          // pick a customer who already existed
          let c = customers[Math.floor(rnd() * customers.length)]!;
          for (let t = 0; t < 12; t++) {
            const cand = customers[Math.floor(rnd() * customers.length)]!;
            if (cand.createdAt.getTime() <= startsAt.getTime() + 86400_000 * 2 && rnd() < loyalty[customers.indexOf(cand)]! / 8 + 0.15) { c = cand; break; }
          }
          if (c.createdAt.getTime() > startsAt.getTime() + 86400_000 * 2) { cursor += 30; continue; }
          let status: s.AppointmentStatus;
          if (endsAt.getTime() < nowMs) status = weighted([["completed", 88], ["cancelled", 8], ["no_show", 4]]);
          else status = weighted([["scheduled", 3], ["confirmed", 6], ["cancelled", 0.6]]);
          const priceJitter = service.priceCents;
          appts.push({
            businessId, customerId: c.id, staffId: st.id, serviceId: service.id, startsAt, endsAt, status, priceCents: priceJitter,
            source: rnd() < 0.35 ? "online" : "dashboard",
            cancelledAt: status === "cancelled" ? new Date(startsAt.getTime() - 86400_000) : null,
            createdAt: new Date(startsAt.getTime() - 86400_000 * (2 + Math.floor(rnd() * 10))),
          });
          cursor += service.durationMin + (rnd() < 0.5 ? 0 : 15);
        }
      }
    }
  }
  for (let i = 0; i < appts.length; i += 500) await db.insert(s.appointments).values(appts.slice(i, i + 500));

  // Recent activity feed
  const recent = await db.select({ a: s.appointments, c: s.customers.name, sv: s.services.name, st: s.staff.name })
    .from(s.appointments)
    .innerJoin(s.customers, eq(s.customers.id, s.appointments.customerId))
    .innerJoin(s.services, eq(s.services.id, s.appointments.serviceId))
    .innerJoin(s.staff, eq(s.staff.id, s.appointments.staffId))
    .where(eq(s.appointments.businessId, businessId));
  const sample = recent.filter((r) => r.a.startsAt.getTime() > nowMs - 86400_000 * 4 && r.a.startsAt.getTime() < nowMs + 86400_000 * 10).slice(0, 14);
  await db.insert(s.activity).values(sample.map((r, i) => ({
    businessId,
    type: r.a.source === "online" ? "appointment.online" : "appointment.created",
    message: r.a.status === "cancelled" ? `${r.c} cancelled ${r.sv}` : `${r.c} booked ${r.sv} with ${r.st}`,
    actor: r.a.source === "online" ? "Online booking" : "Giulia Ferrante",
    createdAt: new Date(nowMs - i * 3600_000 * (1 + rnd() * 5)),
  })));

  console.log(`✔ seeded Studio Luna: ${customers.length} customers, ${appts.length} appointments`);
  console.log(`  owner@demo.localdesk.app / manager@demo.localdesk.app / staff@demo.localdesk.app  →  ${DEMO_PASSWORD}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
