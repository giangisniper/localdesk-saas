# LocalDesk

**Appointment booking, customer management and analytics for local businesses.**
A full-stack SaaS built with Next.js 15, TypeScript, PostgreSQL and Drizzle ORM — a portfolio project demonstrating multi-tenant architecture, secure auth, a custom calendar, a public booking flow and an analytics suite.

| Dashboard | Calendar |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Calendar](docs/screenshots/calendar.png) |
| **Analytics** | **Public booking page** |
| ![Analytics](docs/screenshots/analytics.png) | ![Booking](docs/screenshots/book.png) |

More: [landing page](docs/screenshots/landing.png) · [services](docs/screenshots/services.png) · [team](docs/screenshots/staff.png) · [customers](docs/screenshots/customers.png) · [settings](docs/screenshots/settings.png)

## Features

**Marketing site** — landing page, features, how-it-works, pricing, FAQ, responsive nav and footer. Testimonials are clearly labelled demo content; pricing is illustrative (no billing provider is connected).

**Auth & onboarding** — registration/login with bcrypt (cost 12) and signed, httpOnly JWT session cookies; login/registration rate limiting; 3-step onboarding wizard (business, opening hours, first service/staff); roles `owner`, `admin`, `staff` with a central permission matrix.

**Dashboard** — revenue, appointments, new customers and cancellation-rate KPIs with period-over-period change, revenue chart, top services, upcoming appointments, recent activity, presets (7d/30d/90d/12m) and custom date range.

**Appointments & calendar** — day (one column per staff member), week and month views; click-to-book; create/edit/cancel/complete/no-show; overlap handling for concurrent events; "now" indicator; staff filter; searchable, filterable, paginated list; quick inline customer creation.

**Conflict prevention** — three layers: availability computation, a server-side check in every write path, and a PostgreSQL **exclusion constraint** (`btree_gist`) so two active appointments for one staff member can never overlap, even under race conditions (covered by an integration test).

**Public booking** (`/book/<slug>`) — service → professional/"any" + date + time → details. Slots respect business hours, staff shifts, time off, buffers, minimum notice, maximum advance and existing bookings; the slot is re-validated at submit time. Customers are matched by email.

**CRM** — directory with search, tag filter, sorting, pagination; profile with contact details, lifetime value, favourite service, appointment history and private team notes.

**Services & team** — categories, durations, prices, colours, online-bookable flag; per-staff working hours (split shifts), service assignment, time off; deleting something with history archives it instead.

**Analytics** — revenue & appointment trends (day/week/month buckets), new vs returning customers, repeat rate, lapsed customers, popular services, per-professional performance, busiest days/hours, outcome breakdown, top customers.

**Settings** — business profile and booking URL, timezone/currency, opening hours (with breaks), booking rules, notification preferences, account/password, and team logins (owner only).

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router, Server Components, Server Actions), React 19 |
| Language | TypeScript (strict) |
| Database | PostgreSQL 16 + Drizzle ORM, SQL migrations (`drizzle/`) |
| Auth | bcryptjs + `jose` JWT in httpOnly cookie, role-based permissions |
| Validation | Zod (shared by forms and server actions) |
| UI | Tailwind CSS v4, hand-built design system, lucide icons, Geist font |
| Charts | Recharts |
| Dates | date-fns + date-fns-tz (UTC storage, business-timezone display, DST-tested) |
| Tests | Vitest (unit + DB integration) |

## Getting started

Requirements: Node 20+ (22 recommended) and PostgreSQL 14+ (or Docker).

```bash
git clone <repo> && cd localdesk-saas
npm install
cp .env.example .env            # then set AUTH_SECRET (openssl rand -base64 48)
docker compose up -d db         # or use your own Postgres and edit DATABASE_URL
npm run db:setup                # runs migrations + seeds demo data
npm run dev                     # http://localhost:3000
```

`npm run db:seed` can be re-run any time; it resets the demo business ("Studio Luna").

### Demo accounts (password `LocalDesk2026!`)

| Email | Role | Can access |
|---|---|---|
| `owner@demo.localdesk.app` | Owner | everything, incl. team access |
| `manager@demo.localdesk.app` | Admin | everything except team access |
| `staff@demo.localdesk.app` | Staff | calendar, appointments, customers |

The seeded business has 4 team members, 10 services, 90 customers and ~4,000 appointments spanning the past year and the next three weeks. Public booking page: `/book/studio-luna`.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` · `npm run typecheck` | ESLint · tsc |
| `npm test` | Vitest (needs the migrated database for the integration test) |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` · `db:seed` · `db:setup` | Apply migrations · seed · both |

### Screenshots

With the app running and seeded: `node scripts/screenshots.cjs` (uses Playwright) writes images to `docs/screenshots/`.

## Environment variables

| Name | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | ≥ 32 chars; signs session cookies. The app refuses to start sessions without it |
| `NEXT_PUBLIC_APP_URL` | Public base URL (used for booking links/metadata) |

## Architecture

```
src/
  app/
    (auth)/        login, register, onboarding wizard
    (app)/         authenticated shell: dashboard, calendar, appointments, customers,
                   services, staff, analytics, settings (each page enforces permissions)
    book/[slug]/   public booking page
    actions/       Server Actions — auth, appointments, customers, catalog, settings, public booking
  components/      ui/ design system, calendar, charts, forms, marketing
  db/              schema.ts, migrations runner, seed.ts
  lib/             auth, permissions, availability (pure), time/range utils, validation (zod)
  server/          booking.ts (conflict-safe writes), queries.ts, stats.ts (SQL aggregations)
drizzle/           generated SQL migrations (+ the exclusion-constraint migration)
tests/             unit + integration tests
```

**Multi-tenancy.** Every business-owned table carries `business_id`; every query and mutation is scoped by the business from the authenticated session, and foreign ids coming from the client (customer, service, staff…) are re-verified against it before use.

**Authorization.** `requireCtx(permission)` guards pages; `actionCtx(permission)` guards server actions. The matrix lives in `lib/permissions.ts`. UI hiding is cosmetic — the server enforces.

**Time.** Instants are stored as `timestamptz` (UTC). Opening hours and shifts are wall-clock times interpreted in the business timezone; analytics bucket in that timezone via `AT TIME ZONE`.

**Availability.** `lib/availability.ts` is a pure function (easy to test): intersect business hours with staff shifts → step through candidate slots → drop those hitting busy intervals/buffer/notice/advance limits.

**Security notes.** bcrypt hashing, signed httpOnly/SameSite=Lax cookies (Secure in production), constant-time-ish login for unknown emails, rate limits on login/registration/public booking, Zod validation on every action, parameterised SQL only, security headers (frame/content-type/referrer/permissions). Server Actions carry Next.js's built-in origin checks.

## Known limitations / honest notes

- **Emails/SMS are not sent.** Notification preferences are stored, but no provider is wired in; add one (e.g. SMTP/Resend) where bookings are created in `server/booking.ts`.
- **Billing is not integrated**; the pricing section is illustrative.
- **Rate limiting is in-process memory** — use Redis or an edge limiter for multi-instance deployments.
- **Sessions are stateless JWTs** (7 days); there is no server-side revocation list or password-reset email flow yet.
- Customers cannot self-cancel from a link yet; staff cancel from the dashboard.
- Not security-audited or load-tested; review before real production use.

## License

MIT
