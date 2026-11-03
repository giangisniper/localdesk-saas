"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";

const INK = "#7d7970";
const GRID = "#e5e3de";
const BRAND = "#0d7d77";
const SECOND = "#b9b5aa";

type Gran = "day" | "week" | "month";
function tickLabel(g: Gran) {
  return (v: string) => (g === "month" ? format(parseISO(v), "MMM yy") : format(parseISO(v), "d MMM"));
}
function fullLabel(g: Gran) {
  return (v: string) => (g === "month" ? format(parseISO(v), "MMMM yyyy") : g === "week" ? `Week of ${format(parseISO(v), "d MMM")}` : format(parseISO(v), "EEE d MMM"));
}

const tooltipStyle = { borderRadius: 10, border: "none", boxShadow: "0 12px 32px -8px rgb(26 25 23 / 0.18), 0 0 0 1px rgb(26 25 23 / 0.06)", fontSize: 13, padding: "8px 12px" };

export function TrendChart({ data, dataKey, granularity, money, currency = "EUR", height = 260, label }: {
  data: { bucket: string; [k: string]: number | string }[]; dataKey: string; granularity: Gran; money?: boolean; currency?: string; height?: number; label: string;
}) {
  const fmt = (v: number) => money ? new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(v) : String(v);
  return (
    <div role="img" aria-label={`${label} over time`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs><linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRAND} stopOpacity={0.22} /><stop offset="100%" stopColor={BRAND} stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="bucket" tickFormatter={tickLabel(granularity)} tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={false} width={money ? 52 : 32} tickFormatter={(v: number) => money ? (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v)) : String(v)} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => fullLabel(granularity)(String(v))} formatter={(v) => [fmt(Number(v)), label]} cursor={{ stroke: SECOND }} />
          <Area type="monotone" dataKey={dataKey} stroke={BRAND} strokeWidth={2} fill={`url(#g-${dataKey})`} dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBars({ data, height = 220, horizontal, money, currency = "EUR", label }: {
  data: { name: string; count?: number; revenue?: number }[]; height?: number; horizontal?: boolean; money?: boolean; currency?: string; label: string;
}) {
  const key = money ? "revenue" : "count";
  const fmt = (v: number) => money ? new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(v) : String(v);
  return (
    <div role="img" aria-label={label} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 12, left: horizontal ? 4 : 0, bottom: 0 }}>
          <CartesianGrid horizontal={!horizontal} vertical={!!horizontal} stroke={GRID} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={128} tick={{ fill: "#44423c", fontSize: 12 }} tickLine={false} axisLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            </>
          )}
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f0ed" }} formatter={(v) => [fmt(Number(v)), money ? "Revenue" : "Appointments"]} />
          <Bar dataKey={key} fill={BRAND} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RetentionChart({ data }: { data: { month: string; new: number; returning: number }[] }) {
  return (
    <div role="img" aria-label="New versus returning customers per month" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="month" tickFormatter={(v: string) => format(parseISO(v), "MMM")} tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: INK, fontSize: 12 }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f1f0ed" }} labelFormatter={(v) => format(parseISO(String(v)), "MMMM yyyy")} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: INK }} />
          <Bar dataKey="returning" name="Returning" stackId="a" fill={BRAND} maxBarSize={28} />
          <Bar dataKey="new" name="New" stackId="a" fill={SECOND} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = { completed: "#0d7d77", confirmed: "#43b6ac", scheduled: "#a9e6de", cancelled: "#d5776b", no_show: "#e0a93b" };
export function StatusDonut({ data }: { data: { status: string; count: number }[] }) {
  const total = data.reduce((a, b) => a + b.count, 0);
  return (
    <div className="flex items-center gap-6">
      <div role="img" aria-label="Appointments by status" className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="status" innerRadius={52} outerRadius={74} paddingAngle={2} stroke="none">
              {data.map((d) => <Cell key={d.status} fill={STATUS_COLORS[d.status] ?? SECOND} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-semibold tabular">{total}</span><span className="text-xs text-ink-500">total</span></div>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.status} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 capitalize"><span className="size-2.5 rounded-full" style={{ background: STATUS_COLORS[d.status] ?? SECOND }} />{d.status.replace("_", "-")}</span>
            <span className="tabular text-ink-600">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
