"use client";
import * as React from "react";
import { cn, initials } from "@/lib/utils";
import { buttonClass } from "./styles";
export { buttonClass };
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/* ---------- Button ---------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...p }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...p}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ---------- Form fields ---------- */
const fieldBase =
  "w-full rounded-lg bg-white px-3 text-sm text-ink-900 shadow-card placeholder:text-ink-400 focus:outline-2 focus:outline-brand-500 disabled:bg-ink-100 disabled:text-ink-500 aria-[invalid=true]:outline-2 aria-[invalid=true]:outline-red-500";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-9", className)} {...p} />;
});
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-20 py-2", className)} {...p} />;
});
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} className={cn(fieldBase, "h-9 pr-8", className)} {...p} />;
});

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>; className?: string }) {
  const id = React.useId();
  const child = React.cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || hint ? `${id}-d` : undefined,
  });
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink-700">{label}</label>
      {child}
      {(error || hint) && (
        <p id={`${id}-d`} className={cn("text-xs", error ? "text-red-600" : "text-ink-500")} role={error ? "alert" : undefined}>{error ?? hint}</p>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {description && <span className="block text-[13px] text-ink-500">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-brand-600" : "bg-ink-300")}>
        <span className={cn("absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
      </button>
    </label>
  );
}

/* ---------- Surfaces ---------- */
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl bg-white shadow-card", className)} {...p} />;
}
export function CardHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-ink-100 text-ink-700",
  brand: "bg-brand-100 text-brand-800",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-800",
};
export function Badge({ tone = "neutral", className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTones }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", badgeTones[tone], className)} {...p} />;
}

export const STATUS_META: Record<string, { label: string; tone: keyof typeof badgeTones }> = {
  scheduled: { label: "Scheduled", tone: "blue" },
  confirmed: { label: "Confirmed", tone: "brand" },
  completed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
  no_show: { label: "No-show", tone: "amber" },
};
export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function Avatar({ name, color = "#0d7d77", size = 32 }: { name: string; color?: string; size?: number }) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-ink-200/70", className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-ink-100 text-ink-500">{icon}</div>}
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "success"; children: React.ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px]", tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800")}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/* ---------- Dialog (native <dialog>: focus trap + Esc for free) ---------- */
export function Dialog({ open, onClose, title, description, children, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; wide?: boolean }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby="dlg-title"
      className={cn("m-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 shadow-pop open:animate-rise", wide ? "max-w-2xl" : "max-w-md")}>
      {open && (
        <div className="max-h-[88vh] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-100 bg-white px-5 py-4">
            <div>
              <h2 id="dlg-title" className="text-base font-semibold tracking-tight">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
            </div>
            <button onClick={onClose} aria-label="Close dialog" className="-mr-1 rounded-md p-1 text-ink-500 hover:bg-ink-100"><X className="size-5" /></button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/* ---------- Toasts ---------- */
type Toast = { id: number; message: string; tone: "success" | "error" };
const ToastCtx = React.createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const push = React.useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, message, tone }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-rise items-center gap-2 rounded-lg bg-ink-900 px-3.5 py-2.5 text-sm text-white shadow-pop">
            {t.tone === "success" ? <CheckCircle2 className="size-4 text-brand-300" /> : <AlertCircle className="size-4 text-red-300" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
