"use client";
import { useRouter, usePathname } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button, Select } from "@/components/ui";
import { AppointmentDialog, type Draft, type FormData_ } from "@/components/appointment-dialog";
import { addDaysStr, localDateOf, localMinutes, monthStart, weekStart, weekdayOf } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface CalAppt {
  id: string; startsAt: string; endsAt: string; status: string; priceCents: number; notes: string;
  customerId: string; customerName: string; serviceId: string; serviceName: string; serviceColor: string; staffId: string; staffName: string; staffColor: string;
}
type View = "day" | "week" | "month";
const HOUR_PX = 56;

function layout(items: CalAppt[], tz: string) {
  // lane assignment for overlapping events inside one column
  const sorted = [...items].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const out: { a: CalAppt; lane: number; lanes: number }[] = [];
  let group: typeof out = [];
  let groupEnd = 0;
  const flush = () => { const n = Math.max(1, ...group.map((g) => g.lane + 1)); group.forEach((g) => (g.lanes = n)); out.push(...group); group = []; };
  const laneEnds: number[] = [];
  for (const a of sorted) {
    const s = +new Date(a.startsAt);
    if (group.length && s >= groupEnd) { flush(); laneEnds.length = 0; }
    let lane = laneEnds.findIndex((e) => e <= s);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = +new Date(a.endsAt);
    group.push({ a, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, +new Date(a.endsAt));
  }
  flush();
  void tz;
  return out;
}

export function CalendarView({ view, date, today, tz, appts, data, staffFilter, openHours, newOnLoad, defaultStaffId }: {
  view: View; date: string; today: string; tz: string; appts: CalAppt[]; data: FormData_; staffFilter: string;
  openHours: Record<string, { open: string; close: string }[]>; newOnLoad: boolean; defaultStaffId?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const [draft, setDraft] = useState<Draft | null>(newOnLoad ? { date: today, time: "10:00", staffId: defaultStaffId } : null);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);

  const nav = (params: Partial<{ view: string; date: string; staff: string }>) => {
    const q = new URLSearchParams({ view, date, staff: staffFilter, ...params });
    if (q.get("staff") === "all") q.delete("staff");
    router.push(`${path}?${q.toString()}`);
  };
  const step = (dir: 1 | -1) => {
    if (view === "day") nav({ date: addDaysStr(date, dir) });
    else if (view === "week") nav({ date: addDaysStr(date, 7 * dir) });
    else nav({ date: format(addMonths(parseISO(date), dir), "yyyy-MM-01") });
  };

  const title = view === "day" ? format(parseISO(date), "EEEE d MMMM yyyy")
    : view === "week" ? `${format(parseISO(weekStart(date)), "d MMM")} – ${format(parseISO(addDaysStr(weekStart(date), 6)), "d MMM yyyy")}`
    : format(parseISO(date), "MMMM yyyy");

  const openDraft = (d: Partial<Draft> & { date: string; time: string }) => setDraft({ staffId: staffFilter !== "all" ? staffFilter : defaultStaffId, ...d });
  const editDraft = (a: CalAppt) => setDraft({
    id: a.id, customerId: a.customerId, serviceId: a.serviceId, staffId: a.staffId, status: a.status, notes: a.notes, priceCents: a.priceCents,
    date: localDateOf(a.startsAt, tz), time: formatInTimeZone(a.startsAt, tz, "HH:mm"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => nav({ date: today })}>Today</Button>
          <Button variant="ghost" size="sm" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft className="size-4" /></Button>
          <Button variant="ghost" size="sm" aria-label="Next" onClick={() => step(1)}><ChevronRight className="size-4" /></Button>
        </div>
        <h2 className="min-w-0 flex-1 text-lg font-semibold tracking-tight" aria-live="polite">{title}</h2>
        <Select aria-label="Filter by staff" value={staffFilter} onChange={(e) => nav({ staff: e.target.value })} className="w-40">
          <option value="all">All staff</option>
          {data.staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <div role="group" aria-label="Calendar view" className="inline-flex rounded-lg bg-ink-200/60 p-0.5">
          {(["day", "week", "month"] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => nav({ view: v })} className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium capitalize", view === v ? "bg-white shadow-card" : "text-ink-600 hover:text-ink-900")}>{v}</button>
          ))}
        </div>
        <Button onClick={() => openDraft({ date: view === "month" ? today : date, time: "10:00" })}><Plus className="size-4" />New</Button>
      </div>

      {view === "month" ? (
        <MonthGrid date={date} today={today} tz={tz} appts={appts} openHours={openHours} onDay={(d) => nav({ view: "day", date: d })} onAppt={editDraft} />
      ) : (
        <TimeGrid view={view} date={date} today={today} tz={tz} appts={appts} data={data} staffFilter={staffFilter} openHours={openHours} now={now}
          onSlot={(d, time, staffId) => openDraft({ date: d, time, staffId })} onAppt={editDraft} onDayClick={(d) => nav({ view: "day", date: d })} />
      )}
      <AppointmentDialog draft={draft} onClose={() => setDraft(null)} data={data} />
    </div>
  );
}

function hourRange(openHours: Record<string, { open: string; close: string }[]>, appts: CalAppt[], tz: string) {
  let min = 24 * 60, max = 0;
  for (const ws of Object.values(openHours)) for (const w of ws) {
    const [oh, om] = w.open.split(":").map(Number); const [ch, cm] = w.close.split(":").map(Number);
    min = Math.min(min, oh! * 60 + om!); max = Math.max(max, ch! * 60 + cm!);
  }
  for (const a of appts) { min = Math.min(min, localMinutes(a.startsAt, tz)); max = Math.max(max, localMinutes(a.endsAt, tz) || 24 * 60); }
  if (min >= max) { min = 8 * 60; max = 19 * 60; }
  return { start: Math.floor(min / 60), end: Math.min(24, Math.ceil(max / 60)) };
}

function TimeGrid({ view, date, today, tz, appts, data, staffFilter, openHours, now, onSlot, onAppt, onDayClick }: {
  view: "day" | "week"; date: string; today: string; tz: string; appts: CalAppt[]; data: FormData_; staffFilter: string;
  openHours: Record<string, { open: string; close: string }[]>; now: Date | null;
  onSlot: (date: string, time: string, staffId?: string) => void; onAppt: (a: CalAppt) => void; onDayClick: (d: string) => void;
}) {
  const { start, end } = useMemo(() => hourRange(openHours, appts, tz), [openHours, appts, tz]);
  const hours = Array.from({ length: end - start }, (_, i) => start + i);
  // columns: one per day (week) or one per staff member (day)
  const columns = view === "week"
    ? Array.from({ length: 7 }, (_, i) => { const d = addDaysStr(weekStart(date), i); return { key: d, date: d, label: format(parseISO(d), "EEE"), sub: format(parseISO(d), "d"), staffId: undefined as string | undefined, items: appts.filter((a) => localDateOf(a.startsAt, tz) === d) }; })
    : (staffFilter === "all" ? data.staff.filter((s) => s.active) : data.staff.filter((s) => s.id === staffFilter)).map((s) => ({ key: s.id, date, label: s.name, sub: "", staffId: s.id as string | undefined, items: appts.filter((a) => a.staffId === s.id) }));

  const nowMin = now && localDateOf(now, tz) === today ? localMinutes(now, tz) : null;
  const colsMinWidth = view === "week" ? 7 * 110 : Math.max(1, columns.length) * 160;

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-card">
      <div className="overflow-x-auto scroll-thin">
        <div style={{ minWidth: colsMinWidth + 56 }}>
          <div className="sticky top-0 z-10 grid border-b border-ink-100 bg-white" style={{ gridTemplateColumns: `56px repeat(${columns.length}, 1fr)` }}>
            <div />
            {columns.map((c) => (
              <button key={c.key} onClick={() => view === "week" && onDayClick(c.date)} className={cn("border-l border-ink-100 px-2 py-2 text-center", view === "week" && "hover:bg-ink-50")}>
                <span className="block text-xs font-medium uppercase tracking-wide text-ink-500">{c.label}</span>
                {c.sub && <span className={cn("mx-auto mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold", c.date === today && "bg-brand-600 text-white")}>{c.sub}</span>}
              </button>
            ))}
          </div>
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${columns.length}, 1fr)`, height: hours.length * HOUR_PX }}>
            <div className="relative">
              {hours.map((h, i) => <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] tabular text-ink-400" style={{ top: i * HOUR_PX, display: i === 0 ? "none" : undefined }}>{String(h).padStart(2, "0")}:00</span>)}
            </div>
            {columns.map((c) => {
              const closed = !(openHours[String(weekdayOf(c.date))]?.length);
              return (
                <div key={c.key} className={cn("relative border-l border-ink-100", closed && "bg-ink-50")}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const min = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 4) * 15 + start * 60;
                    onSlot(c.date, `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`, c.staffId);
                  }}>
                  {hours.map((h, i) => <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-ink-100" style={{ top: i * HOUR_PX }} />)}
                  {layout(c.items, tz).map(({ a, lane, lanes }) => {
                    const s = localMinutes(a.startsAt, tz); const e = Math.max(s + 15, localMinutes(a.endsAt, tz) || 24 * 60);
                    const top = ((s - start * 60) / 60) * HOUR_PX; const h = ((e - s) / 60) * HOUR_PX;
                    const faded = a.status === "cancelled" || a.status === "no_show";
                    return (
                      <button key={a.id} onClick={(ev) => { ev.stopPropagation(); onAppt(a); }}
                        className={cn("absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-xs shadow-sm transition-shadow hover:shadow-md focus-visible:z-10", faded && "opacity-50 line-through")}
                        style={{ top, height: Math.max(h - 2, 18), left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`, borderColor: a.serviceColor, background: `${a.serviceColor}1f` }}
                        aria-label={`${a.customerName}, ${a.serviceName}, ${formatInTimeZone(a.startsAt, tz, "HH:mm")} with ${a.staffName}, ${a.status}`}>
                        <span className="block truncate font-semibold text-ink-900">{a.customerName}</span>
                        {h > 34 && <span className="block truncate text-ink-600">{formatInTimeZone(a.startsAt, tz, "HH:mm")} · {a.serviceName}</span>}
                        {h > 50 && view === "week" && <span className="block truncate text-ink-500">{a.staffName}</span>}
                      </button>
                    );
                  })}
                  {nowMin != null && c.date === today && nowMin >= start * 60 && nowMin <= end * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: ((nowMin - start * 60) / 60) * HOUR_PX }}>
                      <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-red-500" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {columns.length === 0 && <p className="p-8 text-center text-sm text-ink-500">No active staff to show.</p>}
    </div>
  );
}

