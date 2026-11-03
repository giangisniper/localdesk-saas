import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { MapPin, Phone } from "lucide-react";
import { db } from "@/db";
import { businesses, services, staff, staffServices } from "@/db/schema";
import { todayIn } from "@/lib/time";
import { BookingFlow } from "@/components/booking-flow";
import { LogoMark } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [b] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.slug, slug));
  return { title: b ? `Book at ${b.name}` : "Booking" };
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [biz] = await db.select().from(businesses).where(eq(businesses.slug, slug));
  if (!biz || !biz.onboardedAt) notFound();
  if (!biz.onlineBookingEnabled)
    return <main className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-xl font-semibold">{biz.name}</h1><p className="mt-2 text-ink-500">Online booking is currently unavailable. Please contact the business directly{biz.phone ? ` on ${biz.phone}` : ""}.</p></div></main>;

  const [svc, team, links] = await Promise.all([
    db.select().from(services).where(and(eq(services.businessId, biz.id), eq(services.active, true), eq(services.bookableOnline, true))).orderBy(services.category, services.name),
    db.select().from(staff).where(and(eq(staff.businessId, biz.id), eq(staff.active, true))),
    db.select({ staffId: staffServices.staffId, serviceId: staffServices.serviceId }).from(staffServices).innerJoin(staff, eq(staff.id, staffServices.staffId)).where(eq(staff.businessId, biz.id)),
  ]);
  const teamIds = new Set(team.map((t) => t.id));
  const bookable = svc.filter((s) => links.some((l) => l.serviceId === s.id && teamIds.has(l.staffId)));

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div><h1 className="text-lg font-semibold tracking-tight">{biz.name}</h1>
            <p className="mt-0.5 flex flex-wrap gap-x-4 text-[13px] text-ink-500">{biz.address && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{biz.address}</span>}{biz.phone && <span className="inline-flex items-center gap-1"><Phone className="size-3.5" />{biz.phone}</span>}</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {biz.description && <p className="mb-6 text-sm text-ink-600">{biz.description}</p>}
        {bookable.length === 0 ? <p className="rounded-xl bg-white p-8 text-center text-ink-500 shadow-card">No services are available to book online right now.</p> : (
          <BookingFlow slug={biz.slug} currency={biz.currency} today={todayIn(biz.timezone)} maxAdvanceDays={biz.maxAdvanceDays} cancellationHours={biz.cancellationHours}
            services={bookable.map((s) => ({ id: s.id, name: s.name, description: s.description, category: s.category, durationMin: s.durationMin, priceCents: s.priceCents, color: s.color }))}
            staff={team.map((t) => ({ id: t.id, name: t.name, title: t.title, color: t.color, serviceIds: links.filter((l) => l.staffId === t.id).map((l) => l.serviceId) }))} />
        )}
      </main>
      <footer className="pb-10 text-center text-xs text-ink-400"><span className="inline-flex items-center gap-1.5"><LogoMark className="size-4" />Powered by LocalDesk</span></footer>
    </div>
  );
}
