"use client";
import { emailError } from "@/lib/email";
import { PhoneInput } from "@/components/phone-input";
import { useEffect, useState, useTransition } from "react";
import { addMonths, format, parseISO } from "date-fns";
import { ArrowLeft, CalendarCheck, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Alert, Avatar, Button, Card, Field, Input, Skeleton, Textarea } from "@/components/ui";
import { createPublicBookingAction, getSlotsAction, type BookingConfirmation } from "@/app/actions/public-booking";
import { addDaysStr, monthStart, weekStart } from "@/lib/time";
import { cn, formatDuration, formatMoney } from "@/lib/utils";

interface Svc { id: string; name: string; description: string; category: string; durationMin: number; priceCents: number; color: string }
interface Member { id: string; name: string; title: string; color: string; serviceIds: string[] }

export function BookingFlow({ slug, services, staff, currency, today, maxAdvanceDays, cancellationHours }: { slug: string; services: Svc[]; staff: Member[]; currency: string; today: string; maxAdvanceDays: number; cancellationHours: number }) {
  const [step, setStep] = useState(1);
  const [service, setService] = useState<Svc>();
  const [staffId, setStaffId] = useState("any");
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(monthStart(today));
  const [slots, setSlots] = useState<{ time: string }[] | null>(null);
  const [slotError, setSlotError] = useState<string>();
  const [time, setTime] = useState<string>();
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [error, setError] = useState<string>();
  const [fe, setFe] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [done, setDone] = useState<BookingConfirmation>();
  const maxDate = addDaysStr(today, maxAdvanceDays);

  useEffect(() => {
    if (step !== 2 || !service) return;
    let cancelled = false;
    setSlots(null); setSlotError(undefined); setTime(undefined);
    getSlotsAction({ slug, serviceId: service.id, staffId, date }).then((r) => {
      if (cancelled) return;
      if (r.ok) setSlots(r.data ?? []); else { setSlotError(r.error); setSlots([]); }
    });
    return () => { cancelled = true; };
  }, [step, service, staffId, date, slug]);

  const eligible = service ? staff.filter((s) => s.serviceIds.includes(service.id)) : [];

  function submit() {
    setError(undefined); setFe({});
    const emailProblem = emailError(form.email, { required: true });
    if (emailProblem || form.name.trim().length < 2) { setFe({ ...(form.name.trim().length < 2 ? { name: "Enter your name" } : {}), ...(emailProblem ? { email: emailProblem } : {}) }); return; }
    start(async () => {
      const r = await createPublicBookingAction({ slug, serviceId: service!.id, staffId, date, time, ...form });
      if (r.ok) setDone(r.data); else { setError(r.error); setFe(r.fieldErrors ?? {}); }
    });
  }

  if (done) return (
    <Card className="mx-auto max-w-md animate-rise p-8 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CalendarCheck className="size-6" /></div>
      <h2 className="text-xl font-semibold tracking-tight">{done.status === "confirmed" ? "You're booked!" : "Request received"}</h2>
      <p className="mt-1 text-sm text-ink-500">{done.status === "confirmed" ? `Your appointment at ${done.business} is confirmed.` : `${done.business} will confirm your appointment shortly.`}</p>
      <dl className="mt-6 space-y-2 rounded-xl bg-ink-50 p-4 text-left text-sm">
        <div className="flex justify-between"><dt className="text-ink-500">Service</dt><dd className="font-medium">{done.service}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-500">When</dt><dd className="font-medium">{done.when}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-500">With</dt><dd className="font-medium">{done.staff}</dd></div>
      </dl>
      <p className="mt-4 text-xs text-ink-500">Need to change plans? Please contact us at least {done.cancellationHours} hours ahead.</p>
    </Card>
  );

  const first = monthStart(month);
  const gridDays = Array.from({ length: 42 }, (_, i) => addDaysStr(weekStart(first), i));
  const cats = [...new Set(services.map((s) => s.category || "Services"))];

  return (
    <div className="space-y-5">
      <ol className="flex items-center gap-2 text-xs font-medium text-ink-500" aria-label="Booking steps">
        {["Service", "Time", "Your details"].map((l, i) => <li key={l} aria-current={step === i + 1 ? "step" : undefined} className={cn("flex items-center gap-2", step === i + 1 && "text-ink-900")}><span className={cn("flex size-5 items-center justify-center rounded-full text-[11px]", step > i + 1 ? "bg-brand-600 text-white" : step === i + 1 ? "bg-ink-900 text-white" : "bg-ink-200")}>{i + 1}</span>{l}{i < 2 && <span className="mx-1 h-px w-6 bg-ink-300" />}</li>)}
      </ol>

      {step === 1 && (
        <div className="animate-rise space-y-6">
          {cats.map((cat) => (
            <section key={cat}><h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">{cat}</h2>
              <div className="space-y-2">{services.filter((s) => (s.category || "Services") === cat).map((s) => (
                <button key={s.id} onClick={() => { setService(s); setStaffId("any"); setStep(2); }} className="flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left shadow-card transition hover:shadow-pop focus-visible:outline-2">
                  <span className="h-10 w-1.5 rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1"><span className="block font-medium">{s.name}</span><span className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-500"><Clock className="size-3.5" />{formatDuration(s.durationMin)}</span>{s.description && <span className="mt-1 block text-[13px] text-ink-600">{s.description}</span>}</span>
                  <span className="font-semibold tabular">{formatMoney(s.priceCents, currency)}</span>
                </button>))}</div></section>))}
        </div>
      )}

      {step === 2 && service && (
        <div className="animate-rise space-y-4">
          <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" />{service.name} · {formatDuration(service.durationMin)}</button>
          <Field label="With"><div className="flex flex-wrap gap-2">
            {[{ id: "any", name: "Any professional", title: "", color: "#5d5a52" }, ...eligible].map((m) => (
              <button key={m.id} onClick={() => setStaffId(m.id)} aria-pressed={staffId === m.id} className={cn("flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm shadow-card", staffId === m.id ? "bg-brand-50 ring-1 ring-brand-400" : "bg-white")}>
                <Avatar name={m.name} color={m.color} size={24} />{m.name}</button>))}
          </div></Field>
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{format(parseISO(first), "MMMM yyyy")}</h3>
                <div className="flex"><Button variant="ghost" size="sm" aria-label="Previous month" disabled={first <= monthStart(today)} onClick={() => setMonth(format(addMonths(parseISO(first), -1), "yyyy-MM-dd"))}><ChevronLeft className="size-4" /></Button>
                  <Button variant="ghost" size="sm" aria-label="Next month" disabled={addDaysStr(first, 31) > maxDate} onClick={() => setMonth(format(addMonths(parseISO(first), 1), "yyyy-MM-dd"))}><ChevronRight className="size-4" /></Button></div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-400">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
              <div className="mt-1 grid grid-cols-7 gap-1">{gridDays.map((d) => {
                const out = d.slice(0, 7) !== first.slice(0, 7); const disabled = d < today || d > maxDate;
                return <button key={d} disabled={disabled || out} onClick={() => setDate(d)} aria-label={d} aria-pressed={date === d}
                  className={cn("aspect-square rounded-lg text-sm tabular transition-colors", out && "invisible", disabled ? "text-ink-300" : "hover:bg-ink-100", date === d && "!bg-brand-600 font-semibold text-white")}>{Number(d.slice(8))}</button>;
              })}</div>
            </Card>
            <Card className="p-4">
              <h3 className="mb-3 text-sm font-semibold">{format(parseISO(date), "EEEE d MMMM")}</h3>
              {slotError && <Alert>{slotError}</Alert>}
              {slots === null ? <div className="grid grid-cols-3 gap-2">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
                : slots.length === 0 && !slotError ? <p className="py-6 text-center text-sm text-ink-500">No availability on this day. Try another date.</p>
                : <div className="grid max-h-72 grid-cols-3 gap-2 overflow-auto">{slots.map((s) => (
                  <button key={s.time} onClick={() => setTime(s.time)} aria-pressed={time === s.time} className={cn("h-9 rounded-lg text-sm font-medium tabular shadow-card", time === s.time ? "bg-brand-600 text-white" : "bg-white hover:bg-brand-50")}>{s.time}</button>))}</div>}
            </Card>
          </div>
          <Button size="lg" className="w-full" disabled={!time} onClick={() => setStep(3)}>Continue</Button>
        </div>
      )}

      {step === 3 && service && (
        <form className="animate-rise space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 hover:text-ink-900"><ArrowLeft className="size-4" />Change time</button>
          <Card className="flex items-center justify-between p-4 text-sm"><span><span className="font-medium">{service.name}</span><span className="block text-ink-500">{format(parseISO(date), "EEE d MMM")} at {time}</span></span><span className="font-semibold tabular">{formatMoney(service.priceCents, currency)}</span></Card>
          {error && <Alert>{error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" error={fe.name}><Input value={form.name} autoComplete="name" onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email" error={fe.email}><Input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <Field label="Phone (optional)" error={fe.phone}><PhoneInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} /></Field>
          <Field label="Notes (optional)"><Textarea value={form.notes} maxLength={500} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <p className="text-xs text-ink-500">Free cancellation up to {cancellationHours} hours before your appointment.</p>
          <Button type="submit" size="lg" className="w-full" loading={pending}>Confirm booking</Button>
        </form>
      )}
    </div>
  );
}
