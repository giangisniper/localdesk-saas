import Link from "next/link";
import { Search, Users } from "lucide-react";
import { requireCtx } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { customerTags, listCustomers } from "@/server/queries";
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { CustomerDialogButton } from "@/components/customer-forms";
import { Pagination } from "@/components/pagination";
import { fmtDate } from "@/lib/time";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { business, role } = await requireCtx("customers:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = ["name", "recent", "spent", "newest"].includes(sp.sort ?? "") ? sp.sort! : "name";
  const [tags, { rows, total }] = await Promise.all([
    customerTags(business.id),
    listCustomers(business.id, { q: sp.q?.trim() || undefined, tag: sp.tag || undefined, sort, page, pageSize: PAGE_SIZE }),
  ]);
  const tz = business.timezone;
  return (
    <div>
      <PageHeader title="Customers" description={`${total} ${total === 1 ? "customer" : "customers"} in your directory`} actions={can(role, "customers:manage") && <CustomerDialogButton />} />
      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-ink-400" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search name, email or phone" className="pl-8" aria-label="Search customers" />
        </div>
        <Select name="tag" defaultValue={sp.tag ?? ""} aria-label="Tag" className="w-40"><option value="">All tags</option>{tags.map((t) => <option key={t}>{t}</option>)}<option value="__none">Untagged</option></Select>
        <Select name="sort" defaultValue={sort} aria-label="Sort" className="w-44"><option value="name">Name (A–Z)</option><option value="recent">Most recent visit</option><option value="spent">Highest spend</option><option value="newest">Newest customers</option></Select>
        <Button type="submit" variant="secondary">Apply</Button>
        {(sp.q || sp.tag || sp.sort) && <Link href="/customers" className="text-[13px] font-medium text-ink-500 hover:text-ink-900">Reset</Link>}
      </form>
      {rows.length === 0 ? (
        <Card><EmptyState icon={<Users className="size-5" />} title={sp.q || sp.tag ? "No customers match" : "No customers yet"} description={sp.q || sp.tag ? "Try a different search or filter." : "Customers are added automatically when they book online, or you can add them manually."} /></Card>
      ) : (
        <Card className="overflow-hidden"><div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr><th className="px-4 py-2.5 font-medium">Customer</th><th className="px-4 py-2.5 font-medium">Contact</th><th className="px-4 py-2.5 text-right font-medium">Visits</th><th className="px-4 py-2.5 text-right font-medium">Spent</th><th className="px-4 py-2.5 font-medium">Last visit</th><th className="px-4 py-2.5 font-medium">Next</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="flex items-center gap-3 font-medium hover:text-brand-700">
                      <Avatar name={c.name} size={32} color="#5d5a52" />
                      <span>{c.name}{c.tags.length > 0 && <span className="ml-2 inline-flex gap-1 align-middle">{c.tags.slice(0, 2).map((t) => <Badge key={t} tone={t === "VIP" ? "amber" : "neutral"}>{t}</Badge>)}</span>}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-600"><div>{c.email || "—"}</div><div className="text-xs text-ink-400">{c.phone}</div></td>
                  <td className="px-4 py-3 text-right tabular">{c.visits}</td>
                  <td className="px-4 py-3 text-right tabular">{formatMoney(c.spent, business.currency)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600">{c.lastVisit ? fmtDate(c.lastVisit, tz, "d MMM yyyy") : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-600">{c.nextVisit ? fmtDate(c.nextVisit, tz, "d MMM") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></Card>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/customers" params={{ q: sp.q, tag: sp.tag, sort: sp.sort }} />
    </div>
  );
}
