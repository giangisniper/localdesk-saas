"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { onboardingAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const DAYS = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]] as const;
const CATEGORIES = ["Hair & Beauty", "Barber", "Health & Wellness", "Fitness & Yoga", "Therapy & Coaching", "Consulting", "Auto & Repair", "Other"];
const ZONES = ["Europe/Rome", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto", "Australia/Sydney", "UTC"];

type Hours = Record<string, { open: string; close: string }[]>;
const defaultHours = (): Hours => Object.fromEntries(DAYS.map(([d]) => [d, ["0", "6"].includes(d) ? [] : [{ open: "09:00", close: "18:00" }]]));

export function OnboardingWizard({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [fe, setFe] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [timezone, setTimezone] = useState(typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
  const [currency, setCurrency] = useState("EUR");
  const [hours, setHours] = useState<Hours>(defaultHours());
  const [svc, setSvc] = useState({ name: "", durationMin: "30", price: "" });
  const [staffName, setStaffName] = useState(defaultName);

  const zones = ZONES.includes(timezone) ? ZONES : [timezone, ...ZONES];
  const setDay = (d: string, v: { open: string; close: string }[]) => setHours((h) => ({ ...h, [d]: v }));

  function next() {
    setError(undefined);
    if (step === 0 && name.trim().length < 2) return setFe({ name: "Enter your business name" });
    setFe({}); setStep((s) => s + 1);
  }
  function finish() {
    start(async () => {
      const r = await onboardingAction({ name, category, timezone, currency, openingHours: hours, firstService: svc, staffName });
      if (r.ok) { router.push("/dashboard"); router.refresh(); return; }
      setError(r.error); setFe(r.fieldErrors ?? {});
      if (Object.keys(r.fieldErrors ?? {}).some((k) => k === "name")) setStep(0);
    });
  }

  const steps = ["Business", "Hours", "First service"];
  return (
    <div className="space-y-6">
      <ol className="flex gap-2" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={cn("h-1 rounded-full", i <= step ? "bg-brand-600" : "bg-ink-200")} />
            <span className={cn("mt-1.5 block text-xs", i === step ? "font-medium text-ink-900" : "text-ink-500")}>{s}</span>
          </li>
        ))}
      </ol>
      {error && <Alert>{error}</Alert>}

      {step === 0 && (
        <div className="space-y-4 animate-rise">
          <div><h1 className="text-2xl font-semibold tracking-tight">Tell us about your business</h1><p className="mt-1 text-sm text-ink-500">This sets up your booking page and calendar.</p></div>
          <Field label="Business name" error={fe.name}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Studio Luna" autoFocus /></Field>
          <Field label="Type of business"><Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Timezone"><Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>{zones.map((z) => <option key={z}>{z}</option>)}</Select></Field>
            <Field label="Currency"><Select value={currency} onChange={(e) => setCurrency(e.target.value)}>{["EUR", "USD", "GBP", "CHF", "CAD", "AUD"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          </div>
          <Button size="lg" className="w-full" onClick={next}>Continue</Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 animate-rise">
          <div><h1 className="text-2xl font-semibold tracking-tight">When are you open?</h1><p className="mt-1 text-sm text-ink-500">Customers can only book inside these hours. You can refine them later.</p></div>
          <div className="space-y-2">
            {DAYS.map(([d, label]) => {
              const w = hours[d]![0];
              return (
                <div key={d} className="flex items-center gap-2">
                  <label className="flex w-16 items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="size-4 accent-brand-600" checked={!!w} onChange={(e) => setDay(d, e.target.checked ? [{ open: "09:00", close: "18:00" }] : [])} aria-label={`Open on ${label}`} />
                    {label}
                  </label>
                  {w ? (
                    <>
                      <Input type="time" value={w.open} onChange={(e) => setDay(d, [{ ...w, open: e.target.value }])} aria-label={`${label} opens`} className="w-28" />
                      <span className="text-ink-400">–</span>
                      <Input type="time" value={w.close} onChange={(e) => setDay(d, [{ ...w, close: e.target.value }])} aria-label={`${label} closes`} className="w-28" />
                    </>
                  ) : <span className="text-sm text-ink-400">Closed</span>}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2"><Button variant="secondary" size="lg" onClick={() => setStep(0)}>Back</Button><Button size="lg" className="flex-1" onClick={next}>Continue</Button></div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-rise">
          <div><h1 className="text-2xl font-semibold tracking-tight">Add your first service</h1><p className="mt-1 text-sm text-ink-500">You can add more services and team members after setup.</p></div>
          <Field label="Service name" error={fe["firstService.name"]}><Input value={svc.name} onChange={(e) => setSvc({ ...svc, name: e.target.value })} placeholder="Initial consultation" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration (min)" error={fe["firstService.durationMin"]}><Input type="number" min={5} step={5} value={svc.durationMin} onChange={(e) => setSvc({ ...svc, durationMin: e.target.value })} /></Field>
            <Field label={`Price (${currency})`} error={fe["firstService.price"]}><Input inputMode="decimal" value={svc.price} onChange={(e) => setSvc({ ...svc, price: e.target.value })} placeholder="45" /></Field>
          </div>
          <Field label="Who provides it?" error={fe.staffName} hint="You'll be added as the first team member."><Input value={staffName} onChange={(e) => setStaffName(e.target.value)} /></Field>
          <div className="flex gap-2"><Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button><Button size="lg" className="flex-1" loading={pending} onClick={finish}>Finish setup</Button></div>
        </div>
      )}
    </div>
  );
}
