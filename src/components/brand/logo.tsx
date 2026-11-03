import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0d7d77" />
      <rect x="7" y="8" width="18" height="17" rx="3.5" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M7 13.5h18" stroke="#fff" strokeWidth="2" />
      <path d="M12 5.5v5M20 5.5v5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="19.5" r="2" fill="#fff" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-[17px]">LocalDesk</span>
    </Link>
  );
}
