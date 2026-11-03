"use client";
import { emailError } from "@/lib/email";
import { PhoneInput } from "@/components/phone-input";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Plane, Trash2, UserCog, X } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { Alert, Avatar, Badge, Button, Card, Dialog, EmptyState, Field, Input, Switch, useToast, DialogFooter } from "@/components/ui";
import { ColorPicker } from "@/components/service-manager";
import { addTimeOffAction, deleteStaffAction, removeTimeOffAction, saveStaffAction } from "@/app/actions/catalog";

export interface StaffVM {
  id: string; name: string; email: string; phone: string; title: string; color: string; active: boolean;
  hours: { weekday: number; startTime: string; endTime: string }[]; serviceIds: string[];
  timeOff: { id: string; startsAt: string; endsAt: string; reason: string }[];
}
const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]] as const;

function summarize(hours: StaffVM["hours"]) {
  const days = DAYS.filter(([d]) => hours.some((h) => h.weekday === d)).map(([, l]) => l);
  return days.length ? days.join(", ") : "No working hours set";
}

export function StaffManager({ staff, services, tz, today }: { staff: StaffVM[]; services: { id: string; name: string }[]; tz: string; today: string }) {
  const [editing, setEditing] = useState<StaffVM | "new" | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end"><Button onClick={() => setEditing("new")}><Plus className="size-4" />Add team member</Button></div>
      {staff.length === 0 ? <Card><EmptyState icon={<UserCog className="size-5" />} title="No team members" action={<Button onClick={() => setEditing("new")}>Add team member</Button>} /></Card> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <Card key={s.id} className={`p-5 ${s.active ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <Avatar name={s.name} color={s.color} size={44} />
                <div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{s.name}</h3><p className="truncate text-[13px] text-ink-500">{s.title || "Team member"}</p></div>
                <button onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900"><Pencil className="size-4" /></button>
              </div>
              <dl className="mt-4 space-y-2 text-[13px]">
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Works</dt><dd className="text-right font-medium">{summarize(s.hours)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-ink-500">Services</dt><dd className="font-medium">{s.serviceIds.length}</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {!s.active && <Badge tone="amber">Inactive</Badge>}
                {s.timeOff.slice(0, 2).map((t) => <Badge key={t.id} tone="blue"><Plane className="size-3" />{formatInTimeZone(t.startsAt, tz, "d MMM")}–{formatInTimeZone(new Date(+new Date(t.endsAt) - 1), tz, "d MMM")}</Badge>)}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add team member" : "Edit team member"} wide>
        {editing && <StaffForm key={editing === "new" ? "new" : editing.id} member={editing === "new" ? undefined : editing} services={services} tz={tz} today={today} onClose={() => setEditing(null)} />}
      </Dialog>
    </>
  );
}

function StaffForm({ member, services, tz, today, onClose }: { member?: StaffVM; services: { id: string; name: string }[]; tz: string; today: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    name: member?.name ?? "", email: member?.email ?? "", phone: member?.phone ?? "", title: member?.title ?? "", color: member?.color ?? "#7c3aed", active: member?.active ?? true,
    serviceIds: member?.serviceIds ?? services.map((s) => s.id),
    hours: member?.hours ?? [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "09:00", endTime: "17:00" })),
  });
  const [error, setError] = useState<string>();
  const [fe, setFe] = useState<Record<string, string>>({});
  const [off, setOff] = useState({ startDate: today, endDate: today, reason: "" });
  const [offError, setOffError] = useState<string>();

  const setShift = (i: number, patch: Partial<StaffVM["hours"][number]>) => setV((x) => ({ ...x, hours: x.hours.map((h, j) => (j === i ? { ...h, ...patch } : h)) }));
  const toggleService = (id: string) => setV((x) => ({ ...x, serviceIds: x.serviceIds.includes(id) ? x.serviceIds.filter((s) => s !== id) : [...x.serviceIds, id] }));

  return (
    <div className="space-y-5">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => {
        const r = await saveStaffAction({ ...v, id: member?.id });
        if (r.ok) { toast("Team member saved"); onClose(); router.refresh(); } else { setError(r.error); setFe(r.fieldErrors ?? {}); }
      }); }}>
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" error={fe.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
          <Field label="Role / title" error={fe.title}><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Senior stylist" /></Field>
          <Field label="Email" error={fe.email}><Input type="email" inputMode="email" autoCapitalize="none" value={v.email} onBlur={() => setFe((f) => ({ ...f, email: emailError(v.email) ?? "" }))} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          <Field label="Phone" error={fe.phone}><PhoneInput value={v.phone} onChange={(phone) => setV({ ...v, phone })} /></Field>
        </div>
        <div><span className="mb-1.5 block text-[13px] font-medium text-ink-700">Calendar colour</span><ColorPicker value={v.color} onChange={(c) => setV({ ...v, color: c })} /></div>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-700">Working hours</legend>
          <div className="space-y-1.5 rounded-lg bg-ink-50 p-3">
            {DAYS.map(([d, label]) => {
              const shifts = v.hours.map((h, i) => ({ ...h, i })).filter((h) => h.weekday === d);
              return (
                <div key={d} className="flex flex-wrap items-center gap-2">
                  <label className="flex w-14 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-brand-600" aria-label={`Works on ${label}`} checked={shifts.length > 0}
                      onChange={(e) => setV((x) => ({ ...x, hours: e.target.checked ? [...x.hours, { weekday: d, startTime: "09:00", endTime: "17:00" }] : x.hours.filter((h) => h.weekday !== d) }))} />{label}
                  </label>
                  {shifts.length === 0 && <span className="text-sm text-ink-400">Off</span>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {shifts.map((s) => (
                      <span key={s.i} className="inline-flex items-center gap-1.5">
                        <Input type="time" className="w-28" value={s.startTime} aria-label={`${label} shift start`} onChange={(e) => setShift(s.i, { startTime: e.target.value })} />–
                        <Input type="time" className="w-28" value={s.endTime} aria-label={`${label} shift end`} onChange={(e) => setShift(s.i, { endTime: e.target.value })} />
                        {shifts.length > 1 && <button type="button" aria-label="Remove shift" className="text-ink-400 hover:text-red-600" onClick={() => setV((x) => ({ ...x, hours: x.hours.filter((_, j) => j !== s.i) }))}><X className="size-4" /></button>}
                      </span>
                    ))}
                  </div>
                  {shifts.length > 0 && shifts.length < 3 && <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setV((x) => ({ ...x, hours: [...x.hours, { weekday: d, startTime: "14:00", endTime: "18:00" }] }))}>+ split shift</button>}
                </div>
              );
            })}
          </div>
          {fe.hours && <p className="mt-1 text-xs text-red-600">{fe.hours}</p>}
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-700">Services performed</legend>
          <div className="flex flex-wrap gap-2">{services.map((s) => (
            <label key={s.id} className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm shadow-card ${v.serviceIds.includes(s.id) ? "bg-brand-50 text-brand-800 ring-1 ring-brand-300" : "bg-white text-ink-600"}`}>
              <input type="checkbox" className="sr-only" checked={v.serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} />{s.name}
            </label>))}</div>
        </fieldset>
        <Switch checked={v.active} onChange={(c) => setV({ ...v, active: c })} label="Active" description="Inactive members don't appear in booking or the calendar." />
        <DialogFooter>
          <div>{member && <Button variant="ghost" className="text-red-600 hover:bg-red-50" disabled={pending} onClick={() => {
            if (!confirm("Remove this team member? If they have appointment history they will be deactivated instead.")) return;
            start(async () => { const r = await deleteStaffAction(member.id); if (r.ok) { toast("Team member removed"); onClose(); router.refresh(); } else setError(r.error); });
          }}><Trash2 className="size-4" />Remove</Button>}</div>
          <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={pending}>Save</Button></div>
        </DialogFooter>
      </form>

      {member && (
        <section className="space-y-3 border-t border-ink-100 pt-4" aria-labelledby="to-h">
          <h3 id="to-h" className="text-sm font-semibold">Time off</h3>
          {member.timeOff.length > 0 && <ul className="space-y-1.5">{member.timeOff.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
              <span>{formatInTimeZone(t.startsAt, tz, "d MMM")} – {formatInTimeZone(new Date(+new Date(t.endsAt) - 1), tz, "d MMM yyyy")}{t.reason && <span className="text-ink-500"> · {t.reason}</span>}</span>
              <button aria-label="Remove time off" className="text-ink-400 hover:text-red-600" onClick={() => start(async () => { await removeTimeOffAction(t.id); router.refresh(); })}><X className="size-4" /></button>
            </li>))}</ul>}
          {offError && <Alert>{offError}</Alert>}
          <div className="flex flex-wrap items-end gap-2">
            <Field label="From"><Input type="date" value={off.startDate} onChange={(e) => setOff({ ...off, startDate: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={off.endDate} min={off.startDate} onChange={(e) => setOff({ ...off, endDate: e.target.value })} /></Field>
            <Field label="Reason" className="min-w-32 flex-1"><Input value={off.reason} onChange={(e) => setOff({ ...off, reason: e.target.value })} placeholder="Holiday" /></Field>
            <Button variant="secondary" disabled={pending} onClick={() => start(async () => {
              const r = await addTimeOffAction({ staffId: member.id, ...off });
              if (r.ok) { setOffError(undefined); toast("Time off added"); router.refresh(); } else setOffError(r.fieldErrors?.endDate ?? r.error);
            })}>Add</Button>
          </div>
          <p className="text-xs text-ink-500">Existing appointments aren&apos;t moved automatically — review the calendar after adding time off.</p>
        </section>
      )}
    </div>
  );
}
