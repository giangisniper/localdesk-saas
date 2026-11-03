"use client";
import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarSearch } from "lucide-react";
import { AppointmentDialog, type Draft, type FormData_ } from "@/components/appointment-dialog";
import { Card, EmptyState, StatusBadge } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

export interface Row {
  id: string; startsAt: string; endsAt: string; status: string; priceCents: number; notes: string; source: string;
  customerId: string; customerName: string; serviceId: string; serviceName: string; serviceColor: string; staffId: string; staffName: string;
}

export function AppointmentsTable({ rows, tz, currency, data }: { rows: Row[]; tz: string; currency: string; data: FormData_ }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  if (rows.length === 0)
    return <Card><EmptyState icon={<CalendarSearch className="size-5" />} title="No appointments match" description="Try adjusting your filters or search term." /></Card>;
  const open = (a: Row) => setDraft({ id: a.id, customerId: a.customerId, serviceId: a.serviceId, staffId: a.staffId, status: a.status, notes: a.notes, priceCents: a.priceCents,
    date: formatInTimeZone(a.startsAt, tz, "yyyy-MM-dd"), time: formatInTimeZone(a.startsAt, tz, "HH:mm") });
  return (
    <>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr><th className="px-4 py-2.5 font-medium">When</th><th className="px-4 py-2.5 font-medium">Customer</th><th className="px-4 py-2.5 font-medium">Service</th><th className="px-4 py-2.5 font-medium">Staff</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 text-right font-medium">Price</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((a) => (
                <tr key={a.id} className="group cursor-pointer hover:bg-ink-50" onClick={() => open(a)}>
                  <td className="whitespace-nowrap px-4 py-3 tabular">
                    <button className="text-left font-medium group-hover:text-brand-700" aria-label={`Edit appointment for ${a.customerName}`} onClick={(e) => { e.stopPropagation(); open(a); }}>{formatInTimeZone(a.startsAt, tz, "EEE d MMM")}</button>
                    <span className="ml-2 text-ink-500">{formatInTimeZone(a.startsAt, tz, "HH:mm")}–{formatInTimeZone(a.endsAt, tz, "HH:mm")}</span>
                  </td>
                  <td className="px-4 py-3 font-medium">{a.customerName}</td>
                  <td className="px-4 py-3"><span className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: a.serviceColor }} />{a.serviceName}</td>
                  <td className="px-4 py-3 text-ink-600">{a.staffName}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-right tabular">{formatMoney(a.priceCents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <AppointmentDialog draft={draft} onClose={() => setDraft(null)} data={data} />
    </>
  );
}
