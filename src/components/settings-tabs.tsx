"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, Switch, Textarea, useToast } from "@/components/ui";
import type { ActionResult } from "@/lib/action";
import { cn } from "@/lib/utils";
import { addMemberAction, changePasswordAction, changeRoleAction, removeMemberAction, updateAccountAction, updateBusinessAction, updateHoursAction, updateNotificationsAction, updateRulesAction } from "@/app/actions/settings";
import type { NotificationPrefs, OpeningHours } from "@/db/schema";

interface Biz {
  id: string; name: string; slug: string; category: string; description: string; email: string; phone: string; address: string; timezone: string; currency: string;
  slotIntervalMin: number; minNoticeHours: number; maxAdvanceDays: number; cancellationHours: number; bufferMin: number; onlineBookingEnabled: boolean; autoConfirm: boolean;
  openingHours: OpeningHours; notifications: NotificationPrefs;
}
interface Member { userId: string; name: string; email: string; role: string }
const TABS = [["business", "Business"], ["hours", "Opening hours"], ["booking", "Booking rules"], ["notifications", "Notifications"], ["account", "Account"], ["team", "Team access"]] as const;
const ZONES = ["Europe/Rome", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto", "Australia/Sydney", "UTC"];
const DAYS = [["1", "Monday"], ["2", "Tuesday"], ["3", "Wednesday"], ["4", "Thursday"], ["5", "Friday"], ["6", "Saturday"], ["0", "Sunday"]] as const;

function useSave() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [fe, setFe] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<ActionResult>, msg = "Saved", after?: () => void) => start(async () => {
    const r = await fn();
    if (r.ok) { setError(undefined); setFe({}); toast(msg); after?.(); router.refresh(); } else { setError(r.error); setFe(r.fieldErrors ?? {}); }
  });
  return { pending, error, fe, run };
}

export function SettingsTabs({ business, user, role, members, appUrl }: { business: Biz; user: { id: string; name: string; email: string }; role: string; members: Member[]; appUrl: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("business");
  const tabs = TABS.filter(([k]) => k !== "team" || role === "owner");
  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <div role="tablist" aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium", tab === k ? "bg-white shadow-card" : "text-ink-600 hover:bg-ink-200/60")}>{l}</button>
        ))}
      </div>
      <div role="tabpanel" className="max-w-2xl">
        {tab === "business" && <BusinessTab b={business} appUrl={appUrl} />}
        {tab === "hours" && <HoursTab b={business} />}
        {tab === "booking" && <BookingTab b={business} />}
        {tab === "notifications" && <NotificationsTab b={business} />}
        {tab === "account" && <AccountTab user={user} role={role} />}
        {tab === "team" && <TeamTab members={members} selfId={user.id} />}
      </div>
    </div>
  );
}

function BusinessTab({ b, appUrl }: { b: Biz; appUrl: string }) {
  const s = useSave();
  const toast = useToast();
  const [v, setV] = useState({ name: b.name, slug: b.slug, category: b.category, description: b.description, email: b.email, phone: b.phone, address: b.address, timezone: b.timezone, currency: b.currency });
  const zones = ZONES.includes(v.timezone) ? ZONES : [v.timezone, ...ZONES];
  const link = `${appUrl}/book/${v.slug}`;
  return (
    <Card><CardHeader title="Business profile" description="Shown on your public booking page." />
      <form className="space-y-4 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); s.run(() => updateBusinessAction(v)); }}>
        {s.error && <Alert>{s.error}</Alert>}
        <Field label="Business name" error={s.fe.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Booking page URL" error={s.fe.slug} hint={link}><Input value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} /></Field>
        <Button type="button" variant="ghost" size="sm" onClick={() => { void navigator.clipboard?.writeText(link); toast("Booking link copied"); }}><Copy className="size-4" />Copy booking link</Button>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" error={s.fe.category}><Input value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })} /></Field>
          <Field label="Public email" error={s.fe.email}><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          <Field label="Phone"><Input type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label="Address"><Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
          <Field label="Timezone" error={s.fe.timezone}><Select value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })}>{zones.map((z) => <option key={z}>{z}</option>)}</Select></Field>
          <Field label="Currency"><Select value={v.currency} onChange={(e) => setV({ ...v, currency: e.target.value })}>{["EUR", "USD", "GBP", "CHF", "CAD", "AUD"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        <Field label="Description" error={s.fe.description}><Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} maxLength={500} /></Field>
        <Button type="submit" loading={s.pending}>Save changes</Button>
      </form>
    </Card>
  );
}

