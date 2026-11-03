"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, UserX } from "lucide-react";
import { Alert, Button, Dialog, Field, Input, Select, StatusBadge, Textarea, useToast } from "@/components/ui";
import { deleteAppointmentAction, saveAppointmentAction, setStatusAction } from "@/app/actions/appointments";
import { addMinutesToTime } from "@/lib/client-time";
import { formatMoney } from "@/lib/utils";

export interface Option { id: string; name: string }
export interface FormData_ {
  services: { id: string; name: string; durationMin: number; priceCents: number; active: boolean }[];
  staff: { id: string; name: string; active: boolean }[];
  links: { staffId: string; serviceId: string }[];
  customers: { id: string; name: string; email: string; phone: string }[];
  currency: string;
  canDelete: boolean;
}
export interface Draft {
  id?: string; customerId?: string; serviceId?: string; staffId?: string; date: string; time: string;
  status?: string; notes?: string; priceCents?: number;
}

export function AppointmentDialog({ draft, onClose, data }: { draft: Draft | null; onClose: () => void; data: FormData_ }) {
  return (
    <Dialog open={!!draft} onClose={onClose} title={draft?.id ? "Edit appointment" : "New appointment"} description={draft?.id ? undefined : "Book a customer into the calendar."} wide>
      {draft && <AppointmentForm key={draft.id ?? `${draft.date}-${draft.time}-${draft.staffId}`} draft={draft} onClose={onClose} data={data} />}
    </Dialog>
  );
}

