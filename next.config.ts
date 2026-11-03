import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Pin the tracing/workspace root to this project. Without it Next.js infers the root from the
  // nearest lockfile and warns ("Multiple lockfiles detected") when a stray package-lock.json exists
  // in a parent directory (e.g. ~/package-lock.json), which can also mis-trace files in deployments.
  outputFileTracingRoot: path.resolve(__dirname),
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  async headers() {
    const prod = process.env.NODE_ENV === "production";
    const csp = [
      "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
      "font-src 'self'", "connect-src 'self'", "frame-ancestors 'none'", "form-action 'self'", "base-uri 'self'", "object-src 'none'",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(prod ? [{ key: "Content-Security-Policy", value: csp }, { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default config;