function HoursTab({ b }: { b: Biz }) {
  const s = useSave();
  const [h, setH] = useState<OpeningHours>(() => Object.fromEntries(DAYS.map(([d]) => [d, b.openingHours[d] ?? []])));
  const set = (d: string, i: number, patch: Partial<{ open: string; close: string }>) => setH((x) => ({ ...x, [d]: x[d]!.map((w, j) => (j === i ? { ...w, ...patch } : w)) }));
  return (
    <Card><CardHeader title="Opening hours" description="Online booking is only offered inside these hours (and each staff member's own working hours)." />
      <form className="space-y-3 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); s.run(() => updateHoursAction(h)); }}>
        {s.error && <Alert>{s.error}</Alert>}
        {DAYS.map(([d, label]) => (
          <div key={d} className="flex flex-wrap items-center gap-2">
            <label className="flex w-28 items-center gap-2 text-sm font-medium"><input type="checkbox" className="size-4 accent-brand-600" checked={h[d]!.length > 0} onChange={(e) => setH({ ...h, [d]: e.target.checked ? [{ open: "09:00", close: "18:00" }] : [] })} />{label}</label>
            {h[d]!.length === 0 && <span className="text-sm text-ink-400">Closed</span>}
            {h[d]!.map((w, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <Input type="time" className="w-28" aria-label={`${label} opens`} value={w.open} onChange={(e) => set(d, i, { open: e.target.value })} />–
                <Input type="time" className="w-28" aria-label={`${label} closes`} value={w.close} onChange={(e) => set(d, i, { close: e.target.value })} />
              </span>
            ))}
            {h[d]!.length > 0 && h[d]!.length < 2 && <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setH({ ...h, [d]: [...h[d]!, { open: "14:00", close: "18:00" }] })}>+ lunch break</button>}
            {h[d]!.length === 2 && <button type="button" className="text-xs font-medium text-ink-500 hover:underline" onClick={() => setH({ ...h, [d]: [h[d]![0]!] })}>remove break</button>}
          </div>
        ))}
        {s.fe && Object.keys(s.fe).length > 0 && <p className="text-xs text-red-600">Closing time must be after opening time.</p>}
        <Button type="submit" loading={s.pending}>Save hours</Button>
      </form>
    </Card>
  );
}

function BookingTab({ b }: { b: Biz }) {
  const s = useSave();
  const [v, setV] = useState({ slotIntervalMin: String(b.slotIntervalMin), minNoticeHours: String(b.minNoticeHours), maxAdvanceDays: String(b.maxAdvanceDays), cancellationHours: String(b.cancellationHours), bufferMin: String(b.bufferMin), onlineBookingEnabled: b.onlineBookingEnabled, autoConfirm: b.autoConfirm });
  return (
    <Card><CardHeader title="Booking rules" description="Control how and when customers can book online." />
      <form className="space-y-4 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); s.run(() => updateRulesAction(v)); }}>
        {s.error && <Alert>{s.error}</Alert>}
        <div className="divide-y divide-ink-100">
          <Switch checked={v.onlineBookingEnabled} onChange={(c) => setV({ ...v, onlineBookingEnabled: c })} label="Accept online bookings" description="Turn off to hide your public booking page." />
          <Switch checked={v.autoConfirm} onChange={(c) => setV({ ...v, autoConfirm: c })} label="Auto-confirm online bookings" description="Otherwise new bookings start as “Scheduled” until you confirm them." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Time slot interval" error={s.fe.slotIntervalMin}><Select value={v.slotIntervalMin} onChange={(e) => setV({ ...v, slotIntervalMin: e.target.value })}>{[5, 10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}</Select></Field>
          <Field label="Buffer between appointments (min)" error={s.fe.bufferMin}><Input type="number" min={0} max={120} step={5} value={v.bufferMin} onChange={(e) => setV({ ...v, bufferMin: e.target.value })} /></Field>
          <Field label="Minimum notice (hours)" error={s.fe.minNoticeHours}><Input type="number" min={0} value={v.minNoticeHours} onChange={(e) => setV({ ...v, minNoticeHours: e.target.value })} /></Field>
          <Field label="Book up to (days ahead)" error={s.fe.maxAdvanceDays}><Input type="number" min={1} value={v.maxAdvanceDays} onChange={(e) => setV({ ...v, maxAdvanceDays: e.target.value })} /></Field>
          <Field label="Free cancellation window (hours)" error={s.fe.cancellationHours} hint="Shown to customers on the confirmation."><Input type="number" min={0} value={v.cancellationHours} onChange={(e) => setV({ ...v, cancellationHours: e.target.value })} /></Field>
        </div>
        <Button type="submit" loading={s.pending}>Save rules</Button>
      </form>
    </Card>
  );
}

