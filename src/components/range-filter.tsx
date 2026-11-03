"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { RANGE_OPTIONS } from "@/lib/range";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui";

export function RangeFilter({ current, from, to }: { current: string; from: string; to: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [custom, setCustom] = useState(current === "custom");
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  function go(params: Record<string, string>) {
    const q = new URLSearchParams(sp.toString());
    q.delete("from"); q.delete("to");
    for (const [k, v] of Object.entries(params)) q.set(k, v);
    router.push(`${path}?${q.toString()}`);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Date range" className="inline-flex rounded-lg bg-ink-200/60 p-0.5">
        {RANGE_OPTIONS.map((o) => (
          <button key={o.key} onClick={() => { setCustom(false); go({ range: o.key }); }} aria-pressed={current === o.key}
            className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors", current === o.key ? "bg-white text-ink-900 shadow-card" : "text-ink-600 hover:text-ink-900")}>
            {o.label}
          </button>
        ))}
        <button onClick={() => setCustom(true)} aria-pressed={current === "custom"}
          className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors", current === "custom" ? "bg-white text-ink-900 shadow-card" : "text-ink-600 hover:text-ink-900")}>Custom</button>
      </div>
      {custom && (
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (f && t && f <= t) go({ range: "custom", from: f, to: t }); }}>
          <Input type="date" value={f} max={t} onChange={(e) => setF(e.target.value)} aria-label="From date" className="w-36" />
          <span className="text-ink-400">–</span>
          <Input type="date" value={t} min={f} onChange={(e) => setT(e.target.value)} aria-label="To date" className="w-36" />
          <Button type="submit" size="sm" variant="secondary">Apply</Button>
        </form>
      )}
    </div>
  );
}