function AppointmentForm({ draft, onClose, data }: { draft: Draft; onClose: () => void; data: FormData_ }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [fe, setFe] = useState<Record<string, string>>({});
  const editing = !!draft.id;

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [q, setQ] = useState(() => data.customers.find((c) => c.id === draft.customerId)?.name ?? "");
  const [customerId, setCustomerId] = useState(draft.customerId ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nc, setNc] = useState({ name: "", email: "", phone: "" });
  const [serviceId, setServiceId] = useState(draft.serviceId ?? data.services.find((s) => s.active)?.id ?? "");
  const [staffId, setStaffId] = useState(draft.staffId ?? "");
  const [date, setDate] = useState(draft.date);
  const [time, setTime] = useState(draft.time);
  const [status, setStatus] = useState(draft.status ?? "scheduled");
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [price, setPrice] = useState(draft.priceCents != null ? String(draft.priceCents / 100) : "");

  const service = data.services.find((s) => s.id === serviceId);
  const eligible = useMemo(() => data.staff.filter((s) => (s.active || s.id === draft.staffId) && data.links.some((l) => l.staffId === s.id && l.serviceId === serviceId)), [data, serviceId, draft.staffId]);
  useEffect(() => {
    if (!eligible.some((s) => s.id === staffId)) setStaffId(eligible[0]?.id ?? "");
  }, [eligible, staffId]);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.customers.filter((c) => !t || c.name.toLowerCase().includes(t) || c.email.toLowerCase().includes(t) || c.phone.includes(t)).slice(0, 6);
  }, [q, data.customers]);

  function save() {
    setError(undefined); setFe({});
    start(async () => {
      const r = await saveAppointmentAction({
        id: draft.id, customerId: mode === "existing" ? customerId || undefined : undefined,
        newCustomer: mode === "new" ? nc : undefined, serviceId, staffId, date, time, status, notes, price: price || undefined,
      });
      if (r.ok) { toast(editing ? "Appointment updated" : "Appointment booked"); onClose(); router.refresh(); return; }
      setError(r.error); setFe(r.fieldErrors ?? {});
    });
  }
  function quick(statusValue: string, msg: string) {
    start(async () => {
      const r = await setStatusAction({ id: draft.id, status: statusValue });
      if (r.ok) { toast(msg); onClose(); router.refresh(); } else setError(r.error);
    });
  }
  function remove() {
    if (!confirm("Permanently delete this appointment? This can't be undone.")) return;
    start(async () => {
      const r = await deleteAppointmentAction(draft.id!);
      if (r.ok) { toast("Appointment deleted"); onClose(); router.refresh(); } else setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      {editing && <div className="flex items-center gap-2 text-sm"><span className="text-ink-500">Status</span><StatusBadge status={draft.status ?? "scheduled"} /></div>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink-700">Customer</span>
          {!editing && <button type="button" className="text-[13px] font-medium text-brand-700 hover:underline" onClick={() => setMode(mode === "existing" ? "new" : "existing")}>{mode === "existing" ? "+ New customer" : "Pick existing"}</button>}
        </div>
        {mode === "existing" ? (
          <div className="relative">
            <Input value={q} placeholder="Search by name, email or phone" role="combobox" aria-expanded={pickerOpen} aria-controls="cust-list" aria-invalid={!!fe.customerId}
              onChange={(e) => { setQ(e.target.value); setCustomerId(""); setPickerOpen(true); }} onFocus={() => setPickerOpen(true)} onBlur={() => setTimeout(() => setPickerOpen(false), 120)} disabled={editing} />
            {pickerOpen && !editing && (
              <ul id="cust-list" role="listbox" className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg bg-white py-1 shadow-pop">
                {matches.length === 0 && <li className="px-3 py-2 text-sm text-ink-500">No matches</li>}
                {matches.map((c) => (
                  <li key={c.id} role="option" aria-selected={c.id === customerId}>
                    <button type="button" className="flex w-full flex-col px-3 py-1.5 text-left hover:bg-ink-100" onMouseDown={(e) => e.preventDefault()} onClick={() => { setCustomerId(c.id); setQ(c.name); setPickerOpen(false); }}>
                      <span className="text-sm font-medium">{c.name}</span><span className="text-xs text-ink-500">{c.email || c.phone || "No contact info"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {fe.customerId && <p className="mt-1 text-xs text-red-600">{fe.customerId}</p>}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" error={fe["newCustomer.name"]}><Input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></Field>
            <Field label="Email" error={fe["newCustomer.email"]}><Input type="email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></Field>
            <Field label="Phone"><Input type="tel" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} /></Field>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Service" error={fe.serviceId}>
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {data.services.filter((s) => s.active || s.id === draft.serviceId).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMin} min · {formatMoney(s.priceCents, data.currency)}</option>)}
          </Select>
        </Field>
        <Field label="Staff member" error={fe.staffId} hint={eligible.length === 0 ? "No active staff perform this service." : undefined}>
          <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>{eligible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Date" error={fe.date}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Start time" error={fe.time} hint={service && time ? `Ends at ${addMinutesToTime(time, service.durationMin)} (${service.durationMin} min)` : undefined}>
          <Input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        {editing && (
          <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["scheduled", "confirmed", "completed", "cancelled", "no_show"].map((s) => <option key={s} value={s}>{s.replace("_", "-")}</option>)}
          </Select></Field>
        )}
        <Field label={`Price override (${data.currency})`} error={fe.price} hint="Leave empty to use the service price."><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={service ? String(service.priceCents / 100) : ""} /></Field>
      </div>
      <Field label="Notes" error={fe.notes}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the team should know" maxLength={1000} /></Field>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-4">
        <div className="flex flex-wrap gap-2">
          {editing && draft.status !== "completed" && <Button variant="secondary" size="sm" disabled={pending} onClick={() => quick("completed", "Marked as completed")}><CheckCircle2 className="size-4 text-emerald-600" />Complete</Button>}
          {editing && draft.status !== "no_show" && <Button variant="secondary" size="sm" disabled={pending} onClick={() => quick("no_show", "Marked as no-show")}><UserX className="size-4 text-amber-600" />No-show</Button>}
          {editing && draft.status !== "cancelled" && <Button variant="secondary" size="sm" disabled={pending} onClick={() => quick("cancelled", "Appointment cancelled")}><Ban className="size-4 text-red-600" />Cancel</Button>}
          {editing && data.canDelete && <Button variant="ghost" size="sm" disabled={pending} onClick={remove} className="text-red-600 hover:bg-red-50">Delete</Button>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button loading={pending} onClick={save} disabled={!serviceId || !staffId}>{editing ? "Save changes" : "Book appointment"}</Button>
        </div>
      </div>
    </div>
  );
}
