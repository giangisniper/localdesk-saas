"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/styles";

const LINKS = [["Features", "#features"], ["How it works", "#how"], ["Pricing", "#pricing"], ["FAQ", "#faq"]];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-ink-50/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {LINKS.map(([l, h]) => <a key={h} href={h} className="text-sm font-medium text-ink-600 hover:text-ink-900">{l}</a>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className={buttonClass("ghost")}>Sign in</Link>
          <Link href="/register" className={buttonClass("primary")}>Start free</Link>
        </div>
        <button className="rounded-md p-2 md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
      </div>
      {open && (
        <div className="animate-fade-in border-t border-ink-200 bg-ink-50 px-4 pb-5 pt-2 md:hidden">
          {LINKS.map(([l, h]) => <a key={h} href={h} onClick={() => setOpen(false)} className="block py-2.5 text-[15px] font-medium text-ink-700">{l}</a>)}
          <div className="mt-3 flex gap-2"><Link href="/login" className={buttonClass("secondary", "md", "flex-1")}>Sign in</Link><Link href="/register" className={buttonClass("primary", "md", "flex-1")}>Start free</Link></div>
        </div>
      )}
    </header>
  );
}
