import { providerStatus, type Provider } from "@/lib/oauth/config";
import { cn } from "@/lib/utils";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
function AppleMark() {
  return (
    <svg viewBox="0 0 384 512" className="size-[17px]" fill="currentColor" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

/** Only providers whose credentials are present *and* usable with the configured app URL are rendered. */
export function OAuthButtons({ mode, className }: { mode: "login" | "register"; className?: string }) {
  const ready = (["google", "apple"] as Provider[]).filter((p) => providerStatus(p).ready);
  if (ready.length === 0) return null;
  const verb = mode === "register" ? "Sign up" : "Continue";
  return (
    <div className={cn("space-y-2.5", className)}>
      {ready.includes("google") && (
        <a href="/api/auth/google/start" className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-white text-[15px] font-medium text-ink-800 shadow-card transition-colors hover:bg-ink-50">
          <GoogleMark />{verb} with Google
        </a>
      )}
      {ready.includes("apple") && (
        <a href="/api/auth/apple/start" className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-black text-[15px] font-medium text-white transition-colors hover:bg-ink-900">
          <AppleMark />{verb} with Apple
        </a>
      )}
      <div className="flex items-center gap-3 pt-1 text-xs text-ink-400" role="separator"><span className="h-px flex-1 bg-ink-200" />or use email<span className="h-px flex-1 bg-ink-200" /></div>
    </div>
  );
}
