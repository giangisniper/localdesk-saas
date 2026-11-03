import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-xs text-ink-500">© {new Date().getFullYear()} LocalDesk</p>
      </div>
      <aside className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "36px 36px" }} />
        <div className="relative max-w-md">
          <p className="text-2xl font-semibold leading-snug tracking-tight">Fewer no-shows. Fuller calendars. One calm place to run your day.</p>
          <ul className="mt-8 space-y-3 text-sm text-brand-100">
            {["Online booking that never double-books", "A customer record for every client", "Revenue and retention at a glance"].map((t) => (
              <li key={t} className="flex gap-2"><span className="mt-1.5 size-1.5 rounded-full bg-brand-300" />{t}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
