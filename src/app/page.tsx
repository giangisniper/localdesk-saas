import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, CalendarClock, Check, ChevronDown, Globe, ShieldCheck, Users, Zap, Scissors, UserCog } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/brand/logo";
import { MarketingNav } from "@/components/marketing/nav";
import { buttonClass } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

export const metadata = { title: { absolute: "LocalDesk — Appointment booking, CRM and analytics for local businesses" } };

const FEATURES = [
  { icon: CalendarClock, title: "A calendar that can't double-book", body: "Day, week and month views with drag-free quick booking. Overlaps are blocked in the app and enforced by the database itself." },
  { icon: Globe, title: "Your own booking page", body: "Customers pick a service, a professional and a time that actually fits — respecting hours, time off, buffers and notice rules." },
  { icon: Users, title: "A CRM that fills itself", body: "Every booking builds a customer profile with history, lifetime value, tags and private notes for your team." },
  { icon: UserCog, title: "Team schedules and permissions", body: "Working hours, split shifts and time off per person, with owner, admin and staff roles that limit what each login can do." },
  { icon: BarChart3, title: "Analytics you'll actually read", body: "Revenue trends, busiest hours, retention, no-show rate and per-professional performance, over any date range." },
  { icon: Scissors, title: "Services that stay organised", body: "Durations, prices and categories, assigned to the people who perform them — archive instead of losing history." },
];

const PLANS = [
  { name: "Solo", price: "€0", note: "For independent professionals getting started", features: ["1 team member", "Online booking page", "Customer directory", "Basic analytics"], cta: "Start free", featured: false },
  { name: "Studio", price: "€29", note: "For small teams that live in their calendar", features: ["Up to 5 team members", "Everything in Solo", "Full analytics & retention", "Team roles & permissions", "Time-off management"], cta: "Start 14-day trial", featured: true },
  { name: "Business", price: "€79", note: "For multi-chair shops and clinics", features: ["Unlimited team members", "Everything in Studio", "Priority support", "Data export"], cta: "Start 14-day trial", featured: false },
];

const TESTIMONIALS = [
  { quote: "The calendar is the first thing I open in the morning and the last thing I close. Nothing gets lost any more.", name: "Sample customer", role: "Hair studio owner" },
  { quote: "Online booking cut our phone calls in half, and the no-show numbers finally gave us something to act on.", name: "Sample customer", role: "Physiotherapy clinic" },
  { quote: "I can see which services actually pay the bills. We re-priced two of them the same week.", name: "Sample customer", role: "Independent barber" },
];

const FAQ = [
  ["How does LocalDesk prevent double bookings?", "Every appointment is checked against the professional's working hours, time off and existing bookings. As a final safeguard, the database itself rejects overlapping appointments, so even two customers clicking at the same instant can't both get the slot."],
  ["Can my customers book without creating an account?", "Yes. They choose a service, a time and enter their name and email. LocalDesk matches returning customers by email so their history stays in one profile."],
  ["Does it support multiple staff members?", "Yes. Each person has their own working hours, services and time off. Customers can pick a specific professional or “any available”."],
  ["Can I control what my team can see?", "Three roles are built in: owners manage everything, admins manage everything except team access, and staff work with the calendar and customers only."],
  ["Which timezones and currencies are supported?", "Any IANA timezone, and EUR, USD, GBP, CHF, CAD and AUD currencies. Times are stored in UTC and shown in your business timezone."],
  ["Is billing connected?", "This is a portfolio build: the pricing above is illustrative and no payment provider is wired up. The README explains where a billing integration would plug in."],
];

