import { AppShell } from "@/components/app-shell";
import { requireCtx } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, business, role } = await requireCtx();
  return (
    <AppShell business={{ name: business.name, slug: business.slug, onlineBookingEnabled: business.onlineBookingEnabled }} user={user} role={role}>
      {children}
    </AppShell>
  );
}
