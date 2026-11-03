import { cn } from "@/lib/utils";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";
export const variants = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
  secondary: "bg-white text-ink-800 shadow-card hover:bg-ink-50",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};
export const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-sm", lg: "h-11 px-5 text-[15px]" };
export function buttonClass(variant: keyof typeof variants = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return cn(buttonBase, variants[variant], sizes[size], extra);
}
