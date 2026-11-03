"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, CalendarDays, CalendarCheck, LayoutDashboard, LogOut, Menu, Scissors, Settings, Users, UserCog, X, ExternalLink } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/actions/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/appointments", label: "Appointments", icon: CalendarCheck },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/services", label: "Services", icon: Scissors, perm: "manage" },
  { href: "/staff", label: "Team", icon: UserCog, perm: "manage" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, perm: "analytics" },
  { href: "/settings", label: "Settings", icon: Settings, perm: "manage" },
] as const;

export function AppShell({ business, user, role, children }: { business: { name: string; slug: string; onlineBookingEnabled: boolean }; user: { name: string; email: string }; role: string; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => !("perm" in n) || role !== "staff");

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
      {items.map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors", active ? "bg-white text-ink-900 shadow-card" : "text-ink-600 hover:bg-ink-200/60 hover:text-ink-900")}>
            <n.icon className={cn("size-[18px]", active ? "text-brand-600" : "text-ink-400")} aria-hidden />
            {n.label}
          </Link>
        );
      })}
      {business.onlineBookingEnabled && (
        <Link href={`/book/${business.slug}`} target="_blank" className="mt-3 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink-600 hover:bg-ink-200/60">
          <ExternalLink className="size-[18px] text-ink-400" aria-hidden /> Booking page
        </Link>
      )}
    </nav>
  );

  const account = (
    <div className="border-t border-ink-200 p-3">
      <div className="flex items-center gap-2.5 px-1.5 py-1">
        <Avatar name={user.name} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs capitalize text-ink-500">{role}</p>
        </div>
        <form action={logoutAction}>
          <button aria-label="Sign out" title="Sign out" className="rounded-md p-1.5 text-ink-500 hover:bg-ink-200/60"><LogOut className="size-4" /></button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-ink-100 lg:flex">
        <div className="px-5 pb-5 pt-5"><Logo href="/dashboard" /></div>
        <p className="mb-2 truncate px-5 text-xs font-medium uppercase tracking-wider text-ink-400">{business.name}</p>
        {nav}
        {account}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200 bg-ink-50/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Logo href="/dashboard" />
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-2 hover:bg-ink-200/60"><Menu className="size-5" /></button>
        </header>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 animate-fade-in bg-ink-900/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-72 animate-rise flex-col bg-ink-100 pt-4">
              <div className="mb-4 flex items-center justify-between px-5"><Logo href="/dashboard" /><button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-md p-1.5 hover:bg-ink-200/60"><X className="size-5" /></button></div>
              {nav}
              {account}
            </div>
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