function MonthGrid({ date, today, tz, appts, openHours, onDay, onAppt }: {
  date: string; today: string; tz: string; appts: CalAppt[]; openHours: Record<string, { open: string; close: string }[]>; onDay: (d: string) => void; onAppt: (a: CalAppt) => void;
}) {
  const first = monthStart(date);
  const gridStart = weekStart(first);
  const days = Array.from({ length: 42 }, (_, i) => addDaysStr(gridStart, i));
  const rows = days[35]!.slice(0, 7) === first.slice(0, 7) ? 6 : 5;
  const byDay = useMemo(() => {
    const m = new Map<string, CalAppt[]>();
    for (const a of appts) { const d = localDateOf(a.startsAt, tz); m.set(d, [...(m.get(d) ?? []), a]); }
    return m;
  }, [appts, tz]);
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-card">
      <div className="overflow-x-auto"><div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-ink-100">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-ink-500">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.slice(0, rows * 7).map((d) => {
            const items = byDay.get(d) ?? [];
            const inMonth = d.slice(0, 7) === first.slice(0, 7);
            const closed = !(openHours[String(weekdayOf(d))]?.length);
            return (
              <div key={d} className={cn("min-h-28 border-b border-l border-ink-100 p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0", !inMonth && "bg-ink-50/70", closed && inMonth && "bg-ink-50")}>
                <button onClick={() => onDay(d)} className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold hover:bg-ink-100", d === today && "bg-brand-600 text-white hover:bg-brand-700", !inMonth && d !== today && "text-ink-400")} aria-label={`Open ${d}`}>{Number(d.slice(8))}</button>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((a) => (
                    <button key={a.id} onClick={() => onAppt(a)} className={cn("flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:bg-ink-100", (a.status === "cancelled" || a.status === "no_show") && "opacity-50 line-through")}>
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: a.serviceColor }} />
                      <span className="tabular text-ink-500">{formatInTimeZone(a.startsAt, tz, "HH:mm")}</span>
                      <span className="truncate font-medium">{a.customerName}</span>
                    </button>
                  ))}
                  {items.length > 3 && <button onClick={() => onDay(d)} className="px-1 text-[11px] font-medium text-brand-700 hover:underline">+{items.length - 3} more</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div></div>
    </div>
  );
}