export default async function Home() {
  if (await getSession()) redirect("/dashboard");
  return (
    <div>
      <MarketingNav />
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800"><Zap className="size-3.5" />Booking, CRM and analytics in one place</p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-6xl">Run your appointments, <span className="text-brand-600">not your admin.</span></h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-ink-600 text-pretty">LocalDesk gives salons, clinics, studios and independent professionals a calendar, a booking page, a customer record and a clear view of the numbers — without the spreadsheet.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className={buttonClass("primary", "lg", "w-full sm:w-auto")}>Start free — no card needed</Link>
              <Link href="/login" className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>Try the live demo</Link>
            </div>
            <p className="mt-3 text-xs text-ink-500">Demo login: owner@demo.localdesk.app · LocalDesk2026!</p>
          </div>
          <HeroPreview />
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-y border-ink-200 bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-tight">Everything a local business needs, nothing it doesn&apos;t</h2><p className="mt-3 text-ink-600">Built around the way appointment-based businesses really work: a busy day, a few people, and customers who come back.</p></div>
            <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title}><div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><f.icon className="size-5" /></div><h3 className="font-semibold">{f.title}</h3><p className="mt-1.5 text-[15px] leading-relaxed text-ink-600">{f.body}</p></div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Up and running in an afternoon</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[["Set up your business", "Name, opening hours and your first service — a three-step guided setup."], ["Share your booking link", "Put it on Instagram, Google Maps or your website. Customers book 24/7."], ["Watch the picture build", "Appointments, customers and revenue flow into your dashboard automatically."]].map(([t, b], i) => (
              <li key={t} className="rounded-2xl bg-white p-6 shadow-card"><span className="mb-4 flex size-8 items-center justify-center rounded-full bg-ink-900 text-sm font-semibold text-white">{i + 1}</span><h3 className="font-semibold">{t}</h3><p className="mt-1.5 text-[15px] text-ink-600">{b}</p></li>
            ))}
          </ol>
        </section>

        {/* Testimonials */}
        <section className="border-y border-ink-200 bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="text-3xl font-semibold tracking-tight">What teams could say</h2><p className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Demo content — illustrative, not real customer endorsements</p></div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <figure key={t.quote} className="flex flex-col rounded-2xl bg-ink-50 p-6"><blockquote className="flex-1 text-[15px] leading-relaxed text-ink-800">“{t.quote}”</blockquote><figcaption className="mt-5 text-sm"><span className="font-medium">{t.name}</span><span className="text-ink-500"> · {t.role}</span></figcaption></figure>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center"><h2 className="text-3xl font-semibold tracking-tight">Simple pricing that grows with you</h2><p className="mt-3 text-ink-600">Illustrative pricing for this portfolio project — no payment provider is connected.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={cn("flex flex-col rounded-2xl bg-white p-7", p.featured ? "shadow-pop ring-2 ring-brand-600" : "shadow-card")}>
                <div className="flex items-center justify-between"><h3 className="font-semibold">{p.name}</h3>{p.featured && <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-medium text-white">Most popular</span>}</div>
                <p className="mt-4 flex items-baseline gap-1"><span className="text-4xl font-semibold tracking-tight">{p.price}</span><span className="text-sm text-ink-500">/ month</span></p>
                <p className="mt-2 text-sm text-ink-600">{p.note}</p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" />{f}</li>)}</ul>
                <Link href="/register" className={buttonClass(p.featured ? "primary" : "secondary", "lg", "mt-7 w-full")}>{p.cta}</Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-t border-ink-200 bg-white py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
            <div className="mt-8 divide-y divide-ink-200">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">{q}<ChevronDown className="size-5 shrink-0 text-ink-400 transition-transform group-open:rotate-180" /></summary><p className="mt-3 text-[15px] leading-relaxed text-ink-600">{a}</p></details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="rounded-3xl bg-brand-900 px-6 py-14 text-center text-white sm:px-12">
            <ShieldCheck className="mx-auto mb-4 size-8 text-brand-300" />
            <h2 className="text-3xl font-semibold tracking-tight text-balance">Give your calendar a calmer Monday.</h2>
            <p className="mx-auto mt-3 max-w-md text-brand-100">Set up in minutes. Explore with realistic demo data, or start fresh with your own business.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/register" className={buttonClass("secondary", "lg")}>Create your account</Link><Link href="/login" className="inline-flex h-11 items-center justify-center rounded-lg px-5 text-[15px] font-medium text-white hover:bg-white/10">Sign in to the demo</Link></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
          <div className="max-w-xs"><Logo /><p className="mt-3 text-sm text-ink-500">Appointment booking, customer management and analytics for local businesses.</p></div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div><p className="mb-3 font-medium">Product</p><ul className="space-y-2 text-ink-600"><li><a href="#features" className="hover:text-ink-900">Features</a></li><li><a href="#pricing" className="hover:text-ink-900">Pricing</a></li><li><a href="#faq" className="hover:text-ink-900">FAQ</a></li></ul></div>
            <div><p className="mb-3 font-medium">Get started</p><ul className="space-y-2 text-ink-600"><li><Link href="/register" className="hover:text-ink-900">Create account</Link></li><li><Link href="/login" className="hover:text-ink-900">Sign in</Link></li><li><Link href="/book/studio-luna" className="hover:text-ink-900">Sample booking page</Link></li></ul></div>
          </div>
        </div>
        <div className="border-t border-ink-100 py-5 text-center text-xs text-ink-500">© {new Date().getFullYear()} LocalDesk · A portfolio project</div>
      </footer>
    </div>
  );
}

function HeroPreview() {
  const bars = [38, 52, 44, 61, 58, 72, 66, 80, 74, 90, 84, 96];
  const events = [["09:00", "Elena S.", "Women's Cut", "#0d9488", 0, 56], ["10:30", "Marco B.", "Balayage", "#7c3aed", 40, 110], ["13:15", "Chiara R.", "Keratin", "#0891b2", 150, 90], ["15:00", "Luca G.", "Men's Cut", "#ea580c", 235, 40]] as const;
  return (
    <div className="relative mx-auto mt-14 max-w-5xl" aria-hidden>
      <div className="overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center gap-1.5 border-b border-ink-100 bg-ink-50 px-4 py-2.5">{[0, 1, 2].map((i) => <span key={i} className="size-2.5 rounded-full bg-ink-300" />)}<span className="ml-3 rounded-md bg-white px-3 py-0.5 text-[11px] text-ink-400 shadow-card">app.localdesk.example/dashboard</span></div>
        <div className="grid gap-4 bg-ink-50 p-4 sm:p-6 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">{[["Revenue", "€19,983", "+7%"], ["Appointments", "492", "+13%"], ["New customers", "19", "+46%"]].map(([k, v, d]) => <div key={k} className="rounded-xl bg-white p-3 shadow-card"><p className="text-[11px] text-ink-500">{k}</p><p className="mt-1 text-lg font-semibold tabular sm:text-xl">{v}</p><p className="mt-1 text-[11px] font-medium text-emerald-700">{d}</p></div>)}</div>
            <div className="rounded-xl bg-white p-4 shadow-card"><p className="text-xs font-semibold">Revenue</p><div className="mt-3 flex h-32 items-end gap-2">{bars.map((h, i) => <span key={i} className="flex-1 rounded-t bg-brand-600/80" style={{ height: `${h}%` }} />)}</div></div>
          </div>
          <div className="relative hidden h-72 overflow-hidden rounded-xl bg-white p-3 shadow-card md:block">
            <p className="mb-2 text-xs font-semibold">Today</p>
            {events.map(([t, n, s, c, top, h]) => <div key={t} className="absolute inset-x-3 rounded-md border-l-[3px] px-2 py-1 text-[11px]" style={{ top: 36 + top, height: h * 0.72, borderColor: c, background: `${c}1f` }}><p className="font-semibold">{n}</p><p className="text-ink-600">{t} · {s}</p></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
