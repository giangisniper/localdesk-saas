"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Clock, Pencil, Plus, Scissors } from "lucide-react";
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, Input, Switch, Textarea, useToast } from "@/components/ui";
import { deleteServiceAction, saveServiceAction } from "@/app/actions/catalog";
import { formatDuration, formatMoney } from "@/lib/utils";

export interface ServiceVM { id: string; name: string; description: string; category: string; durationMin: number; priceCents: number; color: string; active: boolean; bookableOnline: boolean; staffIds: string[] }
export const PALETTE = ["#0d9488", "#7c3aed", "#ea580c", "#db2777", "#0891b2", "#f59e0b", "#6366f1", "#e11d48", "#65a30d", "#475569"];

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
      {PALETTE.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)}
          className="size-7 rounded-full ring-offset-2 transition-transform hover:scale-110" style={{ background: c, boxShadow: value === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : undefined }} />
      ))}
    </div>
  );
}

export function ServiceManager({ services, staff, currency }: { services: ServiceVM[]; staff: { id: string; name: string }[]; currency: string }) {
  const [editing, setEditing] = useState<ServiceVM | "new" | null>(null);
  const cats = [...new Set(services.map((s) => s.category || "General"))];
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEditing("new")}><Plus className="size-4" />New service</Button></div>
      {services.length === 0 ? <Card><EmptyState icon={<Scissors className="size-5" />} title="No services yet" description="Add the services customers can book." action={<Button onClick={() => setEditing("new")}>Add a service</Button>} /></Card> : (
        <div className="space-y-6">
          {cats.map((cat) => (
            <section key={cat}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">{cat}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {services.filter((s) => (s.category || "General") === cat).map((s) => (
                  <Card key={s.id} className={`group relative p-4 ${s.active ? "" : "opacity-60"}`}>
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2"><h3 className="font-medium leading-tight">{s.name}</h3><span className="font-semibold tabular">{formatMoney(s.priceCents, currency)}</span></div>
                        <p className="mt-1 flex items-center gap-1 text-[13px] text-ink-500"><Clock className="size-3.5" />{formatDuration(s.durationMin)}</p>
                        {s.description && <p className="mt-2 line-clamp-2 text-[13px] text-ink-600">{s.description}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {!s.active && <Badge tone="amber">Archived</Badge>}
                          {s.active && !s.bookableOnline && <Badge>Internal only</Badge>}
                          <Badge tone="brand">{s.staffIds.length} {s.staffIds.length === 1 ? "provider" : "providers"}</Badge>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`} className="absolute bottom-3 right-3 rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900"><Pencil className="size-4" /></button>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New service" : "Edit service"} wide>
        {editing && <ServiceForm key={editing === "new" ? "new" : editing.id} service={editing === "new" ? undefined : editing} staff={staff} currency={currency} onClose={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}

function ServiceForm({ service, staff, currency, onClose }: { service?: ServiceVM; staff: { id: string; name: string }[]; currency: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    name: service?.name ?? "", description: service?.description ?? "", category: service?.category ?? "", durationMin: String(service?.durationMin ?? 30),
    price: service ? String(service.priceCents / 100) : "", color: service?.color ?? PALETTE[0]!, active: service?.active ?? true, bookableOnline: service?.bookableOnline ?? true,
    staffIds: service?.staffIds ?? staff.map((s) => s.id),
  });
  const [error, setError] = useState<string>();
  const [fe, setFe] = useState<Record<string, string>>({});
  const toggle = (id: string) => setV((x) => ({ ...x, staffIds: x.staffIds.includes(id) ? x.staffIds.filter((s) => s !== id) : [...x.staffIds, id] }));

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await saveServiceAction({ ...v, id: service?.id });
      if (r.ok) { toast("Service saved"); onClose(); router.refresh(); } else { setError(r.error); setFe(r.fieldErrors ?? {}); }
    }); }}>
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" error={fe.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
        <Field label="Category" error={fe.category} hint="Used to group services"><Input value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} list="svc-cats" /></Field>
        <Field label="Duration (minutes)" error={fe.durationMin}><Input type="number" min={5} step={5} value={v.durationMin} onChange={(e) => setV({ ...v, durationMin: e.target.value })} /></Field>
        <Field label={`Price (${currency})`} error={fe.price}><Input inputMode="decimal" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value })} /></Field>
      </div>
      <Field label="Description" error={fe.description}><Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={400} /></Field>
      <div><span className="mb-1.5 block text-[13px] font-medium text-ink-700">Colour</span><ColorPicker value={v.color} onChange={(c) => setV({ ...v, color: c })} /></div>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-ink-700">Who provides this service?</legend>
        <div className="flex flex-wrap gap-2">{staff.map((s) => (
          <label key={s.id} className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm shadow-card ${v.staffIds.includes(s.id) ? "bg-brand-50 text-brand-800 ring-1 ring-brand-300" : "bg-white text-ink-600"}`}>
            <input type="checkbox" className="sr-only" checked={v.staffIds.includes(s.id)} onChange={() => toggle(s.id)} />{s.name}
          </label>))}</div>
      </fieldset>
      <div className="divide-y divide-ink-100">
        <Switch checked={v.active} onChange={(c) => setV({ ...v, active: c })} label="Active" description="Archived services can't be booked." />
        <Switch checked={v.bookableOnline} onChange={(c) => setV({ ...v, bookableOnline: c })} label="Bookable online" description="Show this service on your public booking page." />
      </div>
      <div className="flex items-center justify-between border-t border-ink-100 pt-4">
        <div>{service && <Button variant="ghost" className="text-red-600 hover:bg-red-50" disabled={pending} onClick={() => {
          if (!confirm("Delete this service? If it has appointments it will be archived instead.")) return;
          start(async () => { const r = await deleteServiceAction(service.id); if (r.ok) { toast((r.data as { archived: boolean }).archived ? "Service archived (it has appointment history)" : "Service deleted"); onClose(); router.refresh(); } else setError(r.error); });
        }}>Delete</Button>}</div>
        <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={pending}>Save service</Button></div>
      </div>
    </form>
  );
}
