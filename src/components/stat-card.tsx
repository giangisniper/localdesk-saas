import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, delta, invert, hint }: { label: string; value: string; delta?: number | null; invert?: boolean; hint?: string }) {
  const good = delta == null ? null : invert ? delta <= 0 : delta >= 0;
  const Icon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card className="p-5">
      <p className="text-[13px] font-medium text-ink-500">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular">{value}</p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
        {delta === undefined ? hint : delta === null ? <span>New vs. previous period</span> : (
          <>
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium", delta === 0 ? "bg-ink-100 text-ink-600" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
              <Icon className="size-3" aria-hidden />{Math.abs(delta)}%
            </span>
            vs previous period
          </>
        )}
      </p>
    </Card>
  );
}
