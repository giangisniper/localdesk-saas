import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, CalendarPlus } from "lucide-react";
import { z } from "zod";
import { requireCtx } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { customerDetail } from "@/server/queries";
import { Avatar, Badge, Card, CardHeader, EmptyState, StatusBadge } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { CustomerDialogButton, NotesPanel } from "@/components/customer-forms";
import { fmtDate, fmtTime } from "@/lib/time";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { business, role } = await requireCtx("customers:view");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const d = await customerDetail(business.id, id);
  if (!d) notFound();
  const { customer: c, history, notes } = d;
  const tz = business.timezone;
  const now = new Date();
  const completed = history.filter((h) => h.status === "completed");
  const spent = completed.reduce((a, h) => a + h.priceCents, 0);
  const upcoming = history.filter((h) => h.startsAt > now && ["scheduled", "confirmed"].includes(h.status)).reverse();
  const missed = history.filter((h) => h.status === "no_show" || h.status === "cancelled").length;
  const favourite = Object.entries(completed.reduce<Record<string, number>>((m, h) => ({ ...m, [h.serviceName]: (m[h.serviceName] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0];
  const canManage = can(role, "customers:manage");

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" />All customers</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={c.name} size={56} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
              {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-brand-700"><Mail className="size-4" />{c.email}</a>}
              {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand-700"><Phone className="size-4" />{c.phone}</a>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">{c.tags.map((t) => <Badge key={t} tone={t === "VIP" ? "amber" : "neutral"}>{t}</Badge>)}{c.marketingOptIn && <Badge tone="green">Marketing opt-in</Badge>}</div>
          </div>
        </div>
        <div className="flex gap-2">
          {canManage && <Link href="/calendar?new=1" className={buttonClass("secondary")}><CalendarPlus className="size-4" />Book</Link>}
          {canManage && <CustomerDialogButton canDelete={can(role, "settings:manage")} customer={{ id: c.id, name: c.name, email: c.email, phone: c.phone, tags: c.tags, marketingOptIn: c.marketingOptIn }} />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Lifetime value", formatMoney(spent, business.currency)],
          ["Completed visits", String(completed.length)],
          ["No-shows / cancellations", String(missed)],
          ["Favourite service", favourite ?? "—"],
        ].map(([k, v]) => <Card key={k} className="p-4"><p className="text-[13px] text-ink-500">{k}</p><p className="mt-1.5 truncate text-xl font-semibold tabular">{v}</p></Card>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {upcoming.length > 0 && (
            <Card><CardHeader title="Upcoming" />
              <ul className="divide-y divide-ink-100 px-5 pb-2">{upcoming.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3 text-sm"><span><span className="font-medium">{fmtDate(a.startsAt, tz, "EEE d MMM")} · {fmtTime(a.startsAt, tz)}</span> <span className="text-ink-500">{a.serviceName} with {a.staffName}</span></span><StatusBadge status={a.status} /></li>
              ))}</ul>
            </Card>
          )}
          <Card><CardHeader title="Appointment history" description={`${history.length} total`} />
            {history.length === 0 ? <EmptyState title="No appointments yet" description="Their bookings will appear here." /> : (
              <div className="max-h-[520px] overflow-auto"><table className="w-full text-left text-sm">
                <tbody className="divide-y divide-ink-100">{history.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap py-2.5 pl-5 pr-3 tabular">{fmtDate(a.startsAt, tz, "d MMM yyyy")}<span className="ml-2 text-ink-400">{fmtTime(a.startsAt, tz)}</span></td>
                    <td className="px-3 py-2.5"><span className="mr-2 inline-block size-2 rounded-full" style={{ background: a.serviceColor }} />{a.serviceName}<span className="text-ink-400"> · {a.staffName}</span></td>
                    <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                    <td className="py-2.5 pl-3 pr-5 text-right tabular">{formatMoney(a.priceCents, business.currency)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </div>
        <Card className="self-start"><CardHeader title="Notes" description="Visible to your team only" />
          <NotesPanel customerId={c.id} notes={notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />
        </Card>
      </div>
      <p className="text-xs text-ink-400">Customer since {fmtDate(c.createdAt, tz, "d MMMM yyyy")}</p>
    </div>
  );
}
