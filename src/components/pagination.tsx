import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ page, pageSize, total, params, basePath }: { page: number; pageSize: number; total: number; params: Record<string, string | undefined>; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("page", String(p));
    return `${basePath}?${q.toString()}`;
  };
  const cls = "inline-flex size-8 items-center justify-center rounded-lg bg-white shadow-card hover:bg-ink-50";
  return (
    <div className="mt-4 flex items-center justify-between text-[13px] text-ink-500">
      <span>{total === 0 ? "0 results" : `${(page - 1) * pageSize + 1}–${Math.min(total, page * pageSize)} of ${total}`}</span>
      <nav className="flex items-center gap-1.5" aria-label="Pagination">
        {page > 1 ? <Link href={href(page - 1)} className={cls} aria-label="Previous page"><ChevronLeft className="size-4" /></Link> : <span className={`${cls} opacity-40`}><ChevronLeft className="size-4" /></span>}
        <span className="px-2 tabular">Page {page} / {pages}</span>
        {page < pages ? <Link href={href(page + 1)} className={cls} aria-label="Next page"><ChevronRight className="size-4" /></Link> : <span className={`${cls} opacity-40`}><ChevronRight className="size-4" /></span>}
      </nav>
    </div>
  );
}