function NotificationsTab({ b }: { b: Biz }) {
  const s = useSave();
  const [v, setV] = useState<NotificationPrefs>(b.notifications);
  const rows: [keyof NotificationPrefs, string, string][] = [
    ["newBooking", "New booking", "Get notified when a customer books online."],
    ["cancellation", "Cancellations", "Get notified when an appointment is cancelled."],
    ["dailyDigest", "Daily digest", "A morning summary of today's schedule."],
    ["customerReminders", "Customer reminders", "Remind customers 24 hours before their appointment."],
  ];
  return (
    <Card><CardHeader title="Notification preferences" description="Preferences are stored per business. Email delivery needs an SMTP provider — see the README." />
      <form className="space-y-3 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); s.run(() => updateNotificationsAction(v)); }}>
        {s.error && <Alert>{s.error}</Alert>}
        <div className="divide-y divide-ink-100">{rows.map(([k, l, d]) => <Switch key={k} checked={v[k]} onChange={(c) => setV({ ...v, [k]: c })} label={l} description={d} />)}</div>
        <Button type="submit" loading={s.pending}>Save preferences</Button>
      </form>
    </Card>
  );
}

function AccountTab({ user, role }: { user: { name: string; email: string }; role: string }) {
  const a = useSave(); const p = useSave();
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ current: "", next: "" });
  return (
    <div className="space-y-4">
      <Card><CardHeader title="Your account" />
        <form className="space-y-4 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); a.run(() => updateAccountAction({ name })); }}>
          {a.error && <Alert>{a.error}</Alert>}
          <Field label="Name" error={a.fe.name}><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email" hint="Contact support to change your sign-in email."><Input value={user.email} disabled /></Field>
          <p className="text-sm text-ink-600">Role: <Badge tone="brand" className="capitalize">{role}</Badge></p>
          <Button type="submit" loading={a.pending}>Save</Button>
        </form>
      </Card>
      <Card><CardHeader title="Change password" />
        <form className="space-y-4 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); p.run(() => changePasswordAction(pw), "Password updated", () => setPw({ current: "", next: "" })); }}>
          {p.error && <Alert>{p.error}</Alert>}
          <Field label="Current password" error={p.fe.current}><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="New password" error={p.fe.next} hint="At least 10 characters with letters and numbers."><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Button type="submit" loading={p.pending}>Update password</Button>
        </form>
      </Card>
    </div>
  );
}

function TeamTab({ members, selfId }: { members: Member[]; selfId: string }) {
  const s = useSave();
  const [v, setV] = useState({ name: "", email: "", password: "", role: "staff" });
  return (
    <div className="space-y-4">
      <Card><CardHeader title="People with access" description="Owners manage everything. Admins manage everything except team access. Staff can use the calendar and customers." />
        <ul className="divide-y divide-ink-100 px-5 pb-2">{members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div><p className="text-sm font-medium">{m.name}{m.userId === selfId && <span className="text-ink-400"> (you)</span>}</p><p className="text-[13px] text-ink-500">{m.email}</p></div>
            {m.role === "owner" || m.userId === selfId ? <Badge tone="brand" className="capitalize">{m.role}</Badge> : (
              <div className="flex items-center gap-2">
                <Select aria-label={`Role for ${m.name}`} value={m.role} className="w-28" onChange={(e) => s.run(() => changeRoleAction({ userId: m.userId, role: e.target.value }), "Role updated")}><option value="admin">Admin</option><option value="staff">Staff</option></Select>
                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => { if (confirm(`Remove ${m.name}'s access?`)) s.run(() => removeMemberAction(m.userId), "Access removed"); }}>Remove</Button>
              </div>)}
          </li>))}</ul>
      </Card>
      <Card><CardHeader title="Add a team login" description="Create credentials for a colleague. Share the temporary password securely — they can change it in Settings." />
        <form className="space-y-3 px-5 pb-5" onSubmit={(e) => { e.preventDefault(); s.run(() => addMemberAction(v), "Team member added", () => setV({ name: "", email: "", password: "", role: "staff" })); }}>
          {s.error && <Alert>{s.error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" error={s.fe.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
            <Field label="Email" error={s.fe.email}><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
            <Field label="Temporary password" error={s.fe.password}><Input type="text" autoComplete="off" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
            <Field label="Role"><Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}><option value="staff">Staff</option><option value="admin">Admin</option></Select></Field>
          </div>
          <Button type="submit" loading={s.pending}>Add team member</Button>
        </form>
      </Card>
    </div>
  );
}
